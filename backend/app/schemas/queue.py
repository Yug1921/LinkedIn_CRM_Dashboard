from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class QueueItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    raw_url: str
    normalized_url: str
    source: Optional[str] = None
    source_query: Optional[str] = None
    category_hint: Optional[str] = None
    status: str
    raw_data: Dict[str, Any] = Field(default_factory=dict)
    lead_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class QueueListResponse(BaseModel):
    total: int
    items: List[QueueItemOut]