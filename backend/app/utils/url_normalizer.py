from __future__ import annotations

from urllib.parse import urlparse, urlunparse
import re


_ALLOWED_PREFIXES = (
    "https://www.linkedin.com/in/",
    "https://www.linkedin.com/company/",
)

_SUFFIX_CLEAN_RE = re.compile(r"/(overlay|detail)/.*$", re.IGNORECASE)


def normalize_linkedin_url(raw_url: str) -> str:
    """
    Normalize a LinkedIn profile/company URL.

    Rules:
    - Lowercase the entire URL
    - Strip all query parameters and fragments
    - Strip trailing slashes
    - Remove /overlay/... and /detail/... suffixes
    - Ensure it starts with https://www.linkedin.com/in/ or https://www.linkedin.com/company/
    - Raise ValueError if it is not a valid LinkedIn profile or company URL
    """
    if not raw_url or not isinstance(raw_url, str):
        raise ValueError("raw_url must be a non-empty string")

    url = raw_url.strip().lower()

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must start with http:// or https://")

    # normalize domain
    if parsed.netloc not in ("linkedin.com", "www.linkedin.com"):
        raise ValueError("URL must be on linkedin.com")

    parsed = parsed._replace(scheme="https", netloc="www.linkedin.com", query="", fragment="")

    path = parsed.path

    # remove overlay/detail suffixes
    path = _SUFFIX_CLEAN_RE.sub("", path)

    # remove trailing slashes
    path = path.rstrip("/")

    normalized = urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))

    if not normalized.startswith(_ALLOWED_PREFIXES):
        raise ValueError("Only LinkedIn /in/ (profile) and /company/ URLs are allowed")

    # require slug
    if normalized.startswith("https://www.linkedin.com/in/"):
        slug = normalized.removeprefix("https://www.linkedin.com/in/").strip("/")
        if not slug:
            raise ValueError("LinkedIn profile URL missing profile slug")

    if normalized.startswith("https://www.linkedin.com/company/"):
        slug = normalized.removeprefix("https://www.linkedin.com/company/").strip("/")
        if not slug:
            raise ValueError("LinkedIn company URL missing company slug")

    return normalized