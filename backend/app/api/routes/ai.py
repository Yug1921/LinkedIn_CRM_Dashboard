from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.api.deps import db_dep
from app.schemas.ai import (
    ScoreQueueRequest,
    ScoreQueueResponse,
    GenerateMessageRequest,
    GenerateMessageResponse,
)
from app.models.models import LeadDiscoveryQueue, Lead
from app.constants import STATUS_ENRICHED, STATUS_AI_SCORED
from app.core.config import settings
from app.services.openrouter_client import OpenRouterClient
from app.services.ai_service import build_scoring_prompt, validate_ai_output

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _client() -> OpenRouterClient:
    return OpenRouterClient(
        api_key=settings.OPENROUTER_API_KEY,
        base_url=getattr(settings, "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        model=getattr(settings, "OPENROUTER_MODEL", "google/gemma-2-9b-it:free"),
    )


@router.post("/score-queue", response_model=ScoreQueueResponse)
def score_queue(payload: ScoreQueueRequest, db: Session = Depends(db_dep)):
    processed = 0
    scored = 0
    skipped = 0
    errors = []

    stmt = (
        select(LeadDiscoveryQueue)
        .where(LeadDiscoveryQueue.status == STATUS_ENRICHED)
        .where(LeadDiscoveryQueue.lead_id.isnot(None))
        .order_by(LeadDiscoveryQueue.created_at.asc())
        .limit(payload.limit)
    )
    rows = db.execute(stmt).scalars().all()

    try:
        client = _client()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    for queue_row in rows:
        processed += 1
        try:
            raw = queue_row.raw_data or {}
            ai_existing = raw.get("ai") or None

            if ai_existing and not payload.force:
                skipped += 1
                continue

            system, user = build_scoring_prompt(raw, queue_row.category_hint)
            ai_obj = client.chat_json(system=system, user=user, max_tokens=450)
            ai = validate_ai_output(ai_obj)

            raw["ai"] = ai
            queue_row.raw_data = raw
            queue_row.status = STATUS_AI_SCORED

            lead = db.execute(select(Lead).where(Lead.id == queue_row.lead_id)).scalar_one_or_none()
            if lead:
                lead.relevance_score = ai["score"]

            db.commit()
            scored += 1

        except Exception as exc:
            db.rollback()
            errors.append({"queue_id": str(queue_row.id), "error": str(exc)})

    return ScoreQueueResponse(processed=processed, scored=scored, skipped=skipped, errors=errors)


@router.post("/generate-message", response_model=GenerateMessageResponse)
def generate_message(payload: GenerateMessageRequest, db: Session = Depends(db_dep)):
    queue_row = db.execute(
        select(LeadDiscoveryQueue).where(LeadDiscoveryQueue.id == payload.queue_id)
    ).scalar_one_or_none()
    if not queue_row:
        raise HTTPException(status_code=404, detail="queue_id not found")

    raw = queue_row.raw_data or {}
    ai_existing = raw.get("ai")

    if ai_existing and not payload.force and isinstance(ai_existing, dict) and ai_existing.get("message_draft"):
        return GenerateMessageResponse(
            queue_id=str(queue_row.id),
            lead_id=str(queue_row.lead_id) if queue_row.lead_id else None,
            message_draft=str(ai_existing.get("message_draft")),
            score=ai_existing.get("score"),
            tags=ai_existing.get("tags") or [],
            audience_type=ai_existing.get("audience_type"),
            message_style=ai_existing.get("message_style"),
        )

    try:
        client = _client()
        system, user = build_scoring_prompt(raw, queue_row.category_hint)
        ai_obj = client.chat_json(system=system, user=user, max_tokens=450)
        ai = validate_ai_output(ai_obj)

        raw["ai"] = ai
        queue_row.raw_data = raw
        queue_row.status = STATUS_AI_SCORED
        db.commit()

        return GenerateMessageResponse(
            queue_id=str(queue_row.id),
            lead_id=str(queue_row.lead_id) if queue_row.lead_id else None,
            message_draft=ai["message_draft"],
            score=ai["score"],
            tags=ai["tags"],
            audience_type=ai.get("audience_type"),
            message_style=ai.get("message_style"),
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))