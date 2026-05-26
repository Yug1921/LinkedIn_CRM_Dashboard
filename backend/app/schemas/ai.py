from __future__ import annotations

from typing import Any, Dict, List, Optional, Literal

from pydantic import BaseModel, Field


class ScoreQueueRequest(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    force: bool = Field(default=False, description="If true, rescore even if ai already exists")


class ScoreQueueResponse(BaseModel):
    processed: int
    scored: int
    skipped: int
    errors: List[Dict[str, Any]]


class GenerateMessageRequest(BaseModel):
    queue_id: str
    force: bool = False


class GenerateMessageResponse(BaseModel):
    queue_id: str
    lead_id: Optional[str] = None
    message_draft: str
    score: Optional[int] = None
    tags: List[str] = Field(default_factory=list)
    audience_type: Optional[str] = None
    message_style: Optional[Literal["friendly_short", "formal_medium"]] = None