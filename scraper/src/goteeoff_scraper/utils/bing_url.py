from __future__ import annotations

from urllib.parse import urlparse, parse_qs, unquote

def unwrap_bing_redirect(href: str) -> str:
    """
    Bing sometimes uses redirect URLs like:
    https://www.bing.com/ck/a?...&u=a1aHR0cHM6Ly93d3cubGlua2VkaW4uY29tL2luL....
    or
    https://www.bing.com/aclick?ld=...&u=https%3a%2f%2fwww.linkedin.com%2fin%2f...
    This function tries to extract the real destination.
    If it can't, returns the input href.
    """
    if not href:
        return href

    try:
        p = urlparse(href)
        if "bing.com" not in p.netloc:
            return href

        qs = parse_qs(p.query)

        # Common direct param
        if "u" in qs and qs["u"]:
            u = qs["u"][0]
            # Sometimes it's already a URL-encoded https URL
            if u.startswith("http"):
                return unquote(u)
            # Sometimes it’s base64-ish/encoded; we can’t reliably decode all formats
            # so just return original if not clearly a URL.
            return unquote(u)

        if "url" in qs and qs["url"]:
            return unquote(qs["url"][0])

    except Exception:
        return href

    return href