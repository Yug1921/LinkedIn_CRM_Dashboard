from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

# Restrictive enum for safety: only allow these transitions
AllowedQueueStatusUpdate = Literal["ready_for_outreach", "do_not_contact", "enriched"]


class QueueStatusUpdateRequest(BaseModel):
    status: AllowedQueueStatusUpdate
