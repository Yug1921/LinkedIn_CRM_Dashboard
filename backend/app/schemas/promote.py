from __future__ import annotations

from typing import List

from pydantic import BaseModel


class PromoteResponse(BaseModel):
    processed: int
    created: int
    linked: int
    updated: int
    errors: List[dict]