"""add ai_score_reasoning to leads

Revision ID: f5c1a2d3e4b6
Revises: e3f1b7a5c902
Create Date: 2026-05-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f5c1a2d3e4b6"
down_revision: Union[str, Sequence[str], None] = "e3f1b7a5c902"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("ai_score_reasoning", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "ai_score_reasoning")