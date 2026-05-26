from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field


OutreachType = Literal["connection_request", "direct_message", "follow_up"]
Tone = Literal["professional", "casual", "friendly"]


class LeadDraftRequest(BaseModel):
    outreach_type: OutreachType
    tone: Tone = Field(default="professional")
    custom_note: Optional[str] = None


class LeadDraftResponse(BaseModel):
    lead_id: UUID
    outreach_type: OutreachType
    draft: str
    tokens_used: int = 0
    model: str
