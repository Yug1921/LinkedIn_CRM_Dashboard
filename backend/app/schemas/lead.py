from typing import Optional, Any, Dict, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID

# Keep enums as strings in the API (simple for frontend)
LeadCategory = str
LeadStatus = str
DataQuality = str


class LeadBase(BaseModel):
    full_name: str = Field(..., max_length=500)
    company_or_brand: Optional[str] = None
    job_title: Optional[str] = None
    bio: Optional[str] = None

    category: LeadCategory
    status: Optional[LeadStatus] = "new"
    data_quality: Optional[DataQuality] = "unverified"

    country: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None

    email_primary: Optional[EmailStr] = None
    email_secondary: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None

    linkedin_url: Optional[str] = None
    linkedin_id: Optional[str] = None
    twitter_handle: Optional[str] = None
    instagram_handle: Optional[str] = None
    telegram_handle: Optional[str] = None
    youtube_channel: Optional[str] = None
    other_social: Optional[Dict[str, Any]] = None

    relevance_score: Optional[float] = 0.0
    engagement_score: Optional[float] = 0.0
    ai_score: Optional[float] = None

    source: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    ai_outreach_template: Optional[str] = None
    ai_draft_message: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    company_or_brand: Optional[str] = None
    job_title: Optional[str] = None
    bio: Optional[str] = None

    category: Optional[LeadCategory] = None
    status: Optional[LeadStatus] = None
    data_quality: Optional[DataQuality] = None

    country: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None

    email_primary: Optional[EmailStr] = None
    email_secondary: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None

    linkedin_url: Optional[str] = None
    linkedin_id: Optional[str] = None
    twitter_handle: Optional[str] = None
    instagram_handle: Optional[str] = None
    telegram_handle: Optional[str] = None
    youtube_channel: Optional[str] = None
    other_social: Optional[Dict[str, Any]] = None

    relevance_score: Optional[float] = None
    engagement_score: Optional[float] = None
    ai_score: Optional[float] = None

    source: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None


class LeadOut(LeadBase):
    email_primary: Optional[str] = None
    email_secondary: Optional[str] = None
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_contacted_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # enables ORM -> Pydantic conversion


class LeadStatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None


class LeadListResponse(BaseModel):
    total: int
    items: List[LeadOut]
    limit: int
    offset: int