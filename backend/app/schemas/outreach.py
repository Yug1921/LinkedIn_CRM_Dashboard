from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# keep the allowed values exactly aligned with your DB enum strings
OutreachTypeStr = Literal["connection_request", "direct_message", "email", "inmail", "follow_up"]
OutreachChannelStr = Literal["email", "linkedin", "twitter", "telegram", "whatsapp", "other"]
OutreachStatusStr = Literal["planned", "sent", "opened", "replied", "bounced"]


class OutreachCreateRequest(BaseModel):
    channel: OutreachChannelStr = Field(default="linkedin")
    outreach_type: OutreachTypeStr
    status: OutreachStatusStr = Field(default="sent")

    subject: Optional[str] = None
    message_body: Optional[str] = None
    ai_generated: bool = False

    sent_at: Optional[datetime] = None
    notes: Optional[str] = None


class OutreachOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lead_id: UUID

    channel: str
    outreach_type: Optional[str] = None
    status: str

    subject: Optional[str] = None
    message_body: Optional[str] = None
    ai_generated: bool

    sent_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    reply_content: Optional[str] = None

    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
