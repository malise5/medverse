"""HuBMAP Human Reference Atlas, Visible Human Female -> MEDVERSE female body model.

Usage:
    python pipeline/hra/fetch.py --dest SRC        # once, downloads the inputs
    python pipeline/hra/build.py --source SRC      # builds bundles + knowledge records

The female body is built from the 3D reference organs of the Human Reference Atlas
(HRA), segmented from the Visible Human Female dataset, so its internal anatomy comes
from a female donor (it is not a modified copy of the male model). Every organ dataset
must be licensed CC BY 4.0; the build stops otherwise.

Identity: each mesh node is mapped to an ontology term through the HRA ASCT+B
crosswalk. FMA terms are used as-is; UBERON terms are converted to FMA when Uberon gives
exactly one FMA cross-reference, so female meshes attach to the same knowledge-graph
structures (and therefore the same content, search entries and quizzes) as the male
model. Terms without an FMA equivalent become UBERON:* structures; nodes without any
mapping are attached to their nearest mapped ancestor (usually the organ).

Coordinates: the HRA female scene is metres, Y-up, facing +Z, patient's left = +X,
which is already the MEDVERSE convention; the body is translated so the feet rest on
y = 0 and it is centred on the vertical axis. Organ placements in the scene are applied.

Geometry: vertices are welded and each organ file is simplified with meshoptimizer
(glTF-Transform `simplify`) to a per-organ triangle budget, then bundled per system and
meshopt-compressed, as for the male model.

Outputs:
    content/generated/hra-female/{structures,relationships,meshes,structure_meshes,
                                  bundles,pipeline_report}.json
    frontend/public/assets/anatomy/hra-vhf/<system>.glb
"""

import argparse
import csv
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from glb import read_mesh_nodes  # noqa: E402

# Shared GLB writer and compressor from the male pipeline (same output format).
_spec = importlib.util.spec_from_file_location(
    "bp3d_build", Path(__file__).resolve().parents[1] / "bodyparts3d" / "build.py"
)
_bp3d = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bp3d)
compress, write_glb = _bp3d.compress, _bp3d.write_glb

REPO = Path(__file__).resolve().parents[2]
BODY_MODEL = "female"
BUNDLE_URI_PREFIX = "/assets/anatomy/hra-vhf"
LICENSE = "CC BY 4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
ATTRIBUTION = (
    "Human Reference Atlas 3D Reference Object Library (HuBMAP), Visible Human Female; "
    "licensed under CC Attribution 4.0 International. Organ-level citations in "
    "content/generated/hra-female/pipeline_report.json"
)
GLTF_TRANSFORM = "@gltf-transform/cli@4.2.1"

# Organ file -> (default system, triangle budget after simplification). Files not listed
# are excluded: the full-term placenta (pregnancy-specific, not part of the default body)
# and the subcutaneous adipose sample blocks.
ORGANS: dict[str, tuple[str, int]] = {
    "3d-vh-f-skin": ("integumentary", 160_000),
    # Breasts: TA2 lists them with the integument, but they are layered with the female
    # reproductive organs in 3D so the skin can be hidden without hiding them.
    "3d-vh-f-mammary-gland-l": ("reproductive", 45_000),
    "3d-vh-f-mammary-gland-r": ("reproductive", 45_000),
    "3d-allen-f-brain": ("nervous", 180_000),
    "3d-vh-f-spinal-cord": ("nervous", 50_000),
    "3d-vh-f-eye-l": ("special_senses", 30_000),
    "3d-vh-f-eye-r": ("special_senses", 30_000),
    "3d-vh-f-blood-vasculature": ("cardiovascular", 220_000),
    "3d-vh-f-heart": ("cardiovascular", 85_000),
    "3d-vh-f-lung": ("respiratory", 130_000),
    "3d-vh-f-main-bronchus": ("respiratory", 20_000),
    "3d-vh-f-trachea": ("respiratory", 20_000),
    "3d-vh-f-larynx": ("respiratory", 17_000),
    "3d-vh-f-mouth": ("digestive", 90_000),
    "3d-vh-f-liver": ("digestive", 80_000),
    "3d-vh-f-pancreas": ("digestive", 13_000),
    "3d-vh-f-small-intestine": ("digestive", 44_000),
    "3d-sbu-f-large-intestine": ("digestive", 21_000),
    "3d-vh-f-omentum": ("digestive", 30_000),
    "3d-vh-f-epiploic-appendage-of-transverse-colon": ("digestive", 5_000),
    "3d-vh-f-kidney-l": ("urinary", 60_000),
    "3d-vh-f-kidney-r": ("urinary", 60_000),
    "3d-vh-f-renal-pelvis-l": ("urinary", 3_500),
    "3d-vh-f-renal-pelvis-r": ("urinary", 3_500),
    "3d-vh-f-ureter-l": ("urinary", 25_000),
    "3d-vh-f-ureter-r": ("urinary", 25_000),
    "3d-vh-f-urinary-bladder": ("urinary", 30_000),
    "3d-vh-f-uterus": ("reproductive", 41_000),
    "3d-vh-f-ovary-l": ("reproductive", 1_000),
    "3d-vh-f-ovary-r": ("reproductive", 1_000),
    "3d-vh-f-fallopian-tube-l": ("reproductive", 18_500),
    "3d-vh-f-fallopian-tube-r": ("reproductive", 18_500),
    "3d-vh-f-pelvis": ("skeletal", 70_000),
    "3d-vh-f-knee-l": ("skeletal", 18_000),
    "3d-vh-f-knee-r": ("skeletal", 18_000),
    "3d-vh-f-sternum": ("skeletal", 8_600),
    "3d-vh-f-manubrium": ("skeletal", 5_100),
    "3d-vh-f-intervertebral-disk": ("skeletal", 60_000),
    "3d-vh-f-spleen": ("lymphatic", 8_600),
    "3d-vh-f-thymus": ("lymphatic", 3_900),
    "3d-vh-f-palatine-tonsil-l": ("lymphatic", 8_000),
    "3d-vh-f-palatine-tonsil-r": ("lymphatic", 8_000),
    "3d-nih-f-lymph-node": ("lymphatic", 15_000),
}
EXCLUDED = {"3d-vh-f-placenta-full-term", "3d-vh-f-adipose"}

CURIE = re.compile(r"^(FMA|UBERON):(\d+)$")
VESSEL = re.compile(r"arter|vein|vena|aorta|_trunk|sinus_venosus|vessel", re.I)


def read_crosswalk(path: Path) -> dict[str, dict]:
    rows = list(csv.reader(path.open(encoding="utf-8")))
    start = next(i for i, r in enumerate(rows) if r and r[0] == "anatomical_structure_of")
    cols = rows[start]
    out = {}
    for r in rows[start + 1 :]:
        rec = dict(zip(cols, r, strict=False))
        if rec.get("node_name"):
            out[rec["node_name"]] = rec
    return out


def read_uberon_fma(path: Path) -> dict[str, str]:
    """UBERON id -> FMA CURIE, only where Uberon lists exactly one FMA cross-reference."""
    xrefs: dict[str, set[str]] = defaultdict(set)
    current = None
    for line in path.open(encoding="utf-8"):
        if line.startswith("[Term]"):
            current = None
        elif line.startswith("id: UBERON:"):
            current = line[4:].strip()
        elif current and line.startswith("xref: FMA:"):
            fma = line[6:].split()[0]
            if re.fullmatch(r"FMA:\d+", fma):
                xrefs[current].add(fma)
    return {u: next(iter(f)) for u, f in xrefs.items() if len(f) == 1}


def laterality(label: str) -> str:
    """From the term's label only: node suffixes (_L/_R) also mark non-lateral shared terms."""
    low = f" {label.lower()} "
    if " left " in low:
        return "left"
    if " right " in low:
        return "right"
    return "unspecified"


def vessel_group(node: str, material: str) -> str | None:
    n, m = node.lower(), material.lower()
    if "vein" in n or "vena" in n or "sinus" in n or "vein" in m:
        return "vein"
    if "arter" in n or "aorta" in n or "trunk" in n or "arter" in m:
        return "artery"
    return None


def run_tool(*args: str) -> None:
    npx = shutil.which("npx")
    if npx is None:
        raise SystemExit("npx not found; install Node.js")
    subprocess.run([npx, "-y", GLTF_TRANSFORM, *args], check=True, capture_output=True)  # noqa: S603


def simplify_nodes(nodes: list[dict], budget: int, tmp: Path, stem: str) -> list[dict]:
    """Weld + simplify one organ's meshes with meshoptimizer; node names are preserved."""
    tris = sum(len(n["indices"]) for n in nodes)
    raw, welded, out = tmp / f"{stem}.glb", tmp / f"{stem}.w.glb", tmp / f"{stem}.s.glb"
    write_glb(raw, nodes, generator="medverse-pipeline/hra", copyright=ATTRIBUTION)
    run_tool("weld", str(raw), str(welded))
    if tris > budget:
        ratio = max(0.02, budget / tris)
        run_tool(
            "simplify",
            str(welded),
            str(out),
            "--ratio",
            f"{ratio:.4f}",
            "--error",
            "0.004",
        )
    else:
        out = welded
    by_name = {n["id"]: n for n in nodes}
    result = []
    for mn in read_mesh_nodes(out):
        src = by_name[mn.name]
        pos = np.concatenate([p.positions for p in mn.primitives])
        offsets = np.cumsum([0] + [len(p.positions) for p in mn.primitives[:-1]])
        idx = np.concatenate([p.triangles + o for p, o in zip(mn.primitives, offsets, strict=True)])
        if len(idx):
            result.append({**src, "positions": pos, "indices": idx})
    return result


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--out-content", type=Path, default=REPO / "content/generated/hra-female")
    ap.add_argument(
        "--out-assets",
        type=Path,
        default=REPO / "frontend/public/assets/anatomy/hra-vhf",
    )
    ap.add_argument("--no-compress", action="store_true")
    args = ap.parse_args()
    src: Path = args.source

    meta = json.loads((src / "organ-metadata.json").read_text())
    scene = [
        n for n in json.loads((src / "scene-female.json").read_text()) if n.get("sex") == "Female"
    ]
    xw = read_crosswalk(src / "crosswalk.csv")
    uberon_fma = read_uberon_fma(src / "uberon-base.obo")

    # Male model (BodyParts3D) knowledge records: shared structure IDs and PART-OF tree.
    bp3d_dir = REPO / "content/generated/bodyparts3d"
    bp3d = {s["id"]: s for s in json.loads((bp3d_dir / "structures.json").read_text())}
    parents: dict[str, set[str]] = defaultdict(set)
    for r in json.loads((bp3d_dir / "relationships.json").read_text()):
        if r["predicate"] == "part_of":
            parents[r["subject"]].add(r["object"])

    report: dict = {
        "organs": [],
        "unmapped_nodes": [],
        "uberon_kept": [],
        "licence_failures": [],
    }
    new_structures: dict[str, dict] = {}
    new_parents: dict[str, str] = {}
    parent_candidates: dict[str, set[str]] = defaultdict(set)

    def resolve_term(node: str) -> str | None:
        rec = xw.get(node)
        if not rec:
            return None
        oid = rec.get("OntologyID", "").strip()
        m = CURIE.match(oid)
        if not m:
            return None
        if m.group(1) == "FMA":
            return oid
        return uberon_fma.get(oid, oid)

    def ensure_structure(sid: str, node: str, system: str) -> None:
        if sid in bp3d or sid in new_structures:
            return
        label = (xw.get(node) or {}).get("label", "").strip()
        if label in ("", "-"):
            label = re.sub(r"^(VH_F_|Allen_|Yao_)", "", node).replace("_", " ").strip() or sid
        if sid.startswith("UBERON:"):
            report["uberon_kept"].append(sid)
        new_structures[sid] = {
            "id": sid,
            "name": label[0].lower() + label[1:] if not label[:2].isupper() else label,
            "system_id": system,
            "laterality": laterality(label),
            "is_compound": False,
        }

    # Translate so the feet rest on y = 0 and the body is centred, using the skin.
    skin_nodes = read_mesh_nodes(src / "organs" / "3d-vh-f-skin.glb")
    pts = np.concatenate([p.positions for n in skin_nodes for p in n.primitives])
    lo, hi = pts.min(0), pts.max(0)
    shift = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    report["body_height_m"] = round(float(hi[1] - lo[1]), 3)

    by_system: dict[str, list[dict]] = defaultdict(list)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        for entry in scene:
            stem = entry["scenegraph"].rsplit("/", 1)[1].removesuffix(".glb")
            if stem in EXCLUDED:
                continue
            if stem not in ORGANS:
                raise SystemExit(f"organ file {stem} is neither configured nor excluded")
            info = meta[entry["reference_organ"]]
            if info.get("license") != LICENSE_URL:
                report["licence_failures"].append(stem)
                continue
            system, budget = ORGANS[stem]
            placement = np.array(
                entry.get("transformMatrix", np.eye(4).flatten()), dtype=np.float64
            )
            placement = placement.reshape(4, 4).T
            organ_root = resolve_term(entry.get("scenegraphNode", "")) or resolve_term(
                entry.get("tooltip") or ""
            )
            nodes = []
            for mn in read_mesh_nodes(src / "organs" / f"{stem}.glb", placement):
                sid = resolve_term(mn.name)
                owner_node = mn.name
                if sid is None:
                    for anc in mn.parent_names:
                        sid = resolve_term(anc)
                        if sid:
                            owner_node = anc
                            break
                if sid is None:
                    sid, owner_node = organ_root, entry.get("scenegraphNode", "")
                if sid is None:
                    report["unmapped_nodes"].append(f"{stem}:{mn.name} (dropped)")
                    continue
                if owner_node != mn.name or resolve_term(mn.name) is None:
                    report["unmapped_nodes"].append(f"{stem}:{mn.name} -> {sid}")
                # The organ file decides the system (a lung segment is respiratory even if
                # the male source classed it otherwise); vessels inside any organ are
                # cardiovascular. New structures take the same system.
                node_system = "cardiovascular" if VESSEL.search(mn.name) else system
                ensure_structure(sid, owner_node, node_system)
                # PART-OF for new structures: nearest mapped ancestor, else the organ. A
                # non-lateral part (e.g. "kidney capsule") seen in both the left and the
                # right organ file is resolved to their common ancestor after the loop.
                if sid in new_structures:
                    parent, parent_node = next(
                        ((t, a) for a in mn.parent_names if (t := resolve_term(a)) and t != sid),
                        (None, None),
                    )
                    if parent is None and organ_root and organ_root != sid:
                        parent, parent_node = (
                            organ_root,
                            entry.get("scenegraphNode", ""),
                        )
                    if parent:
                        if parent not in bp3d:
                            # named after the node that maps to it, not after the organ
                            ensure_structure(parent, parent_node, system)
                        parent_candidates[sid].add(parent)
                pos = np.concatenate([p.positions for p in mn.primitives]) + shift
                offsets = np.cumsum([0] + [len(p.positions) for p in mn.primitives[:-1]])
                idx = np.concatenate(
                    [p.triangles + o for p, o in zip(mn.primitives, offsets, strict=True)]
                )
                material = mn.primitives[0].material
                mesh_id = "VHF-" + hashlib.sha256(f"{stem}/{mn.name}".encode()).hexdigest()[:12]
                nodes.append(
                    {
                        "id": mesh_id,
                        "source_node": mn.name,
                        "structure_id": sid,
                        "system": node_system,
                        "positions": pos,
                        "indices": idx,
                        "group": vessel_group(mn.name, material)
                        if node_system == "cardiovascular"
                        else None,
                        # the organ this file depicts (e.g. right kidney) owns all its meshes
                        "organ": organ_root,
                    }
                )
            before = sum(len(n["indices"]) for n in nodes)
            nodes = simplify_nodes(nodes, budget, tmp, stem)
            after = sum(len(n["indices"]) for n in nodes)
            for n in nodes:
                by_system[n["system"]].append(n)
            report["organs"].append(
                {
                    "file": stem,
                    "dataset": info["dataset"],
                    "citation": info["citation"],
                    "doi": info["doi"],
                    "license": LICENSE,
                    "meshes": len(nodes),
                    "triangles_source": before,
                    "triangles_built": after,
                }
            )
    if report["licence_failures"]:
        raise SystemExit(f"organs without CC BY 4.0: {report['licence_failures']}")

    def ancestry(start: str) -> dict[str, int]:
        """Ancestors of a structure with their distance (male tree + resolved new parents)."""
        dist, frontier = {start: 0}, [start]
        while frontier:
            nxt = []
            for s in frontier:
                ups = set(parents.get(s, ())) | ({new_parents[s]} if s in new_parents else set())
                for p in ups:
                    if p not in dist:
                        dist[p] = dist[s] + 1
                        nxt.append(p)
            frontier = nxt
        return dist

    for sid, cands in parent_candidates.items():
        if len(cands) == 1:
            new_parents[sid] = next(iter(cands))
    for sid, cands in parent_candidates.items():
        if len(cands) > 1:
            maps = [ancestry(c) for c in cands]
            common = set.intersection(*(set(m) for m in maps))
            if common:
                new_parents[sid] = min(common, key=lambda c: max(m[c] for m in maps))
            report.setdefault("bilateral_parts", []).append(sid)
    for sid, parent in list(new_parents.items()):
        if parent == sid:
            del new_parents[sid]

    args.out_assets.mkdir(parents=True, exist_ok=True)
    args.out_content.mkdir(parents=True, exist_ok=True)
    for stale in args.out_assets.glob("*.glb"):
        if stale.stem not in by_system:
            stale.unlink()
    bundles, meshes = [], []
    organ_of: dict[str, str | None] = {}
    for sys_id, items in sorted(by_system.items()):
        items.sort(key=lambda m: m["id"])
        path = args.out_assets / f"{sys_id}.glb"
        write_glb(path, items, generator="medverse-pipeline/hra", copyright=ATTRIBUTION)
        if not args.no_compress:
            compress(path)
        data = path.read_bytes()
        bundle_id = f"hra-vhf-{sys_id}"
        bundles.append(
            {
                "id": bundle_id,
                "uri": f"{BUNDLE_URI_PREFIX}/{sys_id}.glb",
                "system_id": sys_id,
                "body_model": BODY_MODEL,
                "source_dataset": "Human Reference Atlas 3D reference organs, Visible Human Female "
                "(meshoptimizer-simplified, meshopt-compressed)",
                "license": LICENSE,
                "attribution": ATTRIBUTION,
                "version": "HRA 2026",
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
            organ_of[m["id"]] = m.get("organ")

    # Structure -> meshes, transitively over PART-OF (male tree + new female structures).
    all_parents = defaultdict(set, {k: set(v) for k, v in parents.items()})
    for sid, p in new_parents.items():
        all_parents[sid].add(p)
    structure_meshes: dict[str, list[str]] = defaultdict(list)
    for m in meshes:
        seen, stack = (
            set(),
            [m["structure_id"]] + ([organ_of[m["id"]]] if organ_of.get(m["id"]) else []),
        )
        while stack:
            s = stack.pop()
            if s in seen:
                continue
            seen.add(s)
            structure_meshes[s].append(m["id"])
            stack.extend(all_parents.get(s, ()))

    relationships = [
        {"subject": s, "predicate": "part_of", "object": p} for s, p in sorted(new_parents.items())
    ]
    report["source_nodes"] = {
        n["id"]: n["source_node"] for items in by_system.values() for n in items
    }
    report["counts"] = {
        "meshes": len(meshes),
        "triangles": sum(m["triangle_count"] for m in meshes),
        "new_structures": len(new_structures),
        "shared_structures": len({m["structure_id"] for m in meshes} & set(bp3d)),
        "bytes": sum(b["byte_size"] for b in bundles),
    }

    def dump(name: str, obj) -> None:
        (args.out_content / name).write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")

    dump("structures.json", sorted(new_structures.values(), key=lambda s: s["id"]))
    dump("relationships.json", relationships)
    dump("meshes.json", meshes)
    dump(
        "structure_meshes.json",
        {k: sorted(v) for k, v in sorted(structure_meshes.items())},
    )
    dump("bundles.json", bundles)
    report["unmapped_nodes"] = sorted({u for u in report["unmapped_nodes"] if u})
    report["uberon_kept"] = sorted(set(report["uberon_kept"]))
    dump("pipeline_report.json", report)
    print(json.dumps(report["counts"], indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
