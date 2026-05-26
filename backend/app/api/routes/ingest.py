from __future__ import annotations
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.api.deps import db_dep
from app.schemas.ingest import (
    IngestLinkedinUrlsRequest,
    IngestLinkedinUrlsResponse,
    IngestError,
)
from app.schemas.ingest_profile import (
    IngestLinkedinProfileRequest,
    IngestLinkedinProfileResponse,
)
from app.schemas.promote import PromoteResponse
from app.schemas.queue import QueueListResponse, QueueItemOut
from app.schemas.queue_status import QueueStatusUpdateRequest
from app.utils.url_normalizer import normalize_linkedin_url
from app.models.models import LeadDiscoveryQueue
from app.constants import (
    LEAD_CATEGORY_HINTS,
    DISCOVERY_STATUSES,
    STATUS_DISCOVERED,
    STATUS_ENRICHED,
    STATUS_READY_FOR_OUTREACH,
    STATUS_DO_NOT_CONTACT,
)
from app.services.promotion_service import (
    upsert_queue_row,
    promote_queue_to_lead,
)

from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


@router.post("/linkedin-urls", response_model=IngestLinkedinUrlsResponse)
def ingest_linkedin_urls(
    payload: IngestLinkedinUrlsRequest,
    db: Session = Depends(db_dep),
):
    inserted = 0
    skipped = 0
    errors: List[IngestError] = []

    # One request-level transaction is fine, but you requested:
    # "single DB transaction — if DB write fails mid-batch, roll back only that item"
    # That implies SAVEPOINT per item inside one overall session.
    for item in payload.urls:
        try:
            normalized = normalize_linkedin_url(item.raw_url)

            if (
                item.category_hint is not None
                and item.category_hint not in LEAD_CATEGORY_HINTS
            ):
                raise HTTPException(
                    status_code=422,
                    detail=f"category_hint must be one of {LEAD_CATEGORY_HINTS}",
                )

            with db.begin_nested():  # creates a SAVEPOINT
                exists_stmt = select(LeadDiscoveryQueue.id).where(
                    LeadDiscoveryQueue.normalized_url == normalized
                )

                exists = db.execute(exists_stmt).first()

                if exists:
                    skipped += 1
                    continue

                row = LeadDiscoveryQueue(
                    raw_url=item.raw_url,
                    normalized_url=normalized,
                    source=item.source,
                    source_query=item.source_query,
                    category_hint=item.category_hint,
                    status=STATUS_DISCOVERED,
                    raw_data=item.raw_data,
                )

                db.add(row)

            inserted += 1

        except Exception as e:
            # Rollback only the savepoint if active; begin_nested handles that.
            errors.append(
                IngestError(
                    raw_url=item.raw_url,
                    reason=str(e),
                )
            )

    # Commit all successful inserts together
    db.commit()

    return IngestLinkedinUrlsResponse(
        inserted=inserted,
        skipped=skipped,
        errors=errors,
    )


@router.get("/queue", response_model=QueueListResponse)
def get_discovery_queue(
    db: Session = Depends(db_dep),
    status: Optional[str] = Query(default=None),
    category_hint: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    if status is not None and status not in DISCOVERY_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of {DISCOVERY_STATUSES}",
        )

    if (
        category_hint is not None
        and category_hint not in LEAD_CATEGORY_HINTS
    ):
        raise HTTPException(
            status_code=422,
            detail=f"category_hint must be one of {LEAD_CATEGORY_HINTS}",
        )

    base = select(LeadDiscoveryQueue)
    count_stmt = select(func.count()).select_from(LeadDiscoveryQueue)

    if status:
        base = base.where(LeadDiscoveryQueue.status == status)
        count_stmt = count_stmt.where(LeadDiscoveryQueue.status == status)

    if category_hint:
        base = base.where(
            LeadDiscoveryQueue.category_hint == category_hint
        )

        count_stmt = count_stmt.where(
            LeadDiscoveryQueue.category_hint == category_hint
        )

    total = db.execute(count_stmt).scalar_one()

    stmt = (
        base.order_by(LeadDiscoveryQueue.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    items = list(db.execute(stmt).scalars().all())

    return QueueListResponse(
        total=total,
        items=[QueueItemOut.model_validate(i) for i in items],
    )


@router.get("/queue/{queue_id}", response_model=QueueItemOut)
def get_discovery_queue_item(
    queue_id: str,
    db: Session = Depends(db_dep),
):
    row = db.execute(
        select(LeadDiscoveryQueue).where(LeadDiscoveryQueue.id == queue_id)
    ).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="queue_id not found")

    return QueueItemOut.model_validate(row)


class LinkedInProfileFull(BaseModel):
    profile_url: str
    full_name: Optional[str] = ""
    headline: Optional[str] = ""
    location: Optional[str] = ""
    company: Optional[str] = ""
    about: Optional[str] = ""
    connections: Optional[str] = ""
    profile_type: Optional[str] = "person"
    category_hint: Optional[str] = "crypto_influencer"
    source: Optional[str] = "chrome_extension"
    raw_data: Dict[str, Any] = Field(default_factory=dict)


@router.post("/linkedin-profile", response_model=IngestLinkedinProfileResponse)
def ingest_linkedin_profile(
    payload: IngestLinkedinProfileRequest,
    db: Session = Depends(db_dep),
):
    try:
        with db.begin():
            queue_row, queue_action = upsert_queue_row(
                db,
                raw_url=payload.raw_url,
                source=payload.source,
                source_query=payload.source_query,
                category_hint=payload.category_hint,
                raw_data=payload.raw_data or {},
            )
            lead, lead_action = promote_queue_to_lead(db, queue_row)

        return IngestLinkedinProfileResponse(
            queue_id=str(queue_row.id),
            lead_id=str(lead.id),
            queue_action=queue_action,
            lead_action=lead_action if lead_action in ("created", "linked") else "updated",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/promote-enriched", response_model=PromoteResponse)
def promote_enriched(
    db: Session = Depends(db_dep),
):
    processed = 0
    created = 0
    linked = 0
    updated = 0
    errors: List[dict] = []

    try:
        with db.begin():
            queue_rows = list(
                db.execute(
                    select(LeadDiscoveryQueue)
                    .where(LeadDiscoveryQueue.status == STATUS_ENRICHED)
                    .order_by(LeadDiscoveryQueue.created_at.asc())
                ).scalars().all()
            )

            for queue_row in queue_rows:
                try:
                    with db.begin_nested():
                        lead, lead_action = promote_queue_to_lead(db, queue_row)
                        processed += 1

                        if lead_action == "created":
                            created += 1
                        elif lead_action == "linked":
                            linked += 1
                        else:
                            updated += 1

                except Exception as exc:
                    errors.append(
                        {
                            "queue_id": str(queue_row.id),
                            "error": str(exc),
                        }
                    )

        return PromoteResponse(
            processed=processed,
            created=created,
            linked=linked,
            updated=updated,
            errors=errors,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/linkedin-profile-full", status_code=201)
def ingest_linkedin_profile_full(
    payload: LinkedInProfileFull,
    db: Session = Depends(db_dep),
):
    raw_data = {
        "full_name": payload.full_name,
        "headline": payload.headline,
        "location": payload.location,
        "company": payload.company,
        "about": payload.about,
        "connections": payload.connections,
        "profile_type": payload.profile_type,
        **payload.raw_data,
    }

    try:
        with db.begin():
            queue_row, queue_action = upsert_queue_row(
                db,
                raw_url=payload.profile_url,
                source=payload.source,
                source_query="chrome_extension",
                category_hint=payload.category_hint,
                raw_data=raw_data,
            )
            lead, lead_action = promote_queue_to_lead(db, queue_row)

        return {
            "status": "created" if queue_action == "inserted" else "updated",
            "queue_id": str(queue_row.id),
            "lead_id": str(lead.id),
            "queue_action": queue_action,
            "lead_action": lead_action if lead_action in ("created", "linked") else "updated",
        }
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Invalid LinkedIn URL",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/queue/{queue_id}/status", response_model=QueueItemOut)
def update_queue_status(
    queue_id: str,
    payload: QueueStatusUpdateRequest,
    db: Session = Depends(db_dep),
):
    q = db.execute(
        select(LeadDiscoveryQueue).where(LeadDiscoveryQueue.id == queue_id)
    ).scalar_one_or_none()

    if not q:
        raise HTTPException(status_code=404, detail="queue_id not found")

    if q.status == STATUS_DO_NOT_CONTACT and payload.status != STATUS_DO_NOT_CONTACT:
        raise HTTPException(
            status_code=422,
            detail="Cannot change status once set to do_not_contact",
        )

    if payload.status == STATUS_READY_FOR_OUTREACH and not q.lead_id:
        raise HTTPException(
            status_code=422,
            detail="Cannot mark ready_for_outreach without lead_id",
        )

    q.status = payload.status
    db.commit()
    db.refresh(q)

    return QueueItemOut.model_validate(q)