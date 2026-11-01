"""Blood-vessel routes inferred from the mesh contact graph.

For the heart (or any of its parts) the whole arterial and venous trees reachable from the
heart are returned. For any other structure, the shortest arterial route from the heart to
the arteries touching (or inside) the structure, and the venous route back, are returned.

Each mesh carries a hop count: its distance from the heart in contacts along the route.
Routes are inferred from geometric proximity of decimated meshes, not from curated
vascular connectivity, and are labelled as such wherever they are shown.
"""

from collections import deque
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Mesh, MeshContact, Structure, StructureMesh
from app.schemas.anatomy import CirculationOut, StructureRef
from app.services.anatomy_service import get_structure

HEART = "FMA:7088"
# Vessel segments closer than this are treated as continuous (decimated meshes leave gaps).
VESSEL_LINK_MM = 2.0
# Vessels this close to a structure are treated as supplying or draining it.
ORGAN_LINK_MM = 4.0

METHOD = (
    "Routes are inferred from where the 3D vessel meshes touch each other "
    f"(gaps up to {VESSEL_LINK_MM:g} mm) and the structure (up to {ORGAN_LINK_MM:g} mm). "
    "This is geometric inference, not curated anatomy: a vessel that only passes close by "
    "can appear as a supply, and gaps in the meshes can break a route."
)


@dataclass(frozen=True)
class ContactGraph:
    groups: dict[str, str | None]
    owner: dict[str, str]
    adj: dict[str, tuple[tuple[str, float], ...]]


_cache: tuple[tuple[int, int], ContactGraph] | None = None


def contact_graph(db: Session) -> ContactGraph:
    """Loaded once per process and reloaded if the seeded data changes size."""
    global _cache
    key = (
        db.scalar(select(func.count()).select_from(Mesh)) or 0,
        db.scalar(select(func.count()).select_from(MeshContact)) or 0,
    )
    if _cache and _cache[0] == key:
        return _cache[1]
    groups, owner = {}, {}
    for mid, sid, group in db.execute(select(Mesh.id, Mesh.structure_id, Mesh.render_group)):
        groups[mid], owner[mid] = group, sid
    adj: dict[str, list[tuple[str, float]]] = {m: [] for m in groups}
    for a, b, d in db.execute(
        select(MeshContact.mesh_a, MeshContact.mesh_b, MeshContact.distance_mm)
    ):
        adj[a].append((b, d))
        adj[b].append((a, d))
    graph = ContactGraph(groups, owner, {k: tuple(v) for k, v in adj.items()})
    _cache = (key, graph)
    return graph


def _near(g: ContactGraph, meshes: set[str], limit: float, within: set[str]) -> set[str]:
    return {n for m in meshes for n, d in g.adj.get(m, ()) if d <= limit and n in within}


def _bfs(g: ContactGraph, roots: set[str], within: set[str]):
    """Hop counts and parent pointers over vessel meshes linked within VESSEL_LINK_MM."""
    hops = dict.fromkeys(roots, 0)
    parent: dict[str, str | None] = dict.fromkeys(roots)
    queue = deque(sorted(roots))
    while queue:
        m = queue.popleft()
        for n, d in g.adj.get(m, ()):
            if d <= VESSEL_LINK_MM and n in within and n not in hops:
                hops[n] = hops[m] + 1
                parent[n] = m
                queue.append(n)
    return hops, parent


def _route(hops, parent, targets: set[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for t in targets:
        m: str | None = t
        while m is not None and m in hops and m not in out:
            out[m] = hops[m]
            m = parent[m]
    return out


def _refs(db: Session, g: ContactGraph, meshes: set[str]) -> list[StructureRef]:
    ids = {g.owner[m] for m in meshes}
    rows = db.execute(select(Structure.id, Structure.name).where(Structure.id.in_(ids)))
    return sorted((StructureRef(id=i, name=n) for i, n in rows), key=lambda r: r.name)


def _meshes_of(db: Session, structure_id: str) -> set[str]:
    return set(
        db.scalars(select(StructureMesh.mesh_id).where(StructureMesh.structure_id == structure_id))
    )


def circulation(db: Session, structure_id: str) -> CirculationOut:
    s = get_structure(db, structure_id)
    g = contact_graph(db)
    organ = _meshes_of(db, s.id)
    heart = _meshes_of(db, HEART)
    arteries = {m for m, grp in g.groups.items() if grp == "artery"} - heart
    veins = {m for m, grp in g.groups.items() if grp == "vein"} - heart

    art_roots = _near(g, heart, VESSEL_LINK_MM, arteries)
    vein_roots = _near(g, heart, VESSEL_LINK_MM, veins)
    art_hops, art_parent = _bfs(g, art_roots, arteries)
    vein_hops, vein_parent = _bfs(g, vein_roots, veins)

    if not organ or not g.adj:
        return CirculationOut(structure_id=s.id, mode="none", method=METHOD)

    if organ & heart:
        return CirculationOut(
            structure_id=s.id,
            mode="whole_circulation",
            organ_mesh_ids=sorted(organ),
            arteries=art_hops,
            veins=vein_hops,
            contact_arteries=_refs(db, g, art_roots),
            contact_veins=_refs(db, g, vein_roots),
            method=METHOD,
        )

    organ_arteries = (organ & arteries) | _near(g, organ, ORGAN_LINK_MM, arteries)
    organ_veins = (organ & veins) | _near(g, organ, ORGAN_LINK_MM, veins)
    art_route = _route(art_hops, art_parent, organ_arteries)
    vein_route = _route(vein_hops, vein_parent, organ_veins)
    contact_a, contact_v = organ_arteries - organ, organ_veins - organ
    return CirculationOut(
        structure_id=s.id,
        mode="organ_route" if art_route or vein_route or contact_a or contact_v else "none",
        organ_mesh_ids=sorted(organ),
        arteries=art_route,
        veins=vein_route,
        contact_arteries=_refs(db, g, contact_a),
        contact_veins=_refs(db, g, contact_v),
        unrouted_vessels=len((organ_arteries - art_hops.keys()) | (organ_veins - vein_hops.keys())),
        method=METHOD,
    )
