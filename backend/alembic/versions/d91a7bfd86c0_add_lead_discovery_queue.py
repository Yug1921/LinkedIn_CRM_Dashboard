from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "d91a7bfd86c0"
down_revision = "43e6e3f6ebb0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lead_discovery_queue",

        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()")
        ),

        sa.Column(
            "raw_url",
            sa.Text(),
            nullable=False
        ),

        sa.Column(
            "normalized_url",
            sa.Text(),
            nullable=False
        ),

        sa.Column(
            "source",
            sa.Text(),
            nullable=True
        ),

        sa.Column(
            "source_query",
            sa.Text(),
            nullable=True
        ),

        sa.Column(
            "category_hint",
            sa.Text(),
            nullable=True
        ),

        sa.Column(
            "status",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'discovered'")
        ),

        sa.Column(
            "raw_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True
        ),

        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="SET NULL"),
            nullable=True
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()")
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()")
        ),
    )

    # Unique index
    op.create_index(
        "uq_lead_discovery_queue_normalized_url",
        "lead_discovery_queue",
        ["normalized_url"],
        unique=True,
    )

    # Filtering indexes
    op.create_index(
        "idx_lead_discovery_queue_status",
        "lead_discovery_queue",
        ["status"],
        unique=False,
    )

    op.create_index(
        "idx_lead_discovery_queue_category_hint",
        "lead_discovery_queue",
        ["category_hint"],
        unique=False,
    )

    # Constraints
    op.create_check_constraint(
        "ck_lead_discovery_queue_category_hint",
        "lead_discovery_queue",
        "(category_hint IS NULL) OR "
        "(category_hint IN "
        "('crypto_influencer',"
        "'blockchain_project',"
        "'blockchain_expert',"
        "'golf_user_org',"
        "'travel_user_org'))",
    )

    op.create_check_constraint(
        "ck_lead_discovery_queue_status",
        "lead_discovery_queue",
        "status IN ("
        "'discovered',"
        "'enriched',"
        "'ai_scored',"
        "'ready_for_outreach',"
        "'do_not_contact')",
    )


def downgrade() -> None:
    op.drop_index(
        "idx_lead_discovery_queue_category_hint",
        table_name="lead_discovery_queue"
    )

    op.drop_index(
        "idx_lead_discovery_queue_status",
        table_name="lead_discovery_queue"
    )

    op.drop_index(
        "uq_lead_discovery_queue_normalized_url",
        table_name="lead_discovery_queue"
    )

    op.drop_table("lead_discovery_queue")