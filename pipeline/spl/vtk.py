"""Reader for legacy VTK POLYDATA files (as exported by 3D Slicer for the SPL atlases).

Supports ASCII and BINARY (big-endian) files with float/double POINTS and POLYGONS or
TRIANGLE_STRIPS cells, which is what the SPL/NAC atlas models use. Polygons with more
than three vertices are fan-triangulated; strips are expanded with alternating winding.
"""

from pathlib import Path

import numpy as np

_DTYPES = {"float": ">f4", "double": ">f8", "int": ">i4", "vtkidtype": ">i4"}


def _strip_to_triangles(strip: np.ndarray) -> list[tuple[int, int, int]]:
    tris = []
    for i in range(len(strip) - 2):
        a, b, c = strip[i], strip[i + 1], strip[i + 2]
        if a == b or b == c or a == c:
            continue
        tris.append((a, b, c) if i % 2 == 0 else (b, a, c))
    return tris


def read_polydata(data: bytes) -> tuple[np.ndarray, np.ndarray]:
    """Return (points (n, 3) float64, triangles (m, 3) int64)."""
    lines = data.split(b"\n", 4)
    if not lines[0].startswith(b"# vtk DataFile"):
        raise ValueError("not a legacy VTK file")
    binary = lines[2].strip().upper() == b"BINARY"
    if lines[3].strip().upper() != b"DATASET POLYDATA":
        raise ValueError("only POLYDATA is supported")
    pos = sum(len(line) + 1 for line in lines[:4])
    points = np.zeros((0, 3))
    tris: list[np.ndarray] = []

    def next_line() -> bytes:
        nonlocal pos
        end = data.index(b"\n", pos)
        line = data[pos:end].strip()
        pos = end + 1
        return line

    def read_values(count: int, dtype: str) -> np.ndarray:
        nonlocal pos
        if binary:
            dt = np.dtype(_DTYPES[dtype])
            arr = np.frombuffer(data, dtype=dt, count=count, offset=pos)
            pos += count * dt.itemsize
            if pos < len(data) and data[pos : pos + 1] == b"\n":
                pos += 1
            return arr.astype(np.float64 if dtype in ("float", "double") else np.int64)
        values: list[float] = []
        while len(values) < count:
            values.extend(float(v) for v in next_line().split())
        return np.array(values[:count])

    while pos < len(data):
        line = next_line()
        if not line:
            continue
        head = line.split()
        key = head[0].upper()
        if key == b"POINTS":
            n, dtype = int(head[1]), head[2].decode().lower()
            points = read_values(n * 3, dtype).reshape(n, 3)
        elif key in (b"POLYGONS", b"TRIANGLE_STRIPS"):
            size = int(head[2])
            cells = read_values(size, "int").astype(np.int64)
            i = 0
            while i < len(cells):
                k = int(cells[i])
                ids = cells[i + 1 : i + 1 + k]
                i += 1 + k
                if key == b"POLYGONS":
                    tris.extend(np.array([[ids[0], ids[j], ids[j + 1]] for j in range(1, k - 1)]))
                else:
                    tris.extend(np.array(_strip_to_triangles(ids), dtype=np.int64).reshape(-1, 3))
        elif key in (b"VERTICES", b"LINES"):
            read_values(int(head[2]), "int")
        else:
            break  # POINT_DATA / CELL_DATA and later sections are not needed
    triangles = (
        np.array(tris, dtype=np.int64).reshape(-1, 3) if tris else np.zeros((0, 3), np.int64)
    )
    return points, triangles


def read_file(path: Path) -> tuple[np.ndarray, np.ndarray]:
    return read_polydata(Path(path).read_bytes())
