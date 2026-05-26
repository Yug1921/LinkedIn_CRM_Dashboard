from __future__ import annotations
from typing import Optional

def build_bing_query(category: str, country: Optional[str]) -> str:
    """
    Keep queries simple and stable. We search for public LinkedIn profile pages.
    """
    if category == "crypto_influencer":
        base = "site:linkedin.com/in/"
    elif category == "blockchain_project":
        base = "site:linkedin.com/company/"
    else:
        base = "(site:linkedin.com/in/ OR site:linkedin.com/company/)"

    # Category-specific keywords (tune anytime)
    if category == "crypto_influencer":
        keywords = '("crypto" OR "web3" OR "defi" OR "nft" OR "blockchain" OR "trader")'
    elif category == "blockchain_project":
        keywords = '("Polygon" OR "Solana" OR "L2" OR "DeFi protocol" OR "web3 project")'
    elif category == "blockchain_expert":
        keywords = '("smart contract auditor" OR "security auditor" OR "web3 lawyer" OR "solidity developer")'
    elif category == "golf_user_org":
        keywords = '("golf" OR "PGA" OR "golf association" OR "golf course" OR "golf resort")'
    elif category == "travel_user_org":
        keywords = '("luxury travel" OR "travel agency" OR "hospitality" OR "hotel" OR "concierge")'
    else:
        keywords = ""

    if country and country.lower() not in ("global",):
        return f'{base} {keywords} "{country}"'
    return f"{base} {keywords}".strip()