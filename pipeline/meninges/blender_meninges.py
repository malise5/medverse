"""Blender (bpy) script: schematic cranial meninges from a brain surface.

Run with a Blender 4.2 LTS executable:
    blender --background --factory-startup --python pipeline/meninges/blender_meninges.py \
        -- BRAIN.glb OUT.glb

BRAIN.glb holds the brain meshes of one body (scene metres). Writes OUT.glb with three
meshes, all derived from that surface (none is segmented from a specimen):

- "pia": voxel remesh at 1 mm, displaced 0.3 mm outward - follows the gyri and the
  wider sulci, as the pia mater does.
- "arachnoid": voxel remesh at 5 mm (bridges the sulci, giving the closed envelope that
  the arachnoid forms over them), displaced 1.5 mm outward (subarachnoid space).
- "dura": the same envelope displaced 2.5 mm outward, lining the inside of the skull.
Each is smoothed and decimated to a triangle budget.
"""

import sys

import bpy  # type: ignore[import-not-found]

argv = sys.argv[sys.argv.index("--") + 1 :]
src, dst = argv[0], argv[1]

LAYERS = [
    # name, voxel size (m), outward offset (m), triangle budget
    ("pia", 0.001, 0.0003, 120_000),
    ("arachnoid", 0.005, 0.0015, 20_000),
    ("dura", 0.005, 0.0025, 20_000),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
brain = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

made = []
for name, voxel, offset, budget in LAYERS:
    obj = brain.copy()
    obj.data = brain.data.copy()
    obj.name = name
    bpy.context.collection.objects.link(obj)
    remesh = obj.modifiers.new("remesh", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel
    smooth = obj.modifiers.new("smooth", "SMOOTH")
    smooth.factor = 0.5
    smooth.iterations = 4
    disp = obj.modifiers.new("offset", "DISPLACE")
    disp.direction = "NORMAL"
    disp.mid_level = 0.0
    disp.strength = offset
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tris > budget:
        dec = obj.modifiers.new("decimate", "DECIMATE")
        dec.ratio = budget / tris
        bpy.ops.object.modifier_apply(modifier=dec.name)
    made.append(obj)
    print(f"{name}: {sum(len(p.vertices) - 2 for p in obj.data.polygons)} triangles")

bpy.data.objects.remove(brain)
bpy.ops.object.select_all(action="DESELECT")
for o in made:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="NONE",
    export_normals=False,
    export_texcoords=False,
    export_yup=True,
)
