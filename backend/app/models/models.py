"""
Database Models — CRM Lead Management System

Tables:
  users              — CRM users (your team)
  leads              — Core lead records (all categories)
  lead_crypto        — Crypto influencer detail
  lead_blockchain    — Blockchain project/expert detail
  lead_golf          — Golf industry detail
  lead_travel        — Travel industry detail
  outreach_logs      — Every contact attempt
  tags               — Flexible label system
  lead_tags          — Many-to-many: leads <-> tags
  audit_logs         — Data quality audit trail
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Float,
    Integer, ForeignKey, Enum, JSON, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.db.database import Base


def enum_values(enum_cls):
    return [e.value for e in enum_cls]


def enum_names(enum_cls):
    return [e.name for e in enum_cls]


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class LeadCategory(str, enum.Enum):
    CRYPTO_INFLUENCER = "crypto_influencer"
    BLOCKCHAIN_PROJECT = "blockchain_project"
    BLOCKCHAIN_EXPERT = "blockchain_expert"
    GOLF_INDUSTRY = "golf_industry"
    TRAVEL_INDUSTRY = "travel_industry"

class LeadStatus(str, enum.Enum):
    NEW = "new"
    QUALIFIED = "qualified"
    CONTACTED = "contacted"
    RESPONDED = "responded"
    CONVERTED = "converted"
    DISQUALIFIED = "disqualified"

class OutreachStatus(str, enum.Enum):
    PLANNED = "planned"
    SENT = "sent"
    OPENED = "opened"
    REPLIED = "replied"
    BOUNCED = "bounced"

class OutreachChannel(str, enum.Enum):
    EMAIL = "email"
    LINKEDIN = "linkedin"
    TWITTER = "twitter"
    TELEGRAM = "telegram"
    WHATSAPP = "whatsapp"
    OTHER = "other"


class OutreachType(str, enum.Enum):
    CONNECTION_REQUEST = "connection_request"
    DIRECT_MESSAGE = "direct_message"
    EMAIL = "email"
    INMAIL = "inmail"
    FOLLOW_UP = "follow_up"

class DataQuality(str, enum.Enum):
    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    FLAGGED = "flagged"
    REJECTED = "rejected"

class BlockchainEcosystem(str, enum.Enum):
    POLYGON = "polygon"
    SOLANA = "solana"
    ETHEREUM = "ethereum"
    OTHER = "other"

class ExpertType(str, enum.Enum):
    SECURITY_AUDITOR = "security_auditor"
    LAWYER = "lawyer"
    DEVELOPER = "developer"
    CONSULTANT = "consultant"
    OTHER = "other"


# ─────────────────────────────────────────────
# Users (CRM team members)
# ─────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    outreach_logs = relationship("OutreachLog", back_populates="created_by_user")
    audit_logs = relationship("AuditLog", back_populates="user")


# ─────────────────────────────────────────────
# Core Lead (shared fields across all categories)
# ─────────────────────────────────────────────

class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity
    full_name = Column(String(500), nullable=False)
    company_or_brand = Column(String(500))
    job_title = Column(String(500))
    bio = Column(Text)

    # Category & Status
    category = Column(Enum(LeadCategory), nullable=False, index=True)
    status = Column(Enum(LeadStatus), default=LeadStatus.NEW, index=True)
    data_quality = Column(Enum(DataQuality), default=DataQuality.UNVERIFIED, index=True)

    # Geography
    country = Column(String(100), index=True)
    city = Column(String(100))
    region = Column(String(100))  # e.g. "APAC", "ASEAN"

    # Contact
    email_primary = Column(String(255), index=True)
    email_secondary = Column(String(255))
    phone = Column(String(50))
    website = Column(String(500))

    # Social profiles
    linkedin_url = Column(String(500))
    linkedin_id = Column(String(100))
    twitter_handle = Column(String(100))
    instagram_handle = Column(String(100))
    telegram_handle = Column(String(100))
    youtube_channel = Column(String(500))
    other_social = Column(JSON)  # {"platform": "url"}

    # AI enrichment
    ai_category_confidence = Column(Float)   # 0.0 – 1.0
    ai_summary = Column(Text)               # AI-generated summary
    ai_outreach_template = Column(Text)     # AI-generated outreach draft
    ai_draft_message = Column(Text, nullable=True)  # AI-generated single-shot draft saved by endpoint
    ai_score = Column(Float, nullable=True)  # AI score on 0-100 scale
    ai_score_reasoning = Column(Text, nullable=True)  # AI scoring rationale
    ai_tags = Column(JSON)                  # ["defi", "nft", "gaming", ...]
    ai_processed_at = Column(DateTime(timezone=True))

    # Scoring
    relevance_score = Column(Float, default=0.0)   # 0-100
    engagement_score = Column(Float, default=0.0)  # 0-100

    # Source tracking
    source = Column(String(255))  # "google_scrape", "apollo", "manual", etc.
    source_url = Column(String(500))
    scraped_at = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_contacted_at = Column(DateTime(timezone=True))

    # Notes
    notes = Column(Text)
    raw_data = Column(MutableDict.as_mutable(JSONB), nullable=True)  # Original scraped payload

    # Relationships
    crypto_detail = relationship("LeadCrypto", back_populates="lead", uselist=False, cascade="all, delete-orphan")
    blockchain_detail = relationship("LeadBlockchain", back_populates="lead", uselist=False, cascade="all, delete-orphan")
    golf_detail = relationship("LeadGolf", back_populates="lead", uselist=False, cascade="all, delete-orphan")
    travel_detail = relationship("LeadTravel", back_populates="lead", uselist=False, cascade="all, delete-orphan")
    outreach_logs = relationship("OutreachLog", back_populates="lead", cascade="all, delete-orphan")
    lead_tags = relationship("LeadTag", back_populates="lead", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="lead", cascade="all, delete-orphan")

    # Indexes for common queries
    __table_args__ = (
        Index("idx_leads_category_country", "category", "country"),
        Index("idx_leads_category_status", "category", "status"),
        Index("idx_leads_relevance", "relevance_score"),
    )


# ─────────────────────────────────────────────
# Category Detail Tables
# ─────────────────────────────────────────────

class LeadCrypto(Base):
    """Extra fields specific to Crypto Influencers"""
    __tablename__ = "lead_crypto"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), unique=True)

    # Audience metrics
    twitter_followers = Column(Integer)
    youtube_subscribers = Column(Integer)
    instagram_followers = Column(Integer)
    telegram_members = Column(Integer)
    total_reach = Column(Integer)  # sum of all platforms

    # Content focus
    crypto_niches = Column(JSON)    # ["defi", "nft", "trading", "web3", ...]
    chains_covered = Column(JSON)  # ["ethereum", "solana", "polygon", ...]

    # Collaboration
    past_promotions = Column(JSON)  # [{"project": "...", "year": 2023}, ...]
    collab_rate_usd = Column(Float)  # estimated rate
    accepts_token_payment = Column(Boolean)
    has_kol_experience = Column(Boolean)

    # Engagement
    avg_engagement_rate = Column(Float)  # percentage
    verified_account = Column(Boolean, default=False)

    lead = relationship("Lead", back_populates="crypto_detail")


class LeadBlockchain(Base):
    """Extra fields for Blockchain Projects and Experts"""
    __tablename__ = "lead_blockchain"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), unique=True)

    # Project or Expert
    ecosystem = Column(Enum(BlockchainEcosystem), index=True)
    expert_type = Column(Enum(ExpertType))  # null if it's a project

    # Project fields
    project_name = Column(String(500))
    token_symbol = Column(String(20))
    mainnet_live = Column(Boolean)
    tvl_usd = Column(Float)          # Total Value Locked
    github_url = Column(String(500))
    whitepaper_url = Column(String(500))
    funding_stage = Column(String(100))  # "seed", "series-a", etc.
    investors = Column(JSON)             # ["a16z", "Binance Labs", ...]

    # Expert fields
    specializations = Column(JSON)      # ["smart contract audit", "DeFi law", ...]
    certifications = Column(JSON)
    audits_completed = Column(Integer)
    github_handle = Column(String(100))
    years_experience = Column(Integer)

    lead = relationship("Lead", back_populates="blockchain_detail")


class LeadGolf(Base):
    """Extra fields for Golf Industry leads"""
    __tablename__ = "lead_golf"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), unique=True)

    # Type
    golf_type = Column(String(100))  # "golfer", "association", "course", "resort", "owner"

    # Golfer fields
    handicap = Column(Float)
    world_ranking = Column(Integer)
    tour_affiliation = Column(String(255))  # "PGA", "Asian Tour", etc.
    sponsors = Column(JSON)

    # Venue / Organisation fields
    venue_name = Column(String(500))
    venue_address = Column(Text)
    holes = Column(Integer)           # 9, 18, 27, 36
    membership_type = Column(String(100))  # "private", "public", "resort"
    green_fee_usd = Column(Float)
    number_of_members = Column(Integer)

    # Association fields
    association_name = Column(String(500))
    association_country = Column(String(100))
    member_clubs = Column(Integer)

    # Verified (for SK / JP audit requirement)
    directory_verified = Column(Boolean, default=False)
    directory_source = Column(String(255))

    lead = relationship("Lead", back_populates="golf_detail")


class LeadTravel(Base):
    """Extra fields for Travel / Hospitality leads"""
    __tablename__ = "lead_travel"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), unique=True)

    # Type
    travel_type = Column(String(100))  # "agency", "influencer", "hotel", "concierge"

    # Agency / Hotel fields
    agency_name = Column(String(500))
    luxury_tier = Column(String(50))  # "ultra-luxury", "luxury", "premium"
    destinations_covered = Column(JSON)  # ["Thailand", "Bali", "Maldives", ...]
    annual_revenue_usd = Column(Float)
    number_of_staff = Column(Integer)

    # Influencer fields
    instagram_followers = Column(Integer)
    youtube_subscribers = Column(Integer)
    blog_monthly_visitors = Column(Integer)
    travel_niches = Column(JSON)  # ["luxury", "adventure", "wellness", ...]
    asean_focus = Column(Boolean, default=True)

    lead = relationship("Lead", back_populates="travel_detail")


# ─────────────────────────────────────────────
# Outreach Logs
# ─────────────────────────────────────────────

class OutreachLog(Base):
    __tablename__ = "outreach_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    channel = Column(
        Enum(
            OutreachChannel,
            name="outreachchannel",
            values_callable=enum_names,
            native_enum=True,
            create_type=False,
        ),
        nullable=False,
    )
    status = Column(
        Enum(
            OutreachStatus,
            name="outreachstatus",
            values_callable=enum_names,
            native_enum=True,
            create_type=False,
        ),
        default=OutreachStatus.PLANNED,
    )
    outreach_type = Column(
        Enum(
            OutreachType,
            name="outreachtype",
            values_callable=enum_values,
            native_enum=True,
            create_type=False,
        ),
        nullable=True,
        index=True,
    )

    subject = Column(String(500))
    message_body = Column(Text)
    ai_generated = Column(Boolean, default=False)

    sent_at = Column(DateTime(timezone=True))
    opened_at = Column(DateTime(timezone=True))
    replied_at = Column(DateTime(timezone=True))
    reply_content = Column(Text)

    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    lead = relationship("Lead", back_populates="outreach_logs")
    created_by_user = relationship("User", back_populates="outreach_logs")


# ─────────────────────────────────────────────
# Tags (flexible labelling)
# ─────────────────────────────────────────────

class Tag(Base):
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    color = Column(String(20), default="#6366f1")  # hex color for UI
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead_tags = relationship("LeadTag", back_populates="tag")


class LeadTag(Base):
    __tablename__ = "lead_tags"

    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="lead_tags")
    tag = relationship("Tag", back_populates="lead_tags")


# ─────────────────────────────────────────────
# Audit Log (data quality tracking)
# ─────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    action = Column(String(100), nullable=False)  # "created", "verified", "flagged", "updated"
    field_changed = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")

# ─────────────────────────────────────────────
# Lead Discovery Queue (Phase 1 ingestion)
# ─────────────────────────────────────────────

class LeadDiscoveryQueue(Base):
    __tablename__ = "lead_discovery_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    raw_url = Column(Text, nullable=False)
    normalized_url = Column(Text, nullable=False, unique=True, index=True)

    source = Column(String(255))
    source_query = Column(Text)
    category_hint = Column(String(50))  # constrained by DB check constraint

    status = Column(String(50), nullable=False, default="discovered")

    raw_data = Column(MutableDict.as_mutable(JSONB), nullable=True)

    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())