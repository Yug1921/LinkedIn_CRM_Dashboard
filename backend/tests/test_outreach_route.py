import os
from datetime import datetime
from uuid import uuid4
from unittest.mock import MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://user:pass@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")

from app.api.routes.outreach import create_outreach_log
from app.models.models import Lead, LeadCategory, LeadStatus
from app.schemas.outreach import OutreachCreateRequest


def _build_db_with_lead(lead: Lead):
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = lead
    return db


def test_create_outreach_log_marks_lead_contacted_and_sets_last_contacted_for_sent():
    lead = Lead(full_name="Test Lead", category=LeadCategory.CRYPTO_INFLUENCER)
    lead.id = uuid4()
    db = _build_db_with_lead(lead)
    payload = OutreachCreateRequest(
        outreach_type="connection_request",
        channel="linkedin",
        status="sent",
        message_body="Hello there",
        ai_generated=True,
    )

    with patch("app.api.routes.outreach.OutreachOut.model_validate", return_value={"ok": True}):
        create_outreach_log(lead.id, payload, db)

    assert lead.status == LeadStatus.CONTACTED
    assert lead.last_contacted_at is not None
    assert isinstance(lead.last_contacted_at, datetime)
    db.commit.assert_called_once()


def test_create_outreach_log_does_not_set_last_contacted_for_non_sent_status():
    lead = Lead(full_name="Test Lead", category=LeadCategory.CRYPTO_INFLUENCER)
    lead.id = uuid4()
    lead.status = LeadStatus.NEW
    lead.last_contacted_at = None
    db = _build_db_with_lead(lead)
    payload = OutreachCreateRequest(
        outreach_type="follow_up",
        channel="linkedin",
        status="planned",
        message_body="Draft follow up",
        ai_generated=False,
    )

    with patch("app.api.routes.outreach.OutreachOut.model_validate", return_value={"ok": True}):
        create_outreach_log(lead.id, payload, db)

    assert lead.status == LeadStatus.NEW
    assert lead.last_contacted_at is None
    db.commit.assert_called_once()
