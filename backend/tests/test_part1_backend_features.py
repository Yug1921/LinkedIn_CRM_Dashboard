import os
from datetime import datetime, timezone, timedelta, date
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://user:pass@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")

from app.api.routes.stats import get_overview
from app.models.models import Lead, LeadCategory, LeadStatus
from app.services.lead_service import build_lead_list_query, list_leads_paginated, update_lead_status


def test_update_lead_status_maps_status_and_appends_notes():
    lead = Lead(full_name="Test Lead", category=LeadCategory.CRYPTO_INFLUENCER)
    lead.id = uuid4()
    lead.notes = "Existing note"
    db = MagicMock()

    updated = update_lead_status(db, lead, "replied", "Followed up after a call")

    assert updated.status == LeadStatus.RESPONDED
    assert updated.notes.startswith("Existing note\n[")
    assert "Followed up after a call" in updated.notes
    assert "Z]" in updated.notes
    db.commit.assert_called_once()


def test_list_leads_paginated_returns_total_and_applies_filters():
    lead = Lead(full_name="Alice Example", category=LeadCategory.CRYPTO_INFLUENCER)
    lead.id = uuid4()
    db = MagicMock()

    count_result = MagicMock()
    count_result.scalar_one.return_value = 1
    items_result = MagicMock()
    items_result.scalars.return_value.all.return_value = [lead]
    db.execute.side_effect = [count_result, items_result]

    total, items = list_leads_paginated(
        db,
        category=["crypto_influencer"],
        status="contacted",
        source="apollo",
        country="Thai",
        search="Alice",
        score_min=50,
        score_max=90,
        sort_by="score",
        limit=25,
        offset=10,
    )

    assert total == 1
    assert items == [lead]

    lead_query = db.execute.call_args_list[1].args[0]
    sql = str(lead_query.compile(compile_kwargs={"literal_binds": True}))
    assert "like" in sql.lower()
    assert "ai_score" in sql
    assert "apollo" in sql
    assert "%Thai%" in sql


def test_build_lead_list_query_includes_count_and_score_sort():
    count_stmt, stmt = build_lead_list_query(sort_by="score", limit=5, offset=2)

    count_sql = str(count_stmt.compile(compile_kwargs={"literal_binds": True}))
    stmt_sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))

    assert "count" in count_sql.lower()
    assert "ORDER BY" in stmt_sql
    assert "ai_score" in stmt_sql


def test_get_overview_returns_expected_shape():
    db = MagicMock()
    today = datetime.now(timezone.utc).date()
    start_of_today = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)

    total_result = MagicMock()
    total_result.scalar_one.return_value = 7

    category_result = MagicMock()
    category_result.all.return_value = [(LeadCategory.CRYPTO_INFLUENCER, 3), (LeadCategory.GOLF_INDUSTRY, 4)]

    status_result = MagicMock()
    status_result.all.return_value = [(LeadStatus.NEW, 2), (LeadStatus.CONTACTED, 3), (LeadStatus.RESPONDED, 1)]

    today_result = MagicMock()
    today_result.scalar_one.return_value = 2

    daily_result = MagicMock()
    daily_result.all.return_value = [(today, 2)]

    top_locations_result = MagicMock()
    top_locations_result.all.return_value = [("Thailand", 4), ("Singapore", 2)]

    responded_result = MagicMock()
    responded_result.scalar_one.return_value = 1

    contacted_result = MagicMock()
    contacted_result.scalar_one.return_value = 3

    db.execute.side_effect = [
        total_result,
        category_result,
        status_result,
        today_result,
        daily_result,
        top_locations_result,
        responded_result,
        contacted_result,
    ]

    result = get_overview(db)

    assert result["total_leads"] == 7
    assert result["by_category"]["crypto_influencer"] == 3
    assert result["by_status"]["contacted"] == 3
    assert result["captured_today"] == 2
    assert len(result["capture_rate_7d"]) == 7
    assert result["top_locations"][0]["location"] == "Thailand"
    assert result["reply_rate"] == 1 / 3