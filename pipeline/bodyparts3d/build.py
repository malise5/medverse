"""BodyParts3D 4.0 (PART-OF tree) -> MEDVERSE knowledge records + per-system GLB bundles.

Usage:
    python pipeline/bodyparts3d/build.py --source <dir with *.txt and partof/ OBJ files>

Inputs (from https://dbarchive.biosciencedbc.jp/en/bodyparts3d/, CC BY 4.0):
    partof_parts_list_e.txt            FMA concept -> English name
    partof_inclusion_relation_list.txt parent concept -> child concept
    partof_element_parts.txt           concept -> constituent mesh element files (FJxxxx)
    isa_inclusion_relation_list.txt    IS-A class hierarchy (used for system classification)
    partof/**/FJxxxx.obj               one mesh per element

Outputs:
    content/generated/bodyparts3d/{structures,relationships,meshes,structure_meshes,
                                   bundles,pipeline_report}.json
    frontend/public/assets/anatomy/bp3d-4.0/<system>.glb

Each GLB node is named by its element file ID and carries
extras.structureId = the CURIE of the most specific concept that owns the mesh, so the
renderer, API and knowledge graph share one identifier.

Coordinates: BodyParts3D uses millimetres with +x = patient's left, +y = posterior,
+z = superior. Output is metres in a Y-up scene with the body facing +Z:
(x, y, z) -> (x, z, -y) * 0.001, translated so the feet rest on y = 0 and the body is
centred on the vertical axis. This is a proper rotation (det = +1); laterality is kept.
"""

import argparse
import hashlib
import json
import shutil
import struct
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
DATASET_VERSION = "4.0"
# Pinned: EXT_meshopt_compression + KHR_mesh_quantization, preserves node names/extras.
GLTF_TRANSFORM = "@gltf-transform/cli@4.2.1"
BUNDLE_URI_PREFIX = "/assets/anatomy/bp3d-4.0"
LICENSE = "CC BY 4.0"
ATTRIBUTION = (
    "BodyParts3D, (c) The Database Center for Life Science licensed under "
    "CC Attribution 4.0 International"
)


def curie(fma: str) -> str:
    assert fma.startswith("FMA"), fma
    return f"FMA:{fma[3:]}"


def read_tsv(path: Path) -> list[list[str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [ln.split("\t") for ln in lines[1:] if ln.strip()]


# --------------------------------------------------------------------------- metadata


def load_isa_parents(src: Path) -> dict[str, set[str]]:
    isa: dict[str, set[str]] = defaultdict(set)
    path = src / "isa_inclusion_relation_list.txt"
    if path.exists():
        for p, _, c, _ in read_tsv(path):
            isa[c].add(p)
    else:
        print(
            "warning: IS-A relations not found; classification uses PART-OF only", file=sys.stderr
        )
    return isa


def load_metadata(src: Path):
    names = {r[0]: r[2].strip() for r in read_tsv(src / "partof_parts_list_e.txt")}
    parents: dict[str, set[str]] = defaultdict(set)
    for p, _, c, _ in read_tsv(src / "partof_inclusion_relation_list.txt"):
        parents[c].add(p)
    elements: dict[str, set[str]] = defaultdict(set)
    for cid, _, fj in read_tsv(src / "partof_element_parts.txt"):
        elements[cid].add(fj.strip())
    return names, parents, elements


def ancestors(cid: str, parents: dict[str, set[str]], memo: dict[str, set[str]]) -> set[str]:
    if cid in memo:
        return memo[cid]
    memo[cid] = set()  # cycle guard
    out: set[str] = set()
    for p in parents.get(cid, ()):
        out.add(p)
        out |= ancestors(p, parents, memo)
    memo[cid] = out
    return out


def assign_owners(elements, parents, memo) -> dict[str, str]:
    """Owner of an element file = the most specific concept that contains it.

    Most specific = fewest constituent elements; ties are broken by depth in the
    PART-OF tree (a descendant is more specific than its ancestor), then by ID for
    determinism.
    """
    containing: dict[str, list[str]] = defaultdict(list)
    for cid, fjs in elements.items():
        for fj in fjs:
            containing[fj].append(cid)
    owners = {}
    for fj, cids in containing.items():
        owners[fj] = min(
            cids, key=lambda c: (len(elements[c]), -len(ancestors(c, parents, memo)), c)
        )
    return owners


def classify(cid: str, systems: list[dict], parents, memo, isa_parents, isa_memo) -> str:
    """System of a concept: IS-A kind first (bone organ -> skeletal), then PART-OF lineage.

    The PART-OF tree is organised largely by body region (limbs, trunk, face), so a vein
    of the forearm is not reachable from "cardiovascular system" through PART-OF alone.
    """
    kinds = {cid} | ancestors(cid, isa_parents, isa_memo)
    for s in systems:
        if kinds & set(s.get("isa_fma", [])):
            return s["id"]
    lineage = {cid} | ancestors(cid, parents, memo)
    for s in sorted(systems, key=lambda s: s["priority"]):
        if lineage & set(s["source_fma"]):
            return s["id"]
    return "unclassified"


def render_group(cid: str, names: dict[str, str], parents, memo) -> str | None:
    """Rendering hint for vascular colouring, derived from the concept's PART-OF lineage."""
    lineage = [cid, *ancestors(cid, parents, memo)]
    if "FMA7088" in lineage:
        return "heart"
    lineage_names = [names.get(c, "").lower() for c in lineage]
    if any("vein" in n or "venous" in n or "sinus" in n for n in lineage_names):
        return "vein"
    if any("arter" in n or "aort" in n for n in lineage_names):
        return "artery"
    return None


def laterality(name: str) -> str:
    n = name.lower()
    if n.startswith("left "):
        return "left"
    if n.startswith("right "):
        return "right"
    return "unspecified"


# --------------------------------------------------------------------------- geometry


def parse_obj(path: Path) -> tuple[np.ndarray, np.ndarray, str | None]:
    """Returns (vertices, triangles, concept id from the file header if present)."""
    verts: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    concept: str | None = None
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if concept is None and line.startswith("# Concept ID :"):
                concept = line.split(":", 1)[1].strip()
            elif line.startswith("v "):
                _, x, y, z, *_ = line.split()
                verts.append((float(x), float(y), float(z)))
            elif line.startswith("f "):
                idx = [int(tok.split("/")[0]) for tok in line.split()[1:]]
                # Fan-triangulate polygons; OBJ indices are 1-based (negative = relative).
                idx = [i - 1 if i > 0 else len(verts) + i for i in idx]
                for k in range(1, len(idx) - 1):
                    faces.append([idx[0], idx[k], idx[k + 1]])
    return np.asarray(verts, dtype=np.float64), np.asarray(faces, dtype=np.uint32), concept


def read_header_concept(path: Path) -> str | None:
    with path.open(encoding="utf-8", errors="replace") as fh:
        for _, line in zip(range(40), fh, strict=False):
            if line.startswith("# Concept ID :"):
                return line.split(":", 1)[1].strip()
    return None


def to_scene(v: np.ndarray) -> np.ndarray:
    return np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1) * 0.001


def write_glb(path: Path, meshes: list[dict]) -> None:
    """Minimal glTF 2.0 binary writer: one node + mesh per element, no materials.

    Normals are omitted (computed on the client) to halve payload size.
    """
    bin_chunks: list[bytes] = []
    offset = 0
    buffer_views, accessors, gl_meshes, nodes = [], [], [], []

    def add_view(data: bytes, target: int) -> int:
        nonlocal offset
        pad = (-offset) % 4
        if pad:
            bin_chunks.append(b"\x00" * pad)
            offset += pad
        buffer_views.append(
            {"buffer": 0, "byteOffset": offset, "byteLength": len(data), "target": target}
        )
        bin_chunks.append(data)
        offset += len(data)
        return len(buffer_views) - 1

    for m in meshes:
        pos = m["positions"].astype(np.float32)
        idx = m["indices"]
        use16 = pos.shape[0] < 65536
        idx_bytes = idx.astype(np.uint16 if use16 else np.uint32).tobytes()
        pv = add_view(pos.tobytes(), 34962)
        accessors.append(
            {
                "bufferView": pv,
                "componentType": 5126,
                "count": int(pos.shape[0]),
                "type": "VEC3",
                "min": pos.min(axis=0).tolist(),
                "max": pos.max(axis=0).tolist(),
            }
        )
        pa = len(accessors) - 1
        iv = add_view(idx_bytes, 34963)
        accessors.append(
            {
                "bufferView": iv,
                "componentType": 5123 if use16 else 5125,
                "count": int(idx.size),
                "type": "SCALAR",
            }
        )
        ia = len(accessors) - 1
        gl_meshes.append(
            {"name": m["id"], "primitives": [{"attributes": {"POSITION": pa}, "indices": ia}]}
        )
        extras = {"structureId": m["structure_id"]}
        if m.get("group"):
            extras["group"] = m["group"]
        nodes.append({"name": m["id"], "mesh": len(gl_meshes) - 1, "extras": extras})

    binary = b"".join(bin_chunks)
    binary += b"\x00" * ((-len(binary)) % 4)
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "medverse-pipeline/bodyparts3d",
            "copyright": ATTRIBUTION,
        },
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": gl_meshes,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(binary)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with path.open("wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, total))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A))
        fh.write(js)
        fh.write(struct.pack("<II", len(binary), 0x004E4942))
        fh.write(binary)


def compress(path: Path) -> None:
    """Meshopt-compress a GLB in place via glTF-Transform (quantises positions)."""
    npx = shutil.which("npx")
    if npx is None:
        raise SystemExit("npx not found; install Node.js or pass --no-compress")
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / path.name
        subprocess.run(  # noqa: S603 - fixed, pinned tool and local paths
            [npx, "-y", GLTF_TRANSFORM, "meshopt", str(path), str(out)],
            check=True,
            capture_output=True,
        )
        shutil.move(out, path)


# --------------------------------------------------------------------------- main


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--out-content", type=Path, default=REPO / "content/generated/bodyparts3d")
    ap.add_argument(
        "--out-assets", type=Path, default=REPO / "frontend/public/assets/anatomy/bp3d-4.0"
    )
    ap.add_argument(
        "--no-compress", action="store_true", help="skip meshopt compression (needs npx)"
    )
    args = ap.parse_args()

    systems = json.loads((REPO / "content/systems.json").read_text())["systems"]
    names, parents, elements = load_metadata(args.source)
    isa_parents = load_isa_parents(args.source)
    memo: dict[str, set[str]] = {}
    isa_memo: dict[str, set[str]] = {}
    owners = assign_owners(elements, parents, memo)

    obj_files = {p.stem: p for p in args.source.rglob("*.obj")}
    missing_obj = sorted(set(owners) - set(obj_files))
    if missing_obj:
        print(f"warning: {len(missing_obj)} element files listed but not found", file=sys.stderr)

    # Each OBJ header names its element's concept authoritatively; the tree-derived
    # owner is the cross-check and the fallback when a header is absent.
    owner_mismatches = []
    for fj, path in obj_files.items():
        header_concept = read_header_concept(path)
        if fj in owners and header_concept in names and header_concept != owners[fj]:
            owner_mismatches.append(
                {"element": fj, "header": header_concept, "derived": owners[fj]}
            )
            owners[fj] = header_concept

    # Structures: every concept in the parts list.
    owned = set(owners.values())
    structures = []
    system_of = {}
    for cid in names:
        system_of[cid] = classify(cid, systems, parents, memo, isa_parents, isa_memo)
    # Compounds (e.g. heart, whose PART-OF parent is the regional "content of middle
    # mediastinum") take the system shared by >= 75 % of their classified meshes. Mixed
    # regions such as "trunk" fail the threshold and stay unclassified (regional).
    for cid, fjs in elements.items():
        if cid not in names or system_of[cid] != "unclassified" or len(fjs) < 2:
            continue
        votes = [system_of[owners[fj]] for fj in fjs if fj in owners]
        votes = [v for v in votes if v != "unclassified"]
        if votes:
            top = max(set(votes), key=votes.count)
            if votes.count(top) / len(votes) >= 0.75:
                system_of[cid] = top
    # Fallback: inherit from the nearest classified PART-OF ancestor (body of sternum ->
    # sternum -> skeletal). Breadth-first so the closest ancestor wins.
    for cid in names:
        if system_of[cid] != "unclassified":
            continue
        frontier, seen = sorted(parents.get(cid, ())), set()
        while frontier and system_of[cid] == "unclassified":
            nxt = []
            for p in frontier:
                if p in seen:
                    continue
                seen.add(p)
                if system_of.get(p, "unclassified") != "unclassified":
                    system_of[cid] = system_of[p]
                    break
                nxt.extend(sorted(parents.get(p, ())))
            frontier = nxt
    for cid, name in sorted(names.items(), key=lambda kv: int(kv[0][3:])):
        sys_id = system_of[cid]
        structures.append(
            {
                "id": curie(cid),
                "name": name,
                "system_id": sys_id,
                "laterality": laterality(name),
                # Not compound only if it owns its single element outright.
                "is_compound": not (len(elements.get(cid, ())) == 1 and cid in owned),
            }
        )

    relationships = [
        {"subject": curie(c), "predicate": "part_of", "object": curie(p)}
        for c, ps in sorted(parents.items())
        for p in sorted(ps)
        if c in names and p in names
    ]

    # Geometry: load and transform every element.
    raw: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    lo, hi = np.full(3, np.inf), np.full(3, -np.inf)
    for fj in sorted(owners):
        if fj not in obj_files:
            continue
        v, f, _ = parse_obj(obj_files[fj])
        if len(v) == 0 or len(f) == 0:
            print(f"warning: {fj} is empty; skipped", file=sys.stderr)
            continue
        v = to_scene(v)
        raw[fj] = (v, f)
        lo, hi = np.minimum(lo, v.min(0)), np.maximum(hi, v.max(0))
    shift = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])

    by_system: dict[str, list[dict]] = defaultdict(list)
    for fj, (v, f) in raw.items():
        owner = owners[fj]
        by_system[system_of[owner]].append(
            {
                "id": fj,
                "structure_id": curie(owner),
                "positions": v + shift,
                "indices": f,
                "group": render_group(owner, names, parents, memo)
                if system_of[owner] == "cardiovascular"
                else None,
            }
        )

    args.out_assets.mkdir(parents=True, exist_ok=True)
    args.out_content.mkdir(parents=True, exist_ok=True)
    for stale in args.out_assets.glob("*.glb"):
        if stale.stem not in by_system:
            stale.unlink()
    bundles, meshes = [], []
    for sys_id, items in sorted(by_system.items()):
        items.sort(key=lambda m: m["id"])
        path = args.out_assets / f"{sys_id}.glb"
        write_glb(path, items)
        if not args.no_compress:
            compress(path)
        data = path.read_bytes()
        bundle_id = f"bp3d-{DATASET_VERSION}-{sys_id}"
        bundles.append(
            {
                "id": bundle_id,
                "uri": f"{BUNDLE_URI_PREFIX}/{sys_id}.glb",
                "system_id": sys_id,
                "source_dataset": (
                    f"BodyParts3D {DATASET_VERSION} (PART-OF tree, 99% polygon reduction"
                    + (")" if args.no_compress else ", meshopt-compressed)")
                ),
                "license": LICENSE,
                "attribution": ATTRIBUTION,
                "version": DATASET_VERSION,
                "sha256": hashlib.sha256(data).hexdigest(),
                "byte_size": len(data),
                "mesh_count": len(items),
                "is_placeholder": False,
            }
        )
        for m in items:
            meshes.append(
                {
                    "id": m["id"],
                    "bundle_id": bundle_id,
                    "structure_id": m["structure_id"],
                    "triangle_count": int(len(m["indices"])),
                }
            )

    structure_meshes = {
        curie(cid): sorted(fj for fj in fjs if fj in raw)
        for cid, fjs in sorted(elements.items())
        if cid in names
    }
    structure_meshes = {k: v for k, v in structure_meshes.items() if v}

    def dump(name: str, obj) -> None:
        (args.out_content / name).write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")

    dump("structures.json", structures)
    dump("relationships.json", relationships)
    dump("meshes.json", meshes)
    dump("structure_meshes.json", structure_meshes)
    dump("bundles.json", bundles)
    report = {
        "dataset": f"BodyParts3D {DATASET_VERSION} PART-OF",
        "concepts": len(structures),
        "part_of_edges": len(relationships),
        "elements_listed": len(owners),
        "elements_built": len(raw),
        "elements_missing_obj": missing_obj,
        "owner_header_vs_derived_mismatches": owner_mismatches,
        "triangles": int(sum(m["triangle_count"] for m in meshes)),
        "scene_bounds_m": {
            "min": (lo + shift).round(4).tolist(),
            "max": (hi + shift).round(4).tolist(),
        },
        "per_system": {
            sys_id: {"meshes": len(items), "triangles": int(sum(len(m["indices"]) for m in items))}
            for sys_id, items in sorted(by_system.items())
        },
        "structures_per_system": {
            s: sum(1 for x in structures if x["system_id"] == s)
            for s in sorted(set(system_of.values()))
        },
    }
    dump("pipeline_report.json", report)
    print(
        json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in report.items()}, indent=1)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
