from __future__ import annotations

from typing import Tuple, Optional, Dict, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import (
    QUEUE_HINT_TO_LEAD_CATEGORY,
    STATUS_ENRICHED,
)
from app.models.models import LeadDiscoveryQueue, Lead, LeadCategory
from app.utils.url_normalizer import normalize_linkedin_url


def _extract_profile_fields(raw_data: Dict[str, Any]) -> Dict[str, Optional[str]]:
    # Your extension stores these keys already
    return {
        "full_name": (raw_data.get("full_name") or "").strip() or None,
        "headline": (raw_data.get("headline") or "").strip() or None,
        "location": (raw_data.get("location") or "").strip() or None,
        "company": (raw_data.get("company") or "").strip() or None,
        "about": (raw_data.get("about") or "").strip() or None,
        "profile_type": (raw_data.get("profile_type") or "").strip() or None,
    }


def upsert_queue_row(
    db: Session,
    *,
    raw_url: str,
    source: Optional[str],
    source_query: Optional[str],
    category_hint: Optional[str],
    raw_data: Dict[str, Any],
) -> Tuple[LeadDiscoveryQueue, str]:
    normalized = normalize_linkedin_url(raw_url)

    existing = db.execute(
        select(LeadDiscoveryQueue).where(LeadDiscoveryQueue.normalized_url == normalized)
    ).scalar_one_or_none()

    if existing:
        existing.raw_url = raw_url
        existing.source = source
        existing.source_query = source_query
        existing.category_hint = category_hint
        existing.status = STATUS_ENRICHED
        existing.raw_data = raw_data
        return existing, "updated"

    row = LeadDiscoveryQueue(
        raw_url=raw_url,
        normalized_url=normalized,
        source=source,
        source_query=source_query,
        category_hint=category_hint,
        status=STATUS_ENRICHED,
        raw_data=raw_data,
    )
    db.add(row)
    db.flush()
    return row, "inserted"


def promote_queue_to_lead(db: Session, queue: LeadDiscoveryQueue) -> Tuple[Lead, str]:
    """
    Ensure a Lead exists for this queue row and is linked via queue.lead_id.
    Dedup by Lead.linkedin_url == queue.normalized_url.
    """
    extracted = _extract_profile_fields(queue.raw_data or {})
    full_name = extracted["full_name"] or (
        "Company" if extracted["profile_type"] == "company" else "LinkedIn Member"
    )

    mapped = None
    if queue.category_hint:
        mapped = QUEUE_HINT_TO_LEAD_CATEGORY.get(queue.category_hint)

    if not mapped:
        mapped = "crypto_influencer"

    existing = db.execute(
        select(Lead).where(Lead.linkedin_url == queue.normalized_url)
    ).scalar_one_or_none()

    if existing:
        changed = False

        if not existing.full_name and full_name:
            existing.full_name = full_name
            changed = True

        if not existing.job_title and extracted["headline"]:
            existing.job_title = extracted["headline"]
            changed = True

        if not existing.company_or_brand and extracted["company"]:
            existing.company_or_brand = extracted["company"]
            changed = True

        if not existing.bio and extracted["about"]:
            existing.bio = extracted["about"]
            changed = True

        if not existing.source and queue.source:
            existing.source = queue.source
            changed = True

        if not existing.source_url and queue.source_query:
            existing.source_url = queue.source_query
            changed = True

        if not existing.raw_data and queue.raw_data:
            existing.raw_data = queue.raw_data
            changed = True

        if not existing.category and mapped:
            existing.category = LeadCategory(mapped)
            changed = True

        if queue.lead_id != existing.id:
            queue.lead_id = existing.id
            changed = True

        return existing, "updated" if changed else "linked"

    lead = Lead(
        full_name=full_name,
        company_or_brand=extracted["company"],
        job_title=extracted["headline"],
        bio=extracted["about"],
        category=LeadCategory(mapped),
        linkedin_url=queue.normalized_url,
        source=queue.source,
        source_url=queue.source_query,
        raw_data=queue.raw_data,
    )
    db.add(lead)
    db.flush()

    queue.lead_id = lead.id
    return lead, "created"