"""add ai_score to leads

Revision ID: e3f1b7a5c902
Revises: b7c9d2a1e3f4
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e3f1b7a5c902"
down_revision: Union[str, Sequence[str], None] = "b7c9d2a1e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("ai_score", sa.Float(), nullable=True))
    op.create_index("idx_leads_ai_score", "leads", ["ai_score"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_leads_ai_score", table_name="leads")
    op.drop_column("leads", "ai_score")