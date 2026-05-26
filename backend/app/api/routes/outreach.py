from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_dep
from app.models.models import (
    Lead,
    LeadStatus,
    OutreachLog,
    OutreachChannel,
    OutreachStatus,
    OutreachType,
)
from app.schemas.outreach import OutreachCreateRequest, OutreachOut

router = APIRouter(prefix="/api", tags=["outreach"])


@router.post("/leads/{lead_id}/outreach", response_model=OutreachOut)
def create_outreach_log(
    lead_id: UUID,
    payload: OutreachCreateRequest,
    db: Session = Depends(db_dep),
):
    lead = db.execute(select(Lead).where(Lead.id == lead_id)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="lead_id not found")

    # If client doesn't send sent_at, set it when status is "sent"
    sent_at = payload.sent_at
    if payload.status == "sent" and sent_at is None:
        sent_at = datetime.now(timezone.utc)

    row = OutreachLog(
        lead_id=lead_id,
        channel=OutreachChannel(payload.channel),
        status=OutreachStatus(payload.status),
        outreach_type=OutreachType(payload.outreach_type),
        subject=payload.subject,
        message_body=payload.message_body,
        ai_generated=payload.ai_generated,
        sent_at=sent_at,
        notes=payload.notes,
    )

    db.add(row)
    if payload.status == "sent":
        lead.status = LeadStatus.CONTACTED
        lead.last_contacted_at = sent_at
    db.commit()
    db.refresh(row)
    return OutreachOut.model_validate(row)


@router.get("/leads/{lead_id}/outreach", response_model=list[OutreachOut])
def list_outreach_logs(
    lead_id: UUID,
    db: Session = Depends(db_dep),
):
    lead = db.execute(select(Lead).where(Lead.id == lead_id)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="lead_id not found")

    rows = db.execute(
        select(OutreachLog)
        .where(OutreachLog.lead_id == lead_id)
        .order_by(OutreachLog.created_at.asc())
    ).scalars().all()

    return [OutreachOut.model_validate(r) for r in rows]
