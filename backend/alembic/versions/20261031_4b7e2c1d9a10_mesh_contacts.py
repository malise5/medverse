"""mesh render groups and mesh contact graph

Revision ID: 4b7e2c1d9a10
Revises: 919d6443339c
Create Date: 2026-10-31

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "4b7e2c1d9a10"
down_revision: str | Sequence[str] | None = "919d6443339c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("meshes", sa.Column("render_group", sa.String(length=16), nullable=True))
    op.create_table(
        "mesh_contacts",
        sa.Column("mesh_a", sa.String(length=64), nullable=False),
        sa.Column("mesh_b", sa.String(length=64), nullable=False),
        sa.Column("distance_mm", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(
            ["mesh_a"],
            ["meshes.id"],
            name=op.f("fk_mesh_contacts_mesh_a_meshes"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["mesh_b"],
            ["meshes.id"],
            name=op.f("fk_mesh_contacts_mesh_b_meshes"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("mesh_a", "mesh_b", name=op.f("pk_mesh_contacts")),
    )
    op.create_index(op.f("ix_mesh_contacts_mesh_b"), "mesh_contacts", ["mesh_b"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_mesh_contacts_mesh_b"), table_name="mesh_contacts")
    op.drop_table("mesh_contacts")
    op.drop_column("meshes", "render_group")
