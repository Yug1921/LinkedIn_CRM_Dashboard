from __future__ import annotations

import re
from urllib.parse import urlparse, urlunparse

LINKEDIN_URL_RE = re.compile(r"https?://(www\.)?linkedin\.com/(in|company)/[^\s\"\'<>]+", re.IGNORECASE)
_SUFFIX_CLEAN_RE = re.compile(r"/(overlay|detail)/.*$", re.IGNORECASE)

def extract_linkedin_urls(text: str) -> list[str]:
    if not text:
        return []
    return [m.group(0) for m in LINKEDIN_URL_RE.finditer(text)]

def normalize_linkedin_url(raw_url: str) -> str:
    if not raw_url or not isinstance(raw_url, str):
        raise ValueError("raw_url must be a non-empty string")

    url = raw_url.strip().lower()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must start with http:// or https://")

    if parsed.netloc not in ("linkedin.com", "www.linkedin.com"):
        raise ValueError("URL must be on linkedin.com")

    parsed = parsed._replace(scheme="https", netloc="www.linkedin.com", query="", fragment="")
    path = parsed.path

    path = _SUFFIX_CLEAN_RE.sub("", path)
    path = path.rstrip("/")

    normalized = urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))

    if not (normalized.startswith("https://www.linkedin.com/in/") or normalized.startswith("https://www.linkedin.com/company/")):
        raise ValueError("Only LinkedIn /in/ and /company/ URLs are allowed")

    # require slug
    if normalized.startswith("https://www.linkedin.com/in/"):
        slug = normalized.removeprefix("https://www.linkedin.com/in/").strip("/")
        if not slug:
            raise ValueError("LinkedIn profile URL missing slug")

    if normalized.startswith("https://www.linkedin.com/company/"):
        slug = normalized.removeprefix("https://www.linkedin.com/company/").strip("/")
        if not slug:
            raise ValueError("LinkedIn company URL missing slug")

    return normalized