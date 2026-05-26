from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import db_dep
from app.core.config import settings
from app.models.models import Lead
from app.services.openrouter_client import OpenRouterClient

router = APIRouter()
logger = logging.getLogger(__name__)


class ScoreLeadResponse(BaseModel):
    lead_id: str
    score: int
    reasoning: str


class ScoreAllResponse(BaseModel):
    processed: int
    scored: int
    failed: int
    skipped: int


def _lead_category(lead: Lead) -> str:
    category = getattr(lead.category, "value", lead.category)
    if not category:
        return "Unknown"
    text_value = str(category).strip()
    return text_value or "Unknown"


def _lead_headline(lead: Lead) -> str:
    headline = (lead.job_title or "").strip()
    return headline or "Unknown"


def _lead_location(lead: Lead) -> str:
    parts = [lead.city, lead.country, lead.region]
    values = [part.strip() for part in parts if isinstance(part, str) and part.strip()]
    return ", ".join(values) if values else "Unknown"


def _lead_company(lead: Lead) -> str:
    company = (lead.company_or_brand or "").strip()
    return company or "Unknown"


def _lead_about(lead: Lead) -> str:
    notes = (lead.notes or "").strip()
    if notes:
        return notes
    template = (lead.ai_outreach_template or "").strip()
    if template:
        return template
    return "No information"


def _build_prompt(lead: Lead) -> Tuple[str, str]:
    system = (
        "You are a lead scoring assistant for GoTeeOff, a golf technology platform that also has a Web3 token (GTOT). "
        "Score leads on their relevance for outreach. Return ONLY a JSON object with two keys: score (integer 0-100) "
        "and reasoning (one sentence max 100 chars). No other text."
    )

    user = f"""Score this LinkedIn lead for GoTeeOff outreach relevance.

Name: {lead.full_name}
Headline: {_lead_headline(lead)}
Location: {_lead_location(lead)}
Company: {_lead_company(lead)}
Category: {_lead_category(lead)}
About: {_lead_about(lead)}

Scoring guide:
- 80-100: Perfect fit. Crypto influencer in target country OR golf professional/association in APAC OR blockchain expert.
- 60-79: Good fit. Related industry, right region, or relevant audience.
- 40-59: Possible fit. Adjacent industry or unclear relevance.
- 0-39: Poor fit. Wrong industry, incomplete profile, or irrelevant.

Return JSON only: {{"score": , "reasoning": ""}}"""

    return system, user


def _client() -> OpenRouterClient:
    return OpenRouterClient(
        api_key=settings.OPENROUTER_API_KEY,
        base_url=getattr(settings, "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        model=getattr(settings, "OPENROUTER_MODEL", "openai/gpt-4o-mini"),
    )


def _parse_scoring_response(payload: Dict[str, Any]) -> Tuple[int, str]:
    score = payload.get("score")
    reasoning = payload.get("reasoning")
    if not isinstance(score, int) or isinstance(score, bool) or score < 0 or score > 100:
        raise ValueError("Invalid score")
    if not isinstance(reasoning, str) or not reasoning.strip():
        raise ValueError("Invalid reasoning")

    return score, reasoning.strip()[:100]


async def _call_openrouter(lead: Lead, client: OpenRouterClient) -> Tuple[int, str]:
    system, user = _build_prompt(lead)
    try:
        data = await asyncio.to_thread(client.chat_json, system=system, user=user, max_tokens=100)
    except Exception:
        logger.exception("OpenRouter request failed for lead %s", lead.id)
        raise

    return _parse_scoring_response(data)


def _update_lead_score(db: Session, lead_id: UUID, score: int, reasoning: str) -> None:
    db.execute(
        text(
            """
            UPDATE leads
            SET ai_score = :score,
                ai_score_reasoning = :reasoning,
                updated_at = now()
            WHERE id = :lead_id
            """
        ),
        {"score": score, "reasoning": reasoning, "lead_id": lead_id},
    )
    db.commit()


@router.post("/leads/{lead_id}/score", response_model=ScoreLeadResponse)
async def score_single_lead(lead_id: UUID, db: Session = Depends(db_dep)):
    try:
        client = _client()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    lead = db.execute(select(Lead).where(Lead.id == lead_id)).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="lead_id not found")

    try:
        score, reasoning = await _call_openrouter(lead, client)
        _update_lead_score(db, lead.id, score, reasoning)
        return ScoreLeadResponse(lead_id=str(lead.id), score=score, reasoning=reasoning)
    except Exception as exc:
        db.rollback()
        logger.exception("OpenRouter scoring failed for lead %s", lead_id)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/leads/score-all", response_model=ScoreAllResponse)
async def score_all_leads(db: Session = Depends(db_dep)):
    try:
        client = _client()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    processed = 0
    scored = 0
    failed = 0
    skipped = 0
    failed_ids: set[UUID] = set()

    while True:
        stmt = (
            select(Lead)
            .where(Lead.ai_score.is_(None))
            .order_by(Lead.created_at.asc(), Lead.id.asc())
            .limit(10)
        )
        if failed_ids:
            stmt = stmt.where(~Lead.id.in_(list(failed_ids)))

        batch = db.execute(stmt).scalars().all()
        if not batch:
            break

        for index, lead in enumerate(batch):
            processed += 1
            try:
                score, reasoning = await _call_openrouter(lead, client)
                _update_lead_score(db, lead.id, score, reasoning)
                scored += 1
            except Exception as exc:
                db.rollback()
                failed_ids.add(lead.id)
                failed += 1
                logger.exception("OpenRouter scoring failed for lead %s", lead.id)

            if index < len(batch) - 1:
                await asyncio.sleep(0.5)

        if len(batch) == 10:
            await asyncio.sleep(1)

    return ScoreAllResponse(processed=processed, scored=scored, failed=failed, skipped=skipped)
