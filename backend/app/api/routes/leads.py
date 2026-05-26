from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_dep
from app.models.models import LeadDiscoveryQueue, Lead
from app.schemas.lead import LeadCreate, LeadUpdate, LeadOut, LeadStatusUpdateRequest, LeadListResponse
from app.schemas.draft import LeadDraftRequest, LeadDraftResponse
from app.services import lead_service
from app.core.config import settings
from app.services.openrouter_client import OpenRouterClient

router = APIRouter(prefix="/api/leads", tags=["leads"])


class LeadDraftOut(BaseModel):
    lead_id: UUID
    queue_id: Optional[UUID] = None
    message_draft: Optional[str] = None
    source: str


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, db: Session = Depends(db_dep)):
    return lead_service.create_lead(db, payload)


@router.get("", response_model=LeadListResponse)
def list_leads(
    db: Session = Depends(db_dep),
    category: Optional[List[str]] = Query(default=None),
    status_: Optional[str] = Query(default=None, alias="status"),
    source: Optional[str] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    score_min: Optional[float] = Query(default=None, ge=0, le=100, alias="score_min"),
    score_max: Optional[float] = Query(default=None, ge=0, le=100, alias="score_max"),
    sort_by: str = Query(default="created_at", pattern="^(score|created_at|full_name)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    try:
        total, items = lead_service.list_leads_paginated(
            db,
            category=category,
            status=status_,
            source=source,
            country=country,
            search=search,
            score_min=score_min,
            score_max=score_max,
            sort_by=sort_by,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return LeadListResponse(total=total, items=items, limit=limit, offset=offset)


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: UUID, db: Session = Depends(db_dep)):
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/{lead_id}/status", response_model=LeadOut)
def update_lead_status(lead_id: UUID, payload: LeadStatusUpdateRequest, db: Session = Depends(db_dep)):
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    try:
        return lead_service.update_lead_status(db, lead, payload.status, payload.notes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{lead_id}/draft", response_model=LeadDraftOut)
def get_lead_draft(lead_id: UUID, db: Session = Depends(db_dep)):
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    queue_row = db.execute(
        select(LeadDiscoveryQueue)
        .where(LeadDiscoveryQueue.lead_id == lead_id)
        .order_by(LeadDiscoveryQueue.updated_at.desc())
    ).scalars().first()

    if queue_row:
        raw_data = queue_row.raw_data or {}
        ai_data = raw_data.get("ai") or {}
        message_draft = ai_data.get("message_draft")
        if message_draft:
            return LeadDraftOut(
                lead_id=lead_id,
                queue_id=queue_row.id,
                message_draft=message_draft,
                source="queue",
            )

    if lead.ai_outreach_template:
        return LeadDraftOut(
            lead_id=lead_id,
            queue_id=None,
            message_draft=lead.ai_outreach_template,
            source="lead",
        )

    raise HTTPException(status_code=404, detail="No AI draft found for this lead")


@router.post("/{lead_id}/draft", response_model=LeadDraftResponse)
def generate_lead_draft(lead_id: str, payload: LeadDraftRequest, db: Session = Depends(db_dep)):
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    raw = lead.raw_data or {}

    system = (
        "You are an SDR assistant for GoTeeOff CRM."
        " Return ONLY a JSON object with a single key 'draft' whose value is the outreach message string."
        " Do not include any extra commentary."
    )

    user_parts = [
        f"Lead name: {lead.full_name}",
        f"Company: {lead.company_or_brand or ''}",
        f"Headline: {raw.get('headline','')}",
        f"Bio: {lead.bio or raw.get('about','') or ''}",
        f"Outreach type: {payload.outreach_type}",
        f"Tone: {payload.tone}",
    ]

    if payload.custom_note:
        user_parts.append(f"Custom note: {payload.custom_note}")

    # enforce length limits
    max_chars = 300 if payload.outreach_type == "connection_request" else 500
    user_parts.append(f"Length limit: {max_chars} characters max.")

    user = "\n".join(user_parts)

    # --- new implementation: use plain-text chat and persist to ai_outreach_template
    def _char_limit(outreach_type: str) -> int:
        return 300 if outreach_type == "connection_request" else 500

    def _truncate_to_limit(text: str, limit: int) -> str:
        t = (text or "").strip()
        if len(t) <= limit:
            return t
        return t[: limit - 1].rstrip() + "…"

    try:
        model = getattr(settings, "OPENROUTER_MODEL", "google/gemma-2-9b-it:free")
        client = OpenRouterClient(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=getattr(settings, "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
            model=model,
        )

        limit = _char_limit(payload.outreach_type)

        # Build prompt using lead fields you already store
        full_name = lead.full_name or "there"
        headline = lead.job_title or ""
        company = lead.company_or_brand or ""
        location = ", ".join([x for x in [lead.city, lead.country, lead.region] if x])
        bio = lead.bio or ""
        notes = lead.notes or ""
        category = lead.category.value if getattr(lead.category, "value", None) else str(lead.category)

        system = (
            "You write concise, high-conversion LinkedIn outreach messages for GoTeeOff.\n"
            "Return ONLY the message text. No quotes. No markdown. No emojis.\n"
            f"Hard limit: {limit} characters.\n"
            "Constraints:\n"
            "- Non-spammy, human, specific.\n"
            "- Include a light GoTeeOff 1-liner.\n"
            "- Include one clear CTA question at the end.\n"
            "- If outreach_type is connection_request: keep it extra short.\n"
            "- If direct_message: slightly more context.\n"
            "- If follow_up: reference prior touch politely.\n"
        )

        user = (
            "Company positioning:\n"
            "GoTeeOff is the world's first AI-powered golf travel platform — connecting golfers to 800+ courses, "
            "8,000+ services, and Web3 rewards across Asia-Pacific (hotels, tours, experiences — all in one place).\n\n"
            "Lead:\n"
            f"- full_name: {full_name}\n"
            f"- headline: {headline}\n"
            f"- company: {company}\n"
            f"- location: {location}\n"
            f"- category: {category}\n"
            f"- bio: {bio}\n"
            f"- notes: {notes}\n\n"
            "Draft requirements:\n"
            f"- outreach_type: {payload.outreach_type}\n"
            f"- tone: {payload.tone}\n"
            f"- custom_note: {payload.custom_note or ''}\n\n"
            "Write the best outreach message now."
        )

        # call plain text chat and capture usage
        text, usage = client.chat_text(system=system, user=user, max_tokens=220)

        draft = _truncate_to_limit(text, limit)
        if not draft:
            raise ValueError("Empty draft returned from model")

        # Persist the generated draft on the lead before committing.
        lead.ai_outreach_template = draft
        lead.ai_draft_message = draft
        db.commit()

        # derive token usage if available
        tokens_used = 0
        try:
            if usage and isinstance(usage, dict):
                tokens_used = int(
                    usage.get("total_tokens")
                    or (usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0))
                )
        except Exception:
            tokens_used = 0

        return LeadDraftResponse(
            lead_id=lead.id,
            outreach_type=payload.outreach_type,
            draft=draft,
            tokens_used=tokens_used,
            model=model,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: UUID, payload: LeadUpdate, db: Session = Depends(db_dep)):
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead_service.update_lead(db, lead, payload)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: UUID, db: Session = Depends(db_dep)):
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead_service.delete_lead(db, lead)
    return None