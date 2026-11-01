"""Content translations (see app/i18n.py)."""

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ContentTranslation(TimestampMixin, Base):
    """A partial copy of one content item's translatable fields in another language.

    entity_type: "module" | "question" | "system" | "structure"; entity_id: the item's id.
    `payload` mirrors the English item's shape; fields left out stay in English.
    """

    __tablename__ = "content_translations"

    entity_type: Mapped[str] = mapped_column(String(32), primary_key=True)
    entity_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    locale: Mapped[str] = mapped_column(String(8), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    # "draft" until reviewed by a fluent health professional (content governance).
    status: Mapped[str] = mapped_column(String(16), default="draft")
