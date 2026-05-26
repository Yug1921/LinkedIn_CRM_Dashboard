from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from app.constants import (
    HINT_CRYPTO_INFLUENCER,
    HINT_BLOCKCHAIN_PROJECT,
    HINT_BLOCKCHAIN_EXPERT,
    HINT_GOLF_USER_ORG,
    HINT_TRAVEL_USER_ORG,
)

GOTEEOFF_POSITIONING = (
    "GoTeeOff is the world's first AI-powered golf travel platform — connecting golfers to 800+ courses, "
    "8,000+ services, and Web3 rewards across Asia-Pacific. Not just golf: hotels, tours, experiences — "
    "all in one place for the golfer, the family, for everyone."
)


def choose_style(category_hint: Optional[str]) -> str:
    if category_hint in (HINT_CRYPTO_INFLUENCER, HINT_BLOCKCHAIN_EXPERT):
        return "friendly_short"
    if category_hint in (HINT_GOLF_USER_ORG, HINT_TRAVEL_USER_ORG, HINT_BLOCKCHAIN_PROJECT):
        return "formal_medium"
    return "friendly_short"


def build_scoring_prompt(raw_data: Dict[str, Any], category_hint: Optional[str]) -> Tuple[str, str]:
    full_name = (raw_data.get("full_name") or "").strip() or "there"
    headline = (raw_data.get("headline") or "").strip()
    company = (raw_data.get("company") or "").strip()
    location = (raw_data.get("location") or "").strip()
    about = (raw_data.get("about") or "").strip()
    profile_type = (raw_data.get("profile_type") or "").strip()

    style = choose_style(category_hint)

    system = (
        "You are an SDR assistant for GoTeeOff CRM. "
        "You must return ONLY valid JSON. No extra text.\n"
        "Scoring goal: prioritize leads that will help grow GoTeeOff LinkedIn followers and partnerships.\n"
        "Output JSON schema:\n"
        "{"
        '"score": integer 0-100,'
        '"tags": array of short strings,'
        '"audience_type": one of ["influencer","b2b_partner","expert","project","other"],'
        '"reason": one sentence,'
        '"message_style": one of ["friendly_short","formal_medium"],'
        '"message_draft": string'
        "}\n"
        "Rules:\n"
        "- Keep message compliant: no spammy claims, no aggressive selling.\n"
        "- If style is friendly_short: 2–3 lines max.\n"
        "- If style is formal_medium: 6–8 lines max.\n"
        "- Mention GoTeeOff positioning briefly.\n"
        "- Offer types: barter collaboration, GTOT-based collab, B2B partnership.\n"
    )

    user = (
        f"GoTeeOff positioning:\n{GOTEEOFF_POSITIONING}\n\n"
        f"Lead context:\n"
        f"- category_hint: {category_hint}\n"
        f"- profile_type: {profile_type}\n"
        f"- full_name: {full_name}\n"
        f"- headline: {headline}\n"
        f"- company: {company}\n"
        f"- location: {location}\n"
        f"- about: {about}\n\n"
        f"Choose message_style='{style}' unless you have a strong reason to change it.\n"
        f"Now return the JSON."
    )

    return system, user


def validate_ai_output(obj: Dict[str, Any]) -> Dict[str, Any]:
    score = obj.get("score")
    if not isinstance(score, int):
        raise ValueError("AI output missing integer score")
    score = max(0, min(100, score))

    tags = obj.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    tags = [str(tag)[:40] for tag in tags][:10]

    message_draft = obj.get("message_draft")
    if not isinstance(message_draft, str) or not message_draft.strip():
        raise ValueError("AI output missing message_draft")

    return {
        "score": score,
        "tags": tags,
        "audience_type": obj.get("audience_type"),
        "reason": obj.get("reason"),
        "message_style": obj.get("message_style"),
        "message_draft": message_draft.strip(),
    }