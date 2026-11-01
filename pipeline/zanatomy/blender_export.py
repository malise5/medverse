"""Blender (bpy) script: convert one Z-Anatomy FBX into a GLB plus an object inventory.

Run with a Blender 4.2 LTS executable (no install needed):
    blender --background --factory-startup \
        --python pipeline/zanatomy/blender_export.py -- IN.fbx OUT.glb

Writes OUT.glb (meshes only, transforms applied, object names preserved, no materials,
normals or UVs) and OUT.json listing every mesh object with its parent chain and size.
The pipeline then reads the GLB with pipeline/hra/glb.py like any other source.
"""

import json
import sys

import bpy  # type: ignore[import-not-found]

argv = sys.argv[sys.argv.index("--") + 1 :]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)

inventory = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    chain, p = [], obj.parent
    while p is not None:
        chain.append(p.name)
        p = p.parent
    inventory.append(
        {
            "name": obj.name,
            "parents": chain,
            "vertices": len(obj.data.vertices),
            "polygons": len(obj.data.polygons),
            "dimensions": [round(d, 5) for d in obj.dimensions],
        }
    )

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_apply=True,
    export_materials="NONE",
    export_normals=False,
    export_texcoords=False,
    export_yup=True,
    use_selection=False,
)
with open(dst.rsplit(".", 1)[0] + ".json", "w", encoding="utf-8") as fh:
    json.dump(inventory, fh, indent=1)
print(f"exported {len(inventory)} mesh objects")
