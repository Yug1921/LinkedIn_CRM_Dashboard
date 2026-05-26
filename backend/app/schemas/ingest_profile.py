from __future__ import annotations

from typing import Any, Dict, Optional, Literal

from pydantic import BaseModel, Field


class IngestLinkedinProfileRequest(BaseModel):
    raw_url: str

    # metadata
    source: Optional[str] = Field(default="chrome_extension")
    source_query: Optional[str] = Field(default="chrome_extension")
    category_hint: Optional[str] = None

    # full enriched payload from extension (keep flexible)
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class IngestLinkedinProfileResponse(BaseModel):
    queue_id: str
    lead_id: str
    queue_action: Literal["inserted", "updated"]
    lead_action: Literal["created", "linked", "updated"]