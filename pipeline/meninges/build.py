"""Schematic cranial meninges (dura, arachnoid, pia) for both bodies.

Usage:
    python pipeline/meninges/build.py --blender /path/to/blender

No open dataset has segmented cranial meninges, so they are derived from each body's own
brain surface (BodyParts3D 4.0 for the male, HRA Visible Human Female for the female;
both CC BY 4.0) with Blender (see blender_meninges.py): the pia follows the gyri, the
arachnoid and dura are a closed envelope over the sulci offset 1.5 and 2.5 mm outward.
They are teaching schematics of where the layers lie, not anatomical segmentations, and
are labelled so (identity_source "medverse-derived", bundle source_dataset).

Outputs:
    content/generated/meninges/{structures,meshes,structure_meshes,bundles,pipeline_report}.json
    frontend/public/assets/anatomy/meninges/{male,female}-nervous.glb
"""

import argparse
import hashlib
import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("za_build", REPO / "pipeline/zanatomy/build.py")
_za = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_za)
read_mesh_nodes, write_glb, compress, body_meshes = (
    _za.read_mesh_nodes,
    _za.write_glb,
    _za.compress,
    _za.body_meshes,
)
_nearest = _za._nearest

BRAIN = "FMA:50801"
LAYERS = {
    "dura": ("FMA:71236", "cranial dura mater"),
    "arachnoid": ("FMA:83981", "cranial arachnoid mater"),
    "pia": ("FMA:78443", "cranial pia mater"),
}
BODIES = {
    "male": ("bodyparts3d", "BodyParts3D 4.0 (The Database Center for Life Science)"),
    "female": ("hra-female", "Human Reference Atlas, Visible Human Female (HuBMAP)"),
}
LICENSE = "CC BY 4.0"


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--blender", type=Path, required=True, help="Blender 4.2 LTS executable")
    ap.add_argument("--out-content", type=Path, default=REPO / "content/generated/meninges")
    ap.add_argument(
        "--out-assets", type=Path, default=REPO / "frontend/public/assets/anatomy/meninges"
    )
    ap.add_argument("--no-compress", action="store_true")
    args = ap.parse_args()
    assets_root = REPO / "frontend/public/assets/anatomy"
    args.out_assets.mkdir(parents=True, exist_ok=True)
    args.out_content.mkdir(parents=True, exist_ok=True)

    bundles, meshes, report = [], [], {}
    structure_meshes: dict[str, list[str]] = {sid: [] for sid, _ in LAYERS.values()}
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        for body, (content_dir, source) in BODIES.items():
            brain = body_meshes(REPO / "content/generated" / content_dir, assets_root, tmp, [BRAIN])
            brain_glb, out_glb = tmp / f"{body}-brain.glb", tmp / f"{body}-meninges.glb"
            write_glb(brain_glb, [{**m, "group": None} for m in brain])
            subprocess.run(  # noqa: S603 - local Blender and pipeline script
                [
                    str(args.blender),
                    "--background",
                    "--factory-startup",
                    "--python",
                    str(Path(__file__).with_name("blender_meninges.py")),
                    "--",
                    str(brain_glb),
                    str(out_glb),
                ],
                check=True,
                capture_output=True,
            )
            brain_pts = np.vstack([m["positions"] for m in brain])[::3]
            items, layer_report = [], {}
            for n in read_mesh_nodes(out_glb):
                sid, _name = LAYERS[n.name]
                pos, tris, off = [], [], 0
                for p in n.primitives:
                    pos.append(p.positions)
                    tris.append(p.triangles + off)
                    off += len(p.positions)
                v = np.vstack(pos)
                _, d = _nearest(v[::7], brain_pts)
                layer_report[n.name] = {
                    "triangles": int(sum(len(t) for t in tris)),
                    "median_distance_to_brain_mm": round(float(np.median(d) * 1000), 2),
                }
                mid = f"MEN-{body[0].upper()}-{n.name}"
                items.append(
                    {
                        "id": mid,
                        "structure_id": sid,
                        "positions": v,
                        "indices": np.vstack(tris),
                        # render group: the viewer shows meninges only on request
                        "group": n.name,  # dura | arachnoid | pia
                    }
                )
                structure_meshes[sid].append(mid)
            report[body] = layer_report
            attribution = (
                f"Schematic meninges derived by MEDVERSE from the brain surface of {source}, "
                "licensed under CC Attribution 4.0 International"
            )
            path = args.out_assets / f"{body}-nervous.glb"
            write_glb(
                path,
                items,
                generator="medverse-pipeline/meninges",
                copyright=f"{attribution} ({LICENSE})",
            )
            if not args.no_compress:
                compress(path)
            data = path.read_bytes()
            bid = f"meninges-{body}-nervous"
            bundles.append(
                {
                    "id": bid,
                    "uri": f"/assets/anatomy/meninges/{path.name}",
                    "system_id": "nervous",
                    "body_model": body,
                    "source_dataset": "Schematic cranial meninges derived from the brain "
                    "surface (not a segmentation)",
                    "license": LICENSE,
                    "attribution": attribution,
                    "version": "1.0",
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "byte_size": len(data),
                    "mesh_count": len(items),
                    "is_placeholder": False,
                }
            )
            meshes += [
                {
                    "id": m["id"],
                    "bundle_id": bid,
                    "structure_id": m["structure_id"],
                    "triangle_count": int(len(m["indices"])),
                    "render_group": m["group"],
                }
                for m in items
            ]

    structures = [
        {
            "id": sid,
            "name": name,
            "system_id": "nervous",
            "laterality": "unspecified",
            "is_compound": False,
            "identity_source": "medverse-derived",
        }
        for sid, name in LAYERS.values()
    ]

    def dump(name: str, obj) -> None:
        (args.out_content / name).write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")

    dump("structures.json", structures)
    dump("relationships.json", [])
    dump("meshes.json", meshes)
    dump("structure_meshes.json", structure_meshes)
    dump("bundles.json", bundles)
    dump("pipeline_report.json", {"method": __doc__.split("\n\n")[1], "layers": report})
    print(json.dumps(report, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
