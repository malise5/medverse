"""Fetching content translations for the request locale (see app/i18n.py)."""

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.i18n import DEFAULT_LOCALE
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
