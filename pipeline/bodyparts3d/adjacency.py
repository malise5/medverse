"""Mesh contact graph for BodyParts3D 4.0: which meshes touch or nearly touch.

Usage:
    python pipeline/bodyparts3d/adjacency.py --source <BodyParts3D source dir>

For every pair of meshes, computes the smallest vertex-to-vertex distance (in mm, source
coordinates) and keeps pairs closer than --max-distance. Also records each mesh's render
group (artery / vein / heart) in meshes.json so the graph can be restricted to vessels.

This is *geometric* data derived from the meshes, not curated anatomy: two meshes being
close does not prove they are connected. Consumers must present it as such. The source
meshes are decimated (99 %), so true surface distances are somewhat smaller than the
vertex distances reported here.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import (
    REPO,
    assign_owners,
    load_metadata,
    parse_obj,
    read_header_concept,
    render_group,
)


def min_distance(a: np.ndarray, b: np.ndarray, limit: float) -> float:
    """Smallest distance between point sets a and b (inf if above limit)."""
    lo = np.maximum(a.min(0), b.min(0)) - limit
    hi = np.minimum(a.max(0), b.max(0)) + limit
    a = a[np.all((a >= lo) & (a <= hi), axis=1)]
    b = b[np.all((b >= lo) & (b <= hi), axis=1)]
    if not len(a) or not len(b):
        return float("inf")
    best = float("inf")
    for i in range(0, len(a), 512):
        d = np.sqrt(((a[i : i + 512, None, :] - b[None, :, :]) ** 2).sum(-1)).min()
        best = min(best, float(d))
    return best


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--content", type=Path, default=REPO / "content/generated/bodyparts3d")
    ap.add_argument("--max-distance", type=float, default=10.0)
    args = ap.parse_args()

    meshes_path = args.content / "meshes.json"
    meshes = json.loads(meshes_path.read_text())
    known = {m["id"] for m in meshes}

    names, parents, elements = load_metadata(args.source)
    memo: dict[str, set[str]] = {}
    owners = assign_owners(elements, parents, memo)

    paths = {p.stem: p for p in args.source.rglob("*.obj") if p.stem in known}
    verts = {mid: parse_obj(path)[0] for mid, path in sorted(paths.items())}
    ids = sorted(verts)
    print(f"{len(ids)} meshes, {sum(len(v) for v in verts.values())} vertices", file=sys.stderr)

    # Candidate pairs: bounding boxes overlap once expanded by the distance limit.
    lo = np.array([verts[m].min(0) for m in ids]) - args.max_distance / 2
    hi = np.array([verts[m].max(0) for m in ids]) + args.max_distance / 2
    overlap = np.all(
        (lo[:, None, :] <= hi[None, :, :]) & (lo[None, :, :] <= hi[:, None, :]), axis=2
    )
    ii, jj = np.nonzero(np.triu(overlap, k=1))
    candidates = list(zip(ii.tolist(), jj.tolist(), strict=True))
    print(f"{len(candidates)} candidate pairs", file=sys.stderr)

    pairs = []
    for n, (i, j) in enumerate(candidates):
        if n % 20000 == 0:
            print(f"  {n}/{len(candidates)}", file=sys.stderr, flush=True)
        d = min_distance(verts[ids[i]], verts[ids[j]], args.max_distance)
        if d <= args.max_distance:
            pairs.append([ids[i], ids[j], round(d, 1)])

    out = {
        "source": "bodyparts3d-4.0",
        "method": (
            "Minimum vertex-to-vertex distance between decimated BodyParts3D meshes, in mm. "
            "Geometric proximity only; not curated connectivity."
        ),
        "max_distance_mm": args.max_distance,
        "pairs": pairs,
    }
    (args.content / "mesh_adjacency.json").write_text(json.dumps(out, separators=(",", ":")))

    # Render group per mesh (header concept is authoritative, as in build.py).
    for m in meshes:
        path = paths.get(m["id"])
        concept = read_header_concept(path) if path else None
        owner = concept if concept in names else owners.get(m["id"])
        # As in build.py, vessel classes apply to cardiovascular meshes only.
        cardiovascular = m["bundle_id"].endswith("-cardiovascular")
        m["render_group"] = (
            render_group(owner, names, parents, memo) if owner and cardiovascular else None
        )
    meshes_path.write_text(json.dumps(meshes, indent=1) + "\n")

    print(f"{len(pairs)} pairs within {args.max_distance} mm", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
