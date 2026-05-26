from typing import Final, List, Dict

# Must match backend constants exactly
LEAD_CATEGORY_HINTS: Final[List[str]] = [
    "crypto_influencer",
    "blockchain_project",
    "blockchain_expert",
    "golf_user_org",
    "travel_user_org",
]

DISCOVERY_SOURCE_BING: Final[str] = "bing_search"
DISCOVERY_SOURCE_DDG: Final[str] = "ddg_search"

DEFAULT_COUNTRIES: Final[Dict[str, List[str]]] = {
    # You can customize these anytime
    "crypto_influencer": [
        "India", "Thailand", "Australia", "Cambodia", "Vietnam",
        "Singapore", "Philippines", "Malaysia", "Indonesia", "Korea", "Japan",
        # extra global reach as you requested:
        "United States", "China", "United Kingdom", "Germany", "France", "Netherlands"
    ],
    "blockchain_project": [
        "Global", "United States", "Singapore", "United Kingdom", "Japan", "Korea", "Germany"
    ],
    "blockchain_expert": [
        "Global", "United States", "United Kingdom", "Singapore", "Japan", "Korea", "Germany"
    ],
    "golf_user_org": [
        "APAC", "United States", "United Kingdom", "Japan", "Korea", "Australia"
    ],
    "travel_user_org": [
        "ASEAN", "United States", "United Kingdom", "Japan", "Korea", "Australia"
    ],
}