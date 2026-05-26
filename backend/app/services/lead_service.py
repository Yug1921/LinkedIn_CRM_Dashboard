from typing import Optional, List, Sequence, Tuple
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_, desc, asc

from app.models.models import Lead, LeadStatus, LeadCategory
from app.schemas.lead import LeadCreate, LeadUpdate


LEAD_STATUS_MAP = {
    "new": LeadStatus.NEW,
    "contacted": LeadStatus.CONTACTED,
    "replied": LeadStatus.RESPONDED,
    "converted": LeadStatus.CONVERTED,
    "do_not_contact": LeadStatus.DISQUALIFIED,
}


def create_lead(db: Session, payload: LeadCreate) -> Lead:
    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def get_lead(db: Session, lead_id: UUID) -> Optional[Lead]:
    return db.get(Lead, lead_id)


def list_leads(
    db: Session,
    category: Optional[str] = None,
    status: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Lead]:
    stmt = select(Lead).order_by(Lead.created_at.desc())

    if category:
        stmt = stmt.where(Lead.category == category)
    if status:
        stmt = stmt.where(Lead.status == status)
    if country:
        stmt = stmt.where(Lead.country.ilike(f"%{country.strip()}%"))

    stmt = stmt.limit(limit).offset(offset)
    return list(db.execute(stmt).scalars().all())


def build_lead_filters_stmt(
    *,
    category: Optional[Sequence[str]] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    score_min: Optional[float] = None,
    score_max: Optional[float] = None,
):
    stmt = select(Lead)

    if category:
        categories = [LeadCategory(item) for item in category]
        stmt = stmt.where(Lead.category.in_(categories))
    if status:
        stmt = stmt.where(Lead.status == LeadStatus(status))
    if source:
        stmt = stmt.where(Lead.source == source)
    if country:
        country_pattern = f"%{country.strip()}%"
        stmt = stmt.where(Lead.country.ilike(country_pattern))
    if score_min is not None:
        stmt = stmt.where(Lead.ai_score >= score_min)
    if score_max is not None:
        stmt = stmt.where(Lead.ai_score <= score_max)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Lead.full_name.ilike(pattern),
                Lead.job_title.ilike(pattern),
                Lead.company_or_brand.ilike(pattern),
                func.coalesce(Lead.raw_data["headline"].astext, "").ilike(pattern),
            )
        )

    return stmt


def build_lead_list_query(
    *,
    category: Optional[Sequence[str]] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    score_min: Optional[float] = None,
    score_max: Optional[float] = None,
    sort_by: str = "created_at",
    limit: int = 50,
    offset: int = 0,
):
    stmt = build_lead_filters_stmt(
        category=category,
        status=status,
        source=source,
        country=country,
        search=search,
        score_min=score_min,
        score_max=score_max,
    )

    count_stmt = select(func.count()).select_from(stmt.subquery())

    if sort_by == "score":
        stmt = stmt.order_by(desc(Lead.ai_score), desc(Lead.created_at))
    elif sort_by == "full_name":
        stmt = stmt.order_by(asc(Lead.full_name), desc(Lead.created_at))
    else:
        stmt = stmt.order_by(desc(Lead.created_at))

    stmt = stmt.limit(limit).offset(offset)
    return count_stmt, stmt


def list_leads_paginated(
    db: Session,
    *,
    category: Optional[Sequence[str]] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    score_min: Optional[float] = None,
    score_max: Optional[float] = None,
    sort_by: str = "created_at",
    limit: int = 50,
    offset: int = 0,
) -> Tuple[int, List[Lead]]:
    count_stmt, stmt = build_lead_list_query(
        category=category,
        status=status,
        source=source,
        country=country,
        search=search,
        score_min=score_min,
        score_max=score_max,
        sort_by=sort_by,
        limit=limit,
        offset=offset,
    )
    total = db.execute(count_stmt).scalar_one()
    items = list(db.execute(stmt).scalars().all())
    return total, items


def update_lead_status(db: Session, lead: Lead, status: str, notes: Optional[str] = None) -> Lead:
    try:
        mapped_status = LEAD_STATUS_MAP[status]
    except KeyError as exc:
        raise ValueError(f"Invalid status: {status}") from exc

    lead.status = mapped_status

    if notes and notes.strip():
        timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        new_note = f"[{timestamp}] {notes.strip()}"
        if lead.notes and lead.notes.strip():
            lead.notes = f"{lead.notes.rstrip()}\n{new_note}"
        else:
            lead.notes = new_note

    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def update_lead(db: Session, lead: Lead, payload: LeadUpdate) -> Lead:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(lead, k, v)

    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def delete_lead(db: Session, lead: Lead) -> None:
    db.delete(lead)
    db.commit()