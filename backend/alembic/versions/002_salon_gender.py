"""add salon gender

Revision ID: 002
Revises: 001
Create Date: 2026-06-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

salon_gender = postgresql.ENUM("male", "female", "both", name="salongender", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    salon_gender.create(bind, checkfirst=True)
    op.add_column(
        "salons",
        sa.Column("gender", salon_gender, nullable=False, server_default="both"),
    )
    op.alter_column("salons", "gender", server_default=None)


def downgrade() -> None:
    op.drop_column("salons", "gender")
    salon_gender.drop(op.get_bind(), checkfirst=True)
