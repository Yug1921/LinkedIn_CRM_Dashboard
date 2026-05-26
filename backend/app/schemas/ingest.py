from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class IngestUrlItem(BaseModel):
    raw_url: str
    source: Optional[str] = None
    source_query: Optional[str] = None
    category_hint: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None


class IngestLinkedinUrlsRequest(BaseModel):
    urls: List[IngestUrlItem] = Field(..., min_length=1, max_length=500)


class IngestError(BaseModel):
    raw_url: str
    reason: str


class IngestLinkedinUrlsResponse(BaseModel):
    inserted: int
    skipped: int
    errors: List[IngestError]