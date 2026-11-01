"""Download the inputs of the female body build into a source directory.

Usage:
    python pipeline/hra/fetch.py --dest <empty dir>

Fetches, from the HuBMAP Human Reference Atlas (CC BY 4.0):
    reference-organs.json  catalogue of 3D reference organs (sex, file, DOI-bearing IRIs)
    scene-female.json      placement of each female organ in the female reference body
    crosswalk.csv          3D node name -> UBERON / FMA term (ASCT+B crosswalk)
    organs/*.glb           the female organ files listed in the scene
    organ-metadata.json    licence, version and citation of each organ dataset
and from the Uberon ontology (CC BY 3.0):
    uberon-base.obo        used only for its UBERON -> FMA cross-references

The pipeline never executes downloaded content; files are parsed as data.
"""

import argparse
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

API = "https://apps.humanatlas.io/api/v1"
CROSSWALK = (
    "https://cdn.humanatlas.io/digital-objects/ref-organ/asct-b-3d-models-crosswalk/"
    "v1.10/assets/asct-b-3d-models-crosswalk.csv"
)
UBERON = "https://purl.obolibrary.org/obo/uberon/uberon-base.obo"
TIMEOUT = 300


def _https(url: str) -> str:
    if not url.startswith("https://"):
        raise ValueError(f"refusing non-HTTPS URL: {url}")
    return url


def get(url: str, dest: Path) -> Path:
    req = urllib.request.Request(  # noqa: S310 - scheme checked by _https
        _https(url), headers={"User-Agent": "medverse-pipeline/hra"}
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:  # noqa: S310 - fixed https URLs
        dest.write_bytes(r.read())
    return dest


def get_json(url: str) -> dict:
    req = urllib.request.Request(  # noqa: S310 - scheme checked by _https
        _https(url),
        headers={"Accept": "application/json", "User-Agent": "medverse-pipeline/hra"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:  # noqa: S310 - fixed https URLs
        return json.loads(r.read())


def organ_metadata(reference_organ: str) -> dict:
    """Licence and citation from the organ's dataset record on lod.humanatlas.io."""
    # e.g. https://purl.humanatlas.io/ref-organ/uterus-female/v1.2#primary
    path = reference_organ.split("purl.humanatlas.io/", 1)[1].split("#", 1)[0]
    doc = json.dumps(get_json(f"https://cdn.humanatlas.io/digital-objects/{path}/metadata.json"))

    def first(key: str) -> str | None:
        import re

        m = re.search(rf'"{key}"\s*:\s*"([^"]+)"', doc)
        return m.group(1) if m else None

    return {
        "dataset": path,
        "license": first("license"),
        "citation": first("citation"),
        "doi": first("doi"),
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--dest", type=Path, required=True)
    args = ap.parse_args()
    dest: Path = args.dest
    (dest / "organs").mkdir(parents=True, exist_ok=True)

    get(f"{API}/reference-organs", dest / "reference-organs.json")
    get(f"{API}/scene?sex=female", dest / "scene-female.json")
    get(CROSSWALK, dest / "crosswalk.csv")
    get(UBERON, dest / "uberon-base.obo")

    scene = json.loads((dest / "scene-female.json").read_text())
    urls = sorted(
        {n["scenegraph"] for n in scene if n.get("sex") == "Female" and n.get("scenegraph")}
    )
    if not all(u.startswith("https://cdn.humanatlas.io/") for u in urls):
        raise SystemExit("unexpected organ file host in scene")
    with ThreadPoolExecutor(max_workers=8) as pool:
        todo = [u for u in urls if not (dest / "organs" / u.rsplit("/", 1)[1]).exists()]
        list(pool.map(lambda u: get(u, dest / "organs" / u.rsplit("/", 1)[1]), todo))
    organs = sorted({n["reference_organ"] for n in scene if n.get("sex") == "Female"})
    with ThreadPoolExecutor(max_workers=8) as pool:
        meta = dict(zip(organs, pool.map(organ_metadata, organs), strict=True))
    (dest / "organ-metadata.json").write_text(json.dumps(meta, indent=1) + "\n")
    print(f"fetched {len(urls)} organ files into {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
