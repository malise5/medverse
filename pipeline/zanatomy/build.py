"""Z-Anatomy head supplement -> extra head structures for the male and female bodies.

Usage:
    blender --background --factory-startup --python pipeline/zanatomy/blender_export.py \
        -- SkeletalSystem100.fbx GLB_DIR/skeletal.glb          # once per Z-Anatomy FBX
    python pipeline/zanatomy/build.py --glb-dir GLB_DIR

Source: Z-Anatomy (https://www.z-anatomy.com, github.com/LluisV/Z-Anatomy), licensed
CC BY-SA 4.0 and itself derived from BodyParts3D (CC BY-SA 2.1 Japan) with brain models
from Brainder. Everything this script writes is a derivative work and is distributed
under CC BY-SA 4.0 (share-alike): the meshes go to their own bundles
(frontend/public/assets/anatomy/zanatomy/) with a licence notice, separate from the
CC BY 4.0 BodyParts3D and HRA bundles.

Only the structures listed in selection.json are used; its "male" and "female"
flags say which bodies receive each one. The list was made by comparing every Z-Anatomy
mesh in the head with the existing male build (FMA concept present with geometry, and
geometric overlap with BodyParts3D PART-OF/IS-A meshes and the SPL atlases) and keeping,
for the male, the ones the build lacks (facial expression and mastication muscles,
cranial nerves I, III, V, VI, VII, IX-XII with trigeminal branches, cranial nerve
nuclei, falx and tentorium, dural venous sinuses, facial and scalp vessels, paranasal
sinuses, parathyroid glands, lymph nodes ...). For the female, which has its own brain,
eyes, mouth and larynx but no skull, also the skull, ossicles, extraocular, neck and
pharyngeal muscles, cranial nerves II, IV, V1, VIII and the cerebral arteries.
Identities are FMA terms looked up in the FMA ontology by name.

Male: Z-Anatomy is built on the same BodyParts3D body, so a similarity registration of
its skull onto the built male skull places every mesh (residuals are reported).

Female: Z-Anatomy has no female anatomy. For the female body the same meshes are fitted
to the HRA female head: a bounded affine transform is estimated from structures both
bodies have (brain, scleras, upper and lower teeth, thyroid cartilage) and applied to
the male-derived meshes. They are an
approximation of female anatomy, labelled as such in the bundle metadata and in the
app; only structure kinds the female model lacks are added (skull, muscles, cranial
nerves, venous sinuses ...), never ones it has.

Outputs:
    content/generated/zanatomy/{structures,relationships,meshes,structure_meshes,
                                     bundles,pipeline_report}.json
    frontend/public/assets/anatomy/zanatomy/{male,female}-<system>.glb
"""

import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "pipeline" / "hra"))
sys.path.insert(0, str(REPO / "pipeline" / "spl"))
from glb import read_mesh_nodes  # noqa: E402
from register import _affine, _nearest, _sample, register  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "bp3d_build", REPO / "pipeline" / "bodyparts3d" / "build.py"
)
_bp3d = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bp3d)
_hspec = importlib.util.spec_from_file_location("hra_build", REPO / "pipeline" / "hra" / "build.py")
_hra = importlib.util.module_from_spec(_hspec)
_hspec.loader.exec_module(_hra)

compress, write_glb, laterality, GLTF_TRANSFORM = (
    _bp3d.compress,
    _bp3d.write_glb,
    _bp3d.laterality,
    _bp3d.GLTF_TRANSFORM,
)

SOURCE_FILES = ["skeletal", "muscular", "nervous", "cardio", "visceral", "lymphoid", "joints"]
LICENSE = "CC BY-SA 4.0"
ATTRIBUTION = (
    "Z-Anatomy - The open source atlas of anatomy (z-anatomy.com), CC BY-SA 4.0; "
    "derived from BodyParts3D, The Database Center for Life Science, CC BY-SA 2.1 Japan; "
    "brain models from Brainder. Meshes registered and modified by MEDVERSE"
)
FEMALE_NOTE = (
    "; fitted to the HRA Visible Human Female head from a male-derived model "
    "(approximation, not female anatomy)"
)
BUNDLE_URI_PREFIX = "/assets/anatomy/zanatomy"
BP3D_LICENSE = "CC BY 4.0"
BP3D_ATTRIBUTION = (
    "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution "
    "4.0 International; meshes fitted by MEDVERSE"
)
IDENTITY_SOURCE = "z-anatomy"
SIMPLIFY_RATIO = 0.3

# Z-Anatomy skull bones (object names) and the male structure ids they are registered to.
SKULL = {
    "Frontal bone": ["FMA:52734"],
    "Parietal bone.l": ["FMA:52789"],
    "Parietal bone.r": ["FMA:52788"],
    "Temporal bone.l": ["FMA:52739"],
    "Temporal bone.r": ["FMA:52738"],
    "Occipital bone": ["FMA:52735"],
    "Sphenoid bone": ["FMA:52736"],
    "Mandible": ["FMA:52748"],
}

# Structures present in both bodies, used to fit the male head to the female head:
# (label, male structure ids, female structure ids). Each pair is matched separately.
UPPER_TEETH = [
    "FMA:55680",
    "FMA:55681",
    "FMA:55682",
    "FMA:55683",
    "FMA:55688",
    "FMA:55689",
    "FMA:55690",
    "FMA:55691",
    "FMA:55697",
    "FMA:55698",
    "FMA:55699",
    "FMA:55700",
    "FMA:55798",
    "FMA:55799",
]
LOWER_TEETH = [
    "FMA:55686",
    "FMA:55687",
    "FMA:55692",
    "FMA:55693",
    "FMA:55694",
    "FMA:55695",
    "FMA:55703",
    "FMA:55704",
    "FMA:55705",
    "FMA:55706",
    "FMA:57140",
    "FMA:57141",
    "FMA:57142",
    "FMA:57143",
]
FEMALE_ANCHORS = [
    ("brain", ["FMA:50801"], ["FMA:50801"]),
    ("left sclera", ["FMA:58272"], ["FMA:58272"]),
    ("right sclera", ["FMA:58271"], ["FMA:58271"]),
    ("upper teeth", UPPER_TEETH, ["FMA:55634"]),
    ("lower teeth", LOWER_TEETH, ["FMA:55635"]),
    ("thyroid cartilage", ["FMA:55099"], ["FMA:55099"]),
]


def dequantize(src: Path, dst: Path) -> None:
    """Decode a meshopt-compressed bundle so pipeline/hra/glb.py can read it."""
    npx = shutil.which("npx")
    if npx is None:
        raise SystemExit("npx not found; install Node.js")
    subprocess.run(  # noqa: S603 - fixed, pinned tool and local paths
        [npx, "-y", GLTF_TRANSFORM, "dequantize", str(src), str(dst)],
        check=True,
        capture_output=True,
    )


def body_points(content: Path, assets: Path, tmp: Path, ids: list[str]) -> dict[str, np.ndarray]:
    """World-space vertices (scene metres) of the built meshes of the given structures."""
    meshes = json.loads((content / "meshes.json").read_text())
    sm = json.loads((content / "structure_meshes.json").read_text())
    bundles = {b["id"]: b for b in json.loads((content / "bundles.json").read_text())}
    wanted = {mid: sid for sid in ids for mid in sm.get(sid, [])}
    by_bundle = defaultdict(set)
    for m in meshes:
        if m["id"] in wanted:
            by_bundle[m["bundle_id"]].add(m["id"])
    out: dict[str, list[np.ndarray]] = defaultdict(list)
    for bid, mids in by_bundle.items():
        uri = bundles[bid]["uri"]
        src = assets / uri.removeprefix("/assets/anatomy/")
        dst = tmp / f"{bid}.glb"
        if not dst.exists():
            dequantize(src, dst)
        for n in read_mesh_nodes(dst):
            if n.name in mids:
                out[wanted[n.name]].append(np.concatenate([p.positions for p in n.primitives]))
    return {k: np.vstack(v) for k, v in out.items()}


def body_meshes(content: Path, assets: Path, tmp: Path, ids: list[str]) -> list[dict]:
    """Built meshes (scene metres, with triangles) of the given structures."""
    meshes = json.loads((content / "meshes.json").read_text())
    sm = json.loads((content / "structure_meshes.json").read_text())
    bundles = {b["id"]: b for b in json.loads((content / "bundles.json").read_text())}
    owner = {m["id"]: m for m in meshes}
    wanted = {mid for sid in ids for mid in sm.get(sid, [])}
    out = []
    for bid in sorted({owner[mid]["bundle_id"] for mid in wanted}):
        src = assets / bundles[bid]["uri"].removeprefix("/assets/anatomy/")
        dst = tmp / f"{bid}.glb"
        if not dst.exists():
            dequantize(src, dst)
        for n in read_mesh_nodes(dst):
            if n.name not in wanted:
                continue
            pos, tris, off = [], [], 0
            for p in n.primitives:
                pos.append(p.positions)
                tris.append(p.triangles + off)
                off += len(p.positions)
            m = owner[n.name]
            out.append(
                {
                    "id": n.name,
                    "structure_id": m["structure_id"],
                    "system_id": bundles[bid]["system_id"],
                    "positions": np.vstack(pos),
                    "indices": np.vstack(tris),
                    "group": m.get("render_group"),
                }
            )
    return out


def fit_parts(
    pairs: list[tuple[np.ndarray, np.ndarray]], iterations: int = 30, affine: bool = True
) -> np.ndarray:
    """Bounded affine fit of several corresponding point clouds (mm), each weighted equally.

    Symmetric nearest-neighbour correspondences are recomputed per part each iteration,
    so a part can only match its own counterpart.
    """
    srcs = [_sample(a, 1500, 3 + i) for i, (a, _) in enumerate(pairs)]
    dsts = [_sample(b, 4000, 11 + i) for i, (_, b) in enumerate(pairs)]
    allsrc, alldst = np.vstack(srcs), np.vstack(dsts)
    s0 = np.sqrt(
        ((alldst - alldst.mean(0)) ** 2).sum(1).mean()
        / ((allsrc - allsrc.mean(0)) ** 2).sum(1).mean()
    )
    m = np.eye(4)
    m[:3, :3] *= s0
    m[:3, 3] = alldst.mean(0) - s0 * allsrc.mean(0)
    for it in range(iterations):
        a_list, b_list = [], []
        for s, d in zip(srcs, dsts, strict=True):
            ms = s @ m[:3, :3].T + m[:3, 3]
            j, _ = _nearest(ms, d)
            k, _ = _nearest(d, ms)
            a = np.vstack([s, s[k]])
            b = np.vstack([d[j], d])
            # equal weight per part: resample to a fixed count
            sel = np.random.default_rng(it).choice(len(a), 2000, replace=len(a) < 2000)
            a_list.append(a[sel])
            b_list.append(b[sel])
        a, b = np.vstack(a_list), np.vstack(b_list)
        if it < iterations // 2 or not affine:
            from register import _umeyama  # similarity first, affine once settled

            m = _umeyama(a, b)
        else:
            m = _affine(a, b, (0.85, 1.18), float(np.cbrt(abs(np.linalg.det(m[:3, :3])))))
    return m


def residuals(pairs: list[tuple[np.ndarray, np.ndarray]], m: np.ndarray, labels: list[str]) -> dict:
    out = {}
    for label, (a, b) in zip(labels, pairs, strict=True):
        s = _sample(a, 3000, 5) @ m[:3, :3].T + m[:3, 3]
        _, d = _nearest(s, _sample(b, 8000, 6))
        out[label] = {
            "median_mm": round(float(np.median(d)), 2),
            "p90_mm": round(float(np.percentile(d, 90)), 2),
        }
    return out


def mesh_id(body: str, name: str) -> str:
    digest = hashlib.sha1(name.encode(), usedforsecurity=False).hexdigest()[:12]
    return f"ZA{body[0].upper()}-{digest}"


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--glb-dir", type=Path, required=True, help="blender_export.py outputs")
    ap.add_argument("--selection", type=Path, default=Path(__file__).with_name("selection.json"))
    ap.add_argument("--out-content", type=Path, default=REPO / "content/generated/zanatomy")
    ap.add_argument(
        "--out-assets", type=Path, default=REPO / "frontend/public/assets/anatomy/zanatomy"
    )
    ap.add_argument("--no-compress", action="store_true")
    args = ap.parse_args()

    selection_doc = json.loads(args.selection.read_text())
    selection = selection_doc["structures"]
    assets_root = REPO / "frontend/public/assets/anatomy"
    male_content = REPO / "content/generated/bodyparts3d"
    female_content = REPO / "content/generated/hra-female"
    bp3d_ids = {s["id"] for s in json.loads((male_content / "structures.json").read_text())}
    hra_ids = {s["id"] for s in json.loads((female_content / "structures.json").read_text())}
    # female structures that already have their own (female-donor) geometry
    female_has = set(json.loads((female_content / "structure_meshes.json").read_text()))
    male_has = set(json.loads((male_content / "structure_meshes.json").read_text()))

    # Z-Anatomy meshes, glTF scene axes (metres, Y up, facing +Z, patient's left = +X).
    za: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for f in SOURCE_FILES:
        for n in read_mesh_nodes(args.glb_dir / f"{f}.glb"):
            pos, tris, off = [], [], 0
            for p in n.primitives:
                pos.append(p.positions)
                tris.append(p.triangles + off)
                off += len(p.positions)
            za[n.name] = (np.vstack(pos), np.vstack(tris))

    report: dict = {"source": ATTRIBUTION}
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        # Male: similarity registration of the Z-Anatomy skull onto the built male skull.
        male_skull = body_points(
            male_content, assets_root, tmp, sorted({i for v in SKULL.values() for i in v})
        )
        src = np.vstack([za[n][0] for n in SKULL]) * 1000
        dst = np.vstack(list(male_skull.values())) * 1000
        reg = register(src, dst, similarity_iterations=40, affine_iterations=0)
        to_male = reg.matrix.copy()
        to_male[:3, 3] /= 1000  # applied to metres
        report["male_registration"] = {
            "scale": round(float(np.cbrt(np.linalg.det(reg.matrix[:3, :3]))), 4),
            "median_mm": round(reg.median_mm, 2),
            "p90_mm": round(reg.p90_mm, 2),
        }

        # Female: fit the male head onto the female head from shared structures.
        ids = sorted({i for _, m, f in FEMALE_ANCHORS for i in m + f})
        mpts = body_points(male_content, assets_root, tmp, ids)
        fpts = body_points(female_content, assets_root, tmp, ids)
        pairs, labels = [], []
        for label, mids, fids in FEMALE_ANCHORS:
            a = [mpts[i] for i in mids if i in mpts]
            b = [fpts[i] for i in fids if i in fpts]
            if a and b:
                pairs.append((np.vstack(a) * 1000, np.vstack(b) * 1000))
                labels.append(label)
        if len(pairs) < 3:
            raise SystemExit(f"too few female anchors found: {labels}")
        fit = fit_parts(pairs)
        report["female_fit"] = {
            "anchors": residuals(pairs, fit, labels),
            "linear_singular_values": np.linalg.svd(fit[:3, :3], compute_uv=False)
            .round(4)
            .tolist(),
        }
        head_m = fit.copy()
        head_m[:3, 3] /= 1000

        def male_to_female(p: np.ndarray) -> np.ndarray:
            """Male scene (m) -> female scene with the head fit."""
            return p @ head_m[:3, :3].T + head_m[:3, 3]

        # Male BodyParts3D meshes the female lacks (external ear, laryngeal muscles ...),
        # fitted the same way; they keep their CC BY 4.0 licence.
        fitted_bp3d = body_meshes(
            male_content, assets_root, tmp, selection_doc.get("female_fitted_bodyparts3d", [])
        )

    structures: dict[str, dict] = {}
    relationships: set[tuple[str, str]] = set()
    # bundle key: (body, source, system); source "za" (Z-Anatomy) or "bp3d" (fitted)
    by_bundle: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    structure_meshes: dict[str, list[str]] = defaultdict(list)
    missing = []
    for m in fitted_bp3d:
        if m["structure_id"] in female_has:
            continue
        mid = "FIT-" + m["id"]
        pos = male_to_female(m["positions"])
        by_bundle[("female", "bp3d", m["system_id"])].append({**m, "id": mid, "positions": pos})
        structure_meshes[m["structure_id"]].append(mid)
    for entry in selection:
        for obj, sid, name in entry["objects"]:
            if obj not in za:
                missing.append(obj)
                continue
            # BodyParts3D structures keep their own hierarchy.
            concept = entry.get("concept") if sid not in bp3d_ids else None
            v, f = za[obj]
            if sid not in bp3d_ids and sid not in hra_ids and sid not in structures:
                structures[sid] = {
                    "id": sid,
                    "name": name,
                    "system_id": entry["system"],
                    "laterality": laterality(name),
                    "is_compound": False,
                    "identity_source": IDENTITY_SOURCE,
                }
            if concept and concept != sid:
                # left/right structure under its generic concept ("buccinator")
                relationships.add((sid, concept))
                if concept not in bp3d_ids and concept not in hra_ids and concept not in structures:
                    structures[concept] = {
                        "id": concept,
                        "name": entry["concept_name"],
                        "system_id": entry["system"],
                        "laterality": "unspecified",
                        "is_compound": True,
                        "identity_source": IDENTITY_SOURCE,
                    }
            bodies = (["male"] if entry.get("male", True) and sid not in male_has else []) + (
                ["female"] if entry.get("female") and sid not in female_has else []
            )
            in_male = v @ to_male[:3, :3].T + to_male[:3, 3]
            for body in bodies:
                pos = in_male if body == "male" else male_to_female(in_male)
                mid = mesh_id(body, obj)
                by_bundle[(body, "za", entry["system"])].append(
                    {
                        "id": mid,
                        "structure_id": sid,
                        "positions": pos,
                        "indices": f,
                        "group": entry.get("group"),
                    }
                )
                structure_meshes[sid].append(mid)
                if concept and concept != sid:
                    structure_meshes[concept].append(mid)
    if missing:
        raise SystemExit(f"selected objects not in the Z-Anatomy export: {missing}")

    args.out_assets.mkdir(parents=True, exist_ok=True)
    args.out_content.mkdir(parents=True, exist_ok=True)
    for stale in args.out_assets.glob("*.glb"):
        stale.unlink()
    bundles, meshes = [], []
    tris_source = sum(len(m["indices"]) for items in by_bundle.values() for m in items)
    simplify_tmp = tempfile.TemporaryDirectory()
    for (body, source, sys_id), items in sorted(by_bundle.items()):
        items.sort(key=lambda m: m["id"])
        za_src = source == "za"
        # Weld + meshoptimizer simplification (Z-Anatomy meshes are dense); the error cap
        # keeps thin vessels and nerves from collapsing. BodyParts3D meshes are already
        # reduced and are copied as they are.
        if za_src:
            tris = sum(len(m["indices"]) for m in items)
            items = _hra.simplify_nodes(
                items, int(tris * SIMPLIFY_RATIO), Path(simplify_tmp.name), f"{body}-{sys_id}"
            )
        stem = f"{body}-{sys_id}" if za_src else f"{body}-fitted-bp3d-{sys_id}"
        lic = LICENSE if za_src else BP3D_LICENSE
        attribution = (ATTRIBUTION if za_src else BP3D_ATTRIBUTION) + (
            FEMALE_NOTE if body == "female" else ""
        )
        path = args.out_assets / f"{stem}.glb"
        write_glb(
            path,
            items,
            generator="medverse-pipeline/zanatomy",
            copyright=f"{attribution} ({lic})",
        )
        if not args.no_compress:
            compress(path)
        data = path.read_bytes()
        bid = f"zanatomy-{stem}" if za_src else f"fitted-{stem}"
        dataset = "Z-Anatomy head supplement" if za_src else "BodyParts3D 4.0 head meshes"
        bundles.append(
            {
                "id": bid,
                "uri": f"{BUNDLE_URI_PREFIX}/{path.name}",
                "system_id": sys_id,
                "body_model": body,
                "source_dataset": dataset
                + (
                    " (fitted to the female head from a male-derived model)"
                    if body == "female"
                    else ""
                ),
                "license": lic,
                "attribution": attribution,
                "version": "1.0",
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
                    "bundle_id": bid,
                    "structure_id": m["structure_id"],
                    "triangle_count": int(len(m["indices"])),
                    "render_group": m["group"],
                }
            )

    known = bp3d_ids | hra_ids | set(structures)
    rels = [
        {"subject": s, "predicate": "part_of", "object": o}
        for s, o in sorted(relationships)
        if s in known and o in known
    ]

    def dump(name: str, obj) -> None:
        (args.out_content / name).write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")

    dump("structures.json", sorted(structures.values(), key=lambda s: s["id"]))
    dump("relationships.json", rels)
    dump("meshes.json", meshes)
    dump("structure_meshes.json", {k: sorted(v) for k, v in sorted(structure_meshes.items())})
    dump("bundles.json", bundles)
    report.update(
        {
            "selected_entries": len(selection),
            "new_structures": len(structures),
            "meshes": {
                body: sum(1 for m in meshes if m["id"].startswith(f"ZA{body[0].upper()}-"))
                for body in ("male", "female")
            }
            | {"female_fitted_bodyparts3d": sum(1 for m in meshes if m["id"].startswith("FIT-"))},
            "triangles_source": int(tris_source),
            "triangles": int(sum(m["triangle_count"] for m in meshes)),
            "per_bundle": {b["id"]: b["mesh_count"] for b in bundles},
        }
    )
    dump("pipeline_report.json", report)
    print(json.dumps(report, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
