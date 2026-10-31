"""Minimal glTF-binary reader for the HRA reference organ files (uncompressed GLB).

Returns every mesh node with its world matrix, triangle indices and positions, plus
the material name of each primitive. Only what the pipeline needs is supported:
float32 positions, unsigned integer indices, TRIANGLES mode, no sparse accessors.
"""

import json
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np

_COMPONENT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
_WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


@dataclass
class Primitive:
    positions: np.ndarray  # (n, 3) float64, world coordinates
    triangles: np.ndarray  # (m, 3) int64
    material: str


@dataclass
class MeshNode:
    name: str
    parent_names: list[str]  # ancestors, nearest first
    primitives: list[Primitive]


def _read(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, _version, _length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError(f"{path}: not a GLB file")
    offset, gltf, binary = 12, None, b""
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8 : offset + 8 + length]
        if kind == 0x4E4F534A:
            gltf = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + length
    if gltf is None:
        raise ValueError(f"{path}: no JSON chunk")
    return gltf, binary


def _accessor(gltf: dict, binary: bytes, index: int) -> np.ndarray:
    acc = gltf["accessors"][index]
    if "sparse" in acc:
        raise ValueError("sparse accessors are not supported")
    view = gltf["bufferViews"][acc["bufferView"]]
    dtype = np.dtype(_COMPONENT[acc["componentType"]])
    width = _WIDTH[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride") or dtype.itemsize * width
    count = acc["count"]
    if stride == dtype.itemsize * width:
        arr = np.frombuffer(binary, dtype=dtype, count=count * width, offset=start)
        return arr.reshape(count, width) if width > 1 else arr
    rows = np.lib.stride_tricks.as_strided(
        np.frombuffer(binary, dtype=np.uint8, offset=start),
        shape=(count, dtype.itemsize * width),
        strides=(stride, 1),
    )
    return np.ascontiguousarray(rows).view(dtype).reshape(count, width)


def _local_matrix(node: dict) -> np.ndarray:
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape(4, 4).T
    t = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    s = np.array(node.get("scale", [1, 1, 1]), dtype=np.float64)
    r = np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ]
    )
    m = np.eye(4)
    m[:3, :3] = r * s
    m[:3, 3] = t
    return m


def read_mesh_nodes(path: Path, placement: np.ndarray | None = None) -> list[MeshNode]:
    """All mesh nodes of a GLB in world space (optionally pre-multiplied by `placement`)."""
    gltf, binary = _read(path)
    nodes = gltf.get("nodes", [])
    scene = gltf.get("scenes", [{}])[gltf.get("scene", 0)]
    out: list[MeshNode] = []

    def visit(i: int, parent: np.ndarray, ancestors: list[str]) -> None:
        node = nodes[i]
        world = parent @ _local_matrix(node)
        name = node.get("name", f"node{i}")
        if "mesh" in node:
            prims = []
            for p in gltf["meshes"][node["mesh"]]["primitives"]:
                if p.get("mode", 4) != 4:
                    continue
                pos = _accessor(gltf, binary, p["attributes"]["POSITION"]).astype(np.float64)
                pos = pos @ world[:3, :3].T + world[:3, 3]
                if "indices" in p:
                    tri = _accessor(gltf, binary, p["indices"]).astype(np.int64).reshape(-1, 3)
                else:
                    tri = np.arange(len(pos), dtype=np.int64).reshape(-1, 3)
                if np.linalg.det(world[:3, :3]) < 0:
                    tri = tri[:, ::-1]  # mirrored node: keep outward winding
                mat = gltf["materials"][p["material"]].get("name", "") if "material" in p else ""
                prims.append(Primitive(pos, tri, mat))
            if prims:
                out.append(MeshNode(name, list(ancestors), prims))
        for c in node.get("children", []):
            visit(c, world, [name, *ancestors])

    root = placement if placement is not None else np.eye(4)
    for i in scene.get("nodes", []):
        visit(i, root, [])
    return out
