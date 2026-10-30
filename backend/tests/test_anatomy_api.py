def test_systems_have_counts(auth_client):
    systems = {s["id"]: s for s in auth_client.get("/api/v1/anatomy/systems").json()}
    for sid in ("skeletal", "muscular", "cardiovascular", "nervous", "integumentary"):
        assert systems[sid]["structure_count"] > 0, sid
        assert systems[sid]["mesh_count"] > 0, sid


def test_search_ranks_exact_and_prefix_matches(auth_client):
    hits = auth_client.get("/api/v1/anatomy/search", params={"q": "heart"}).json()
    assert hits[0]["id"] == "FMA:7088"
    hits = auth_client.get("/api/v1/anatomy/search", params={"q": "femoral artery"}).json()
    top = {h["id"] for h in hits[:3]}
    assert {"FMA:70249", "FMA:70250"} <= top


def test_search_matches_synonyms_and_latin(auth_client):
    hits = auth_client.get("/api/v1/anatomy/search", params={"q": "profunda femoris"}).json()
    assert {"FMA:20796", "FMA:20797"} <= {h["id"] for h in hits}
    hits = auth_client.get("/api/v1/anatomy/search", params={"q": "cor"}).json()
    assert any(h["id"] == "FMA:7088" and h["matched_text"] == "Cor" for h in hits)


def test_search_tolerates_typos_and_escapes_wildcards(auth_client):
    hits = auth_client.get("/api/v1/anatomy/search", params={"q": "femr"}).json()
    assert any("femur" in h["name"] for h in hits)
    assert auth_client.get("/api/v1/anatomy/search", params={"q": "%_"}).status_code == 200


def test_search_validates_query(auth_client):
    r = auth_client.get("/api/v1/anatomy/search", params={"q": "a"})
    assert r.status_code == 422


def test_structure_detail_heart(auth_client):
    d = auth_client.get("/api/v1/anatomy/structures/FMA:7088").json()
    assert d["name"] == "heart"
    assert d["system_id"] == "cardiovascular"
    assert d["latin_name"] == "Cor"
    assert d["is_compound"] and len(d["mesh_ids"]) > 1
    sections = {c["section"] for c in d["content"]}
    assert {"overview", "blood_supply", "innervation"} <= sections
    assert all(c["verification_status"] == "draft" for c in d["content"])
    assert {"grays42", "moore8"} <= {r["id"] for r in d["references"]}
    assert any(r["predicate"] == "supplied_by" for r in d["relations"])
    assert any(s["model_id"] == "cv.windkessel3" for s in d["simulations"])
    # Source tree: heart -> left side of heart -> left ventricle.
    assert any(c["name"] == "left side of heart" for c in d["children"])


def test_relationships_are_navigable_both_directions(auth_client):
    fa = auth_client.get("/api/v1/anatomy/structures/FMA:70249").json()
    out = {
        (r["predicate"], r["target"]["id"]) for r in fa["relations"] if r["direction"] == "outgoing"
    }
    assert ("continuous_with", "FMA:18806") in out
    incoming = [r for r in fa["relations"] if r["direction"] == "incoming"]
    assert any(
        r["predicate"] == "branch_of"
        and r["label"] == "has branch"
        and r["target"]["id"] == "FMA:20796"
        for r in incoming
    )


def test_functional_relations_are_distinguished(auth_client):
    aorta = auth_client.get("/api/v1/anatomy/structures/FMA:3734").json()
    classes = {r["predicate"]: r["relation_class"] for r in aorta["relations"]}
    assert classes["functionally_associated_with"] == "functional"
    assert classes["arises_from"] == "structural"
    assert any(c["id"] == "arterial-stiffening" for c in aorta["conditions"])


def test_unknown_structure_404(auth_client):
    r = auth_client.get("/api/v1/anatomy/structures/FMA:0")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_children_and_roots(auth_client):
    kids = auth_client.get("/api/v1/anatomy/structures/FMA:3734/children").json()
    assert {"FMA:3736", "FMA:3768", "FMA:3784"} <= {k["id"] for k in kids}
    roots = auth_client.get(
        "/api/v1/anatomy/hierarchy/roots", params={"system": "cardiovascular"}
    ).json()
    assert any(r["id"] == "FMA:7161" for r in roots)


def test_pagination(auth_client):
    p = auth_client.get(
        "/api/v1/anatomy/structures", params={"system": "skeletal", "page_size": 5}
    ).json()
    assert len(p["items"]) == 5 and p["total"] > 5
    p2 = auth_client.get(
        "/api/v1/anatomy/structures", params={"system": "skeletal", "page_size": 5, "page": 2}
    ).json()
    assert not {i["id"] for i in p["items"]} & {i["id"] for i in p2["items"]}


def test_asset_manifest_links_meshes_to_structures(auth_client):
    m = auth_client.get("/api/v1/assets/manifest").json()
    assert m["bundles"] and all(b["license"] == "CC BY 4.0" for b in m["bundles"])
    bundle_ids = {b["id"] for b in m["bundles"]}
    assert all(bundle in bundle_ids for bundle, _ in m["meshes"].values())
    heart = auth_client.get("/api/v1/anatomy/structures/FMA:7088").json()
    assert all(mid in m["meshes"] for mid in heart["mesh_ids"])


def test_structure_index_is_consistent(auth_client):
    idx = auth_client.get("/api/v1/anatomy/index").json()
    n = len(idx["ids"])
    assert n == len(idx["names"]) == len(idx["systems"]) == len(idx["parents"])
    assert all(-1 <= p < n for p in idx["parents"])
    aorta = idx["ids"].index("FMA:3736")
    assert idx["ids"][idx["parents"][aorta]] == "FMA:3734"
