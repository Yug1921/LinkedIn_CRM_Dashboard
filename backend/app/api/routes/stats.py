from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import String, func, select
from sqlalchemy.orm import Session

from app.api.deps import db_dep
from app.models.models import Lead, LeadStatus

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def get_overview(db: Session = Depends(db_dep)):
    total_leads = db.execute(select(func.count()).select_from(Lead)).scalar_one()

    category_expr = func.coalesce(
        Lead.raw_data["category_hint"].astext,
        func.cast(Lead.category, String),
    )
    category_rows = db.execute(
        select(category_expr, func.count()).group_by(category_expr)
    ).all()
    by_category = {str(category): int(count) for category, count in category_rows}

    status_rows = db.execute(
        select(Lead.status, func.count()).group_by(Lead.status)
    ).all()
    by_status = {getattr(status, "value", status): int(count) for status, count in status_rows}

    now_utc = datetime.now(timezone.utc)
    start_today = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    captured_today = db.execute(
        select(func.count()).select_from(Lead).where(Lead.created_at >= start_today)
    ).scalar_one()

    seven_days_ago = (now_utc - timedelta(days=6)).date()
    daily_rows = db.execute(
        select(func.date(Lead.created_at), func.count())
        .where(Lead.created_at >= datetime.combine(seven_days_ago, datetime.min.time(), tzinfo=timezone.utc))
        .group_by(func.date(Lead.created_at))
        .order_by(func.date(Lead.created_at).asc())
    ).all()
    daily_map = {row_date: count for row_date, count in daily_rows}
    capture_rate_7d = []
    for day_offset in range(7):
        day = (now_utc.date() - timedelta(days=6 - day_offset))
        capture_rate_7d.append({"date": day.isoformat(), "count": int(daily_map.get(day, 0))})

    top_location_rows = db.execute(
        select(Lead.country, func.count())
        .where(Lead.country.isnot(None))
        .group_by(Lead.country)
        .order_by(func.count().desc())
        .limit(10)
    ).all()
    top_locations = [{"location": country, "count": count} for country, count in top_location_rows if country]

    responded_count = db.execute(
        select(func.count()).select_from(Lead).where(Lead.status == LeadStatus.RESPONDED)
    ).scalar_one()
    contacted_count = db.execute(
        select(func.count()).select_from(Lead).where(Lead.status == LeadStatus.CONTACTED)
    ).scalar_one()
    reply_rate = (responded_count / contacted_count) if contacted_count else 0.0

    return {
        "total_leads": int(total_leads),
        "by_category": by_category,
        "by_status": by_status,
        "captured_today": int(captured_today),
        "capture_rate_7d": capture_rate_7d,
        "top_locations": top_locations,
        "reply_rate": reply_rate,
    }