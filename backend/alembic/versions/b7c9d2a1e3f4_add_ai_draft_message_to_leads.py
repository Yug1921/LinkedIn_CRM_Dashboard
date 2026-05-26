from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b7c9d2a1e3f4"
down_revision = "a1c8d7e5f2b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column("ai_draft_message", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("leads", "ai_draft_message")
