from typing import Final, List, Dict, Any


# =========================================================
# Discovery Queue Category Hints
# =========================================================

HINT_CRYPTO_INFLUENCER: Final[str] = "crypto_influencer"
HINT_BLOCKCHAIN_PROJECT: Final[str] = "blockchain_project"
HINT_BLOCKCHAIN_EXPERT: Final[str] = "blockchain_expert"
HINT_GOLF_USER_ORG: Final[str] = "golf_user_org"
HINT_TRAVEL_USER_ORG: Final[str] = "travel_user_org"


# Queue category_hint -> Lead.category mapping (DB enum)
QUEUE_HINT_TO_LEAD_CATEGORY: Final[Dict[str, str]] = {
    HINT_CRYPTO_INFLUENCER: "crypto_influencer",
    HINT_BLOCKCHAIN_PROJECT: "blockchain_project",
    HINT_BLOCKCHAIN_EXPERT: "blockchain_expert",
    HINT_GOLF_USER_ORG: "golf_industry",
    HINT_TRAVEL_USER_ORG: "travel_industry",
}


LEAD_CATEGORY_HINTS: Final[List[str]] = [
    HINT_CRYPTO_INFLUENCER,
    HINT_BLOCKCHAIN_PROJECT,
    HINT_BLOCKCHAIN_EXPERT,
    HINT_GOLF_USER_ORG,
    HINT_TRAVEL_USER_ORG,
]


# =========================================================
# Discovery Queue Statuses
# =========================================================

STATUS_DISCOVERED: Final[str] = "discovered"
STATUS_ENRICHED: Final[str] = "enriched"
STATUS_AI_SCORED: Final[str] = "ai_scored"
STATUS_READY_FOR_OUTREACH: Final[str] = "ready_for_outreach"
STATUS_DO_NOT_CONTACT: Final[str] = "do_not_contact"


DISCOVERY_STATUSES: Final[List[str]] = [
    STATUS_DISCOVERED,
    STATUS_ENRICHED,
    STATUS_AI_SCORED,
    STATUS_READY_FOR_OUTREACH,
    STATUS_DO_NOT_CONTACT,
]


# =========================================================
# Existing CRM Lead Statuses
# =========================================================

LEAD_STATUS_NEW: Final[str] = "new"
LEAD_STATUS_QUALIFIED: Final[str] = "qualified"
LEAD_STATUS_CONTACTED: Final[str] = "contacted"
LEAD_STATUS_RESPONDED: Final[str] = "responded"
LEAD_STATUS_CONVERTED: Final[str] = "converted"
LEAD_STATUS_DISQUALIFIED: Final[str] = "disqualified"


LEAD_STATUSES: Final[List[str]] = [
    LEAD_STATUS_NEW,
    LEAD_STATUS_QUALIFIED,
    LEAD_STATUS_CONTACTED,
    LEAD_STATUS_RESPONDED,
    LEAD_STATUS_CONVERTED,
    LEAD_STATUS_DISQUALIFIED,
]


# =========================================================
# Target Countries / Regions
# =========================================================

COUNTRIES_TARGETED: Final[Dict[str, Any]] = {
    HINT_CRYPTO_INFLUENCER: [
        "India",
        "Thailand",
        "Australia",
        "Cambodia",
        "Vietnam",
        "Singapore",
        "Philippines",
        "Malaysia",
        "Indonesia",
        "Korea",
        "Japan",
    ],

    HINT_GOLF_USER_ORG: [
        "APAC region",
    ],

    HINT_TRAVEL_USER_ORG: [
        "ASEAN region",
    ],
}