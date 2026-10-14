"""add decoration sessions and items

Revision ID: d19624156c35
Revises: e5eac46ce920
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d19624156c35"
down_revision: Union[str, Sequence[str], None] = "e5eac46ce920"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ========================================================
    # CREATE DECORATION SESSIONS
    # ========================================================

    op.create_table(
        "decor_sessions",

        sa.Column(
            "id",
            sa.Integer(),
            nullable=False
        ),

        sa.Column(
            "name",
            sa.String(length=100),
            nullable=False
        ),

        sa.Column(
            "price",
            sa.Numeric(
                precision=12,
                scale=2
            ),
            nullable=True
        ),

        sa.PrimaryKeyConstraint("id"),

        sa.UniqueConstraint("name")
    )

    op.create_index(
        "ix_decor_sessions_id",
        "decor_sessions",
        ["id"],
        unique=False
    )


    # ========================================================
    # CREATE DECORATION ITEMS
    # ========================================================

    op.create_table(
        "decor_items",

        sa.Column(
            "id",
            sa.Integer(),
            nullable=False
        ),

        sa.Column(
            "name",
            sa.String(length=150),
            nullable=False
        ),

        sa.Column(
            "price",
            sa.Numeric(
                precision=12,
                scale=2
            ),
            nullable=False
        ),

        sa.Column(
            "session_id",
            sa.Integer(),
            nullable=False
        ),

        sa.ForeignKeyConstraint(
            ["session_id"],
            ["decor_sessions.id"]
        ),

        sa.PrimaryKeyConstraint("id")
    )

    op.create_index(
        "ix_decor_items_id",
        "decor_items",
        ["id"],
        unique=False
    )


    # ========================================================
    # REMOVE OLD FOREIGN KEY
    # ========================================================

    op.drop_constraint(
        "event_decor_decor_id_fkey",
        "event_decor",
        type_="foreignkey"
    )


    # ========================================================
    # DROP OLD DECOR TABLE
    # ========================================================

    op.drop_index(
        "ix_decor_id",
        table_name="decor"
    )

    op.drop_table("decor")


    # ========================================================
    # CREATE NEW FOREIGN KEY
    # ========================================================

    op.create_foreign_key(
        "event_decor_decor_id_fkey",
        "event_decor",
        "decor_items",
        ["decor_id"],
        ["id"]
    )


def downgrade() -> None:

    # ========================================================
    # REMOVE NEW FOREIGN KEY
    # ========================================================

    op.drop_constraint(
        "event_decor_decor_id_fkey",
        "event_decor",
        type_="foreignkey"
    )


    # ========================================================
    # RECREATE OLD DECOR TABLE
    # ========================================================

    op.create_table(
        "decor",

        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False
        ),

        sa.Column(
            "name",
            sa.String(length=150),
            nullable=False
        ),

        sa.Column(
            "price",
            sa.Numeric(
                precision=12,
                scale=2
            ),
            nullable=False
        ),

        sa.Column(
            "session_id",
            sa.Integer(),
            nullable=False
        ),

        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"]
        ),

        sa.PrimaryKeyConstraint("id")
    )

    op.create_index(
        "ix_decor_id",
        "decor",
        ["id"],
        unique=False
    )


    # ========================================================
    # RESTORE OLD FOREIGN KEY
    # ========================================================

    op.create_foreign_key(
        "event_decor_decor_id_fkey",
        "event_decor",
        "decor",
        ["decor_id"],
        ["id"]
    )


    # ========================================================
    # REMOVE NEW TABLES
    # ========================================================

    op.drop_index(
        "ix_decor_items_id",
        table_name="decor_items"
    )

    op.drop_table("decor_items")

    op.drop_index(
        "ix_decor_sessions_id",
        table_name="decor_sessions"
    )

    op.drop_table("decor_sessions")