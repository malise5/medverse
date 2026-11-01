"""Extra head structures for the male body, merged into the BodyParts3D build.

Two sources, both placed in BodyParts3D source coordinates (mm, +x left, +y posterior,
+z superior) before the build applies its common scene transform:

1. BodyParts3D IS-A tree elements (same dataset and licence, CC BY 4.0). The PART-OF
   tree used for the body omits ~1,000 meshes that only appear in the IS-A tree, among
   them the teeth, cranial nerve branches, thalamus, corpus callosum, cranial dura mater,
   external ear and pharyngeal muscles. Elements whose centroid lies in the head region
   are added; generic subdivisions ("region of", "wall of" …) that duplicate other
   meshes are skipped.

2. SPL/NAC atlases (Harvard Surgical Planning Laboratory, 3D Slicer License, Part B):
   the Head and Neck atlas (temporalis, masseter, zygomaticus major, parotid glands,
   external carotid arteries, thyroid gland) and the Inner Ear atlas (bony labyrinth,
   auditory ossicles, tympanic membrane, middle-ear muscles, facial, cochlear and
   vestibular nerves). They come from other individuals, so a reference bone is
   registered onto the matching BodyParts3D bone (see pipeline/spl/register.py) and the
   same transform places the soft tissue. The inner-ear atlas is a right ear; the left
   ear is its mirror image. Residuals are reported, and every atlas-derived mesh is
   marked as modified from the original atlas, as the licence requires.
"""

import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "spl"))
from register import register  # noqa: E402
from vtk import read_polydata  # noqa: E402

RAS_TO_LPS = np.array([-1.0, -1.0, 1.0])  # Slicer RAS -> BodyParts3D (+x left, +y posterior)
MIRROR_X = np.array([-1.0, 1.0, 1.0])

# Head region: from 40 mm below the lowest point of the mandible to the vertex.
HEAD_MARGIN_BELOW_MANDIBLE_MM = 40.0

ISA_SKIP = re.compile(
    r"^(region|subdivision|wall|set|segment) of |facial hair|space|incisure|interosseous|"
    r"infraspinatus|septal branch|cricothyroid|thyrohyoid|sternohyoid|sternothyroid|omohyoid",
    re.IGNORECASE,
)

SKULL_BONES = [
    "frontal bone",
    "left parietal bone",
    "right parietal bone",
    "left temporal bone",
    "right temporal bone",
    "occipital bone",
    "sphenoid bone",
    "ethmoid",
    "left maxilla",
    "right maxilla",
    "left zygomatic bone",
    "right zygomatic bone",
    "left nasal bone",
    "right nasal bone",
    "left lacrimal bone",
    "right lacrimal bone",
    "left palatine bone",
    "right palatine bone",
    "vomer",
    "mandible",
    "left inferior nasal concha",
    "right inferior nasal concha",
]

# (atlas model file, FMA concept, structure name, system, side, vessel group)
HEAD_NECK_MODELS = [
    ("Model_51_left_temporalis_muscle.vtk", "FMA49006", "temporalis", "muscular", "left", None),
    ("Model_52_right_temporalis_muscle.vtk", "FMA49006", "temporalis", "muscular", "right", None),
    ("Model_55_left_masseter_muscle.vtk", "FMA48996", "masseter", "muscular", "left", None),
    ("Model_56_right_masseter_muscle.vtk", "FMA48996", "masseter", "muscular", "right", None),
    (
        "Model_63_left_zygomatic_muscle.vtk",
        "FMA46810",
        "zygomaticus major",
        "muscular",
        "left",
        None,
    ),
    (
        "Model_64_right_zygomatic_muscle.vtk",
        "FMA46810",
        "zygomaticus major",
        "muscular",
        "right",
        None,
    ),
    ("Model_49_left_parotid_gland.vtk", "FMA59790", "parotid gland", "digestive", "left", None),
    ("Model_50_right_parotid_gland.vtk", "FMA59790", "parotid gland", "digestive", "right", None),
    (
        "Model_111_right_external_carotid.vtk",
        "FMA10635",
        "external carotid artery",
        "cardiovascular",
        "right",
        "artery",
    ),
    (
        "Model_112_left_external_carotid.vtk",
        "FMA10635",
        "external carotid artery",
        "cardiovascular",
        "left",
        "artery",
    ),
    ("Model_118_thyroid_gland.vtk", "FMA9603", "thyroid gland", "endocrine", None, None),
]

INNER_EAR_MODELS = [
    ("Model_10_Labyrinth.vtk", "FMA60179", "bony labyrinth", "special_senses", None),
    ("Model_12_Fenestra_Rotunda.vtk", "FMA56932", "round window", "special_senses", None),
    ("Model_140_Malleus_Bone.vtk", "FMA52753", "malleus", "special_senses", None),
    ("Model_14_Incus_Bone.vtk", "FMA52752", "incus", "special_senses", None),
    ("Model_17_Stapes_Bone.vtk", "FMA52751", "stapes", "special_senses", None),
    ("Model_4_Tympanic_Membrane.vtk", "FMA9595", "tympanic membrane", "special_senses", None),
    ("Model_19_Tensor_Tympani_Muscle.vtk", "FMA49028", "tensor tympani", "special_senses", None),
    ("Model_28_Stapedius_Muscle.vtk", "FMA49027", "stapedius", "special_senses", None),
    ("Model_5_Facial_Nerve.vtk", "FMA50868", "facial nerve", "nervous", None),
    ("Model_9_Cochlear_Nerve.vtk", "FMA53431", "cochlear nerve", "nervous", None),
    ("Model_25_Vestibular_Nerve.vtk", "FMA53401", "vestibular nerve", "nervous", None),
]

SPL_ATTRIBUTION = (
    "SPL Head and Neck Atlas and SPL Inner Ear Atlas (Surgical Planning Laboratory, Brigham "
    "and Women's Hospital), obtained under the 3D Slicer License Part B; meshes registered "
    "to BodyParts3D and modified by MEDVERSE"
)


# Fallback system by name for IS-A concepts whose IS-A lineage does not reach a system
# class (brain nuclei, teeth, laryngeal cartilages …). Ordered: first match wins.
NAME_SYSTEM_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\btooth\b|sublingual gland", re.I), "digestive"),
    (re.compile(r"retina|corona ciliaris|external ear", re.I), "special_senses"),
    (re.compile(r"eyebrow|hair of head", re.I), "integumentary"),
    (re.compile(r"arter", re.I), "cardiovascular"),
    (re.compile(r"nerve|ganglion|optic chiasm|optic tract", re.I), "nervous"),
    (
        re.compile(
            r"thalamus|amygdala|caudate|putamen|globus pallidus|fornix|commissure|geniculate|"
            r"mammillary|stria |septum of telencephalon|lamina terminalis|corpus callosum|"
            r"choroid plexus|colliculus|peduncle of midbrain",
            re.I,
        ),
        "nervous",
    ),
    (re.compile(r"larynx|vocal|conus elasticus|epiglott", re.I), "respiratory"),
    (
        re.compile(
            r"check ligament|common tendinous ring|trochlea of|tendon of|trapezius|"
            r"intermediate tendon|raphe|stylohyoid ligament",
            re.I,
        ),
        "muscular",
    ),
]


def system_by_name(name: str) -> str | None:
    for rx, system in NAME_SYSTEM_RULES:
        if rx.search(name):
            return system
    return None


def _rows(path: Path) -> list[list[str]]:
    return [line.rstrip("\n").split("\t") for line in path.open(encoding="utf-8")][1:]


def head_floor_mm(bone_vertices: dict[str, np.ndarray]) -> float:
    return float(bone_vertices["mandible"][:, 2].min()) - HEAD_MARGIN_BELOW_MANDIBLE_MM


def isa_head_elements(
    source: Path, isa_dir: Path, part_names: dict[str, str], floor_z: float, parse_obj
):
    """IS-A-only elements in the head region, with their most specific owning concept."""
    part_elements = {r[2] for r in _rows(source / "partof_element_parts.txt")}
    isa_names = {r[0]: r[2] for r in _rows(source / "isa_parts_list_e.txt")}
    by_concept: dict[str, set[str]] = defaultdict(set)
    for c, _n, fj in _rows(source / "isa_element_parts.txt"):
        by_concept[c].add(fj)
    owner: dict[str, str] = {}
    for c, fjs in by_concept.items():
        for fj in fjs:
            if fj in part_elements:
                continue
            if fj not in owner or len(by_concept[c]) < len(by_concept[owner[fj]]):
                owner[fj] = c
    objs = {p.stem: p for p in isa_dir.rglob("FJ*.obj")}
    name_to_cid = {**{n: c for c, n in isa_names.items()}, **{n: c for c, n in part_names.items()}}
    out, skipped = [], defaultdict(int)
    for fj, cid in sorted(owner.items()):
        name = isa_names.get(cid, cid)
        if fj not in objs:
            skipped["no geometry"] += 1
            continue
        if ISA_SKIP.search(name):
            skipped["generic subdivision or neck"] += 1
            continue
        v, f, _ = parse_obj(objs[fj])
        if len(f) == 0 or v[:, 2].mean() < floor_z:
            skipped["outside head"] += 1
            continue
        # PART-OF parent by name: "middle temporal branch of left middle cerebral artery"
        # -> "left middle cerebral artery" when that structure exists.
        parent = None
        if " of " in name:
            tail = name.rsplit(" of ", 1)[1]
            parent = name_to_cid.get(tail)
        out.append(
            {
                "element": fj,
                "concept": cid,
                "name": name,
                "vertices": v,
                "faces": f,
                "parent": parent,
                "source": "isa",
            }
        )
    return out, dict(skipped)


def _zip_model(z: zipfile.ZipFile, name: str) -> tuple[np.ndarray, np.ndarray]:
    member = next(x for x in z.namelist() if x.endswith("/" + name) or x == name)
    return read_polydata(z.read(member))


def spl_head_elements(
    head_neck_zip: Path, inner_ear_zip: Path, bone_vertices: dict[str, np.ndarray]
):
    """Register the SPL atlases onto the BodyParts3D skull and return placed meshes."""
    out, report = [], {}
    target_skull = np.vstack([bone_vertices[b] for b in SKULL_BONES])

    with zipfile.ZipFile(head_neck_zip) as z:
        ref = np.vstack(
            [_zip_model(z, "Model_10_skull.vtk")[0], _zip_model(z, "Model_25_mandible.vtk")[0]]
        )
        reg = register(ref * RAS_TO_LPS, target_skull)
        report["head_neck"] = {
            "reference": "skull + mandible -> 22 BodyParts3D cranial bones",
            "rms_mm": round(reg.rms_mm, 2),
            "median_mm": round(reg.median_mm, 2),
            "p90_mm": round(reg.p90_mm, 2),
        }
        for i, (fname, cid, name, system, side, group) in enumerate(HEAD_NECK_MODELS):
            v, f = _zip_model(z, fname)
            out.append(
                {
                    "element": f"SPLHN{i:02d}",
                    "concept": cid,
                    "name": name,
                    "system": system,
                    "side": side,
                    "group": group,
                    "vertices": reg.apply(v * RAS_TO_LPS),
                    "faces": f,
                    "source": "spl-head-neck",
                }
            )

    with zipfile.ZipFile(inner_ear_zip) as z:
        temporal = _zip_model(z, "Model_3_Temporal_Bone.vtk")[0] * RAS_TO_LPS
        models = [(spec, _zip_model(z, spec[0])) for spec in INNER_EAR_MODELS]
    for side, mirror in (("right", False), ("left", True)):
        m = MIRROR_X if mirror else np.ones(3)
        # Uniform scale only: the atlas's units are not millimetres (about 2.4x), and an
        # affine fit to the large temporal bone would distort the small ear structures.
        reg = register(
            temporal * m,
            bone_vertices[f"{side} temporal bone"],
            similarity_iterations=60,
            affine_iterations=0,
        )
        report[f"inner_ear_{side}"] = {
            "reference": f"temporal bone -> BodyParts3D {side} temporal bone",
            "mirrored_from_right": mirror,
            "rms_mm": round(reg.rms_mm, 2),
            "median_mm": round(reg.median_mm, 2),
            "p90_mm": round(reg.p90_mm, 2),
            "scale": round(float(np.cbrt(abs(np.linalg.det(reg.matrix[:3, :3])))), 3),
        }
        for i, ((_fname, cid, name, system, _), (v, f)) in enumerate(models):
            faces = f[:, ::-1] if mirror else f  # a mirror flips winding
            out.append(
                {
                    "element": f"SPLIE{'L' if mirror else 'R'}{i:02d}",
                    "concept": cid,
                    "name": name,
                    "system": system,
                    "side": side,
                    "group": None,
                    "vertices": reg.apply(v * RAS_TO_LPS * m),
                    "faces": faces,
                    "source": "spl-inner-ear" + (" (mirrored)" if mirror else ""),
                }
            )
    return out, report
