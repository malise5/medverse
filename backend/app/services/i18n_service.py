"""Fetching content translations for the request locale (see app/i18n.py)."""

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.i18n import DEFAULT_LOCALE, overlay
from app.models import ContentTranslation


def translations(db: Session, entity: str, ids: Iterable[str], locale: str) -> dict[str, dict]:
    """Translation payloads by item id (empty for English or untranslated items)."""
    if locale == DEFAULT_LOCALE:
        return {}
    wanted = list(ids)
    if not wanted:
        return {}
    rows = db.execute(
        select(ContentTranslation.entity_id, ContentTranslation.payload).where(
            ContentTranslation.entity_type == entity,
            ContentTranslation.locale == locale,
            ContentTranslation.entity_id.in_(wanted),
        )
    )
    return dict(rows.all())


# --- Simulation models and pathology conditions -------------------------------------------
# Their translatable text is spread over nested lists (parameters, outputs, scenarios), so
# translations key those by id rather than by position. Technical documentation
# (equations, solver, assumptions, limitations, validation) stays in English for now.


def model_text(d: dict) -> dict:
    """Translatable view of a model definition (as produced by dataclasses.asdict)."""
    return {
        "name": d["name"],
        "summary": d["summary"],
        "purpose": d["purpose"],
        "disclaimer": d["disclaimer"],
        "parameters": {
            p["id"]: {"label": p["label"], "description": p["description"]} for p in d["parameters"]
        },
        "outputs": {
            o["id"]: {"label": o["label"], "description": o["description"]}
            for o in [*d["series"], *d["metrics"]]
        },
        "animations": [{"description": a["description"]} for a in d["animations"]],
        "phase_plots": {
            p["id"]: {"title": p["title"], "description": p["description"]}
            for p in d["phase_plots"]
        },
    }


def localize_model(d: dict, payload: dict | None) -> dict:
    """A model definition dict with its translatable text in the payload's language."""
    if not payload:
        return d
    text = overlay(model_text(d), payload)
    out = {**d, **{k: text[k] for k in ("name", "summary", "purpose", "disclaimer")}}
    out["parameters"] = [{**p, **text["parameters"][p["id"]]} for p in d["parameters"]]
    out["series"] = [{**o, **text["outputs"][o["id"]]} for o in d["series"]]
    out["metrics"] = [{**o, **text["outputs"][o["id"]]} for o in d["metrics"]]
    out["animations"] = [
        {**a, **t} for a, t in zip(d["animations"], text["animations"], strict=True)
    ]
    out["phase_plots"] = [{**p, **text["phase_plots"][p["id"]]} for p in d["phase_plots"]]
    return out


CONDITION_FIELDS = (
    "name",
    "summary",
    "mechanism",
    "anatomical_changes",
    "physiological_consequences",
    "clinical_manifestations",
    "complications",
    "investigations",
    "management_principles",
)


def condition_text(c) -> dict:
    """Translatable view of a Condition row (narrative fields and its scenarios)."""
    return {
        **{f: getattr(c, f) or "" for f in CONDITION_FIELDS},
        "scenarios": {
            s.id: {
                "title": s.title,
                "description": s.description,
                "assumptions": list(s.assumptions),
            }
            for s in c.scenarios
        },
    }
