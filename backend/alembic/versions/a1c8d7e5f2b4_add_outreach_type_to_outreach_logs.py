from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1c8d7e5f2b4"
down_revision = "d91a7bfd86c0"
branch_labels = None
depends_on = None


OUTREACH_TYPE_ENUM = sa.Enum(
    "connection_request",
    "direct_message",
    "email",
    "inmail",
    "follow_up",
    name="outreachtype",
)


def upgrade() -> None:
    bind = op.get_bind()

    OUTREACH_TYPE_ENUM.create(bind, checkfirst=True)

    op.add_column(
        "outreach_logs",
        sa.Column("outreach_type", OUTREACH_TYPE_ENUM, nullable=True),
    )

    op.create_index(
        "ix_outreach_logs_outreach_type",
        "outreach_logs",
        ["outreach_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_outreach_logs_outreach_type", table_name="outreach_logs")
    op.drop_column("outreach_logs", "outreach_type")
    OUTREACH_TYPE_ENUM.drop(op.get_bind(), checkfirst=True)
