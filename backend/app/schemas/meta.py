from __future__ import annotations
from typing import Dict, List, Any
from pydantic import BaseModel


class EnumsResponse(BaseModel):
    lead_category_hints: List[str]
    discovery_statuses: List[str]
    lead_statuses: List[str]
    countries_targeted: Dict[str, Any]