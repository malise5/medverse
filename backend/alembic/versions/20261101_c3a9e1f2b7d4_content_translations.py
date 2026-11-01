"""content translations

Revision ID: c3a9e1f2b7d4
Revises: a57cebc864ad
Create Date: 2026-11-01

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c3a9e1f2b7d4"
down_revision: str | Sequence[str] | None = "a57cebc864ad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "content_translations",
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint(
            "entity_type", "entity_id", "locale", name=op.f("pk_content_translations")
        ),
    )


def downgrade() -> None:
    op.drop_table("content_translations")
