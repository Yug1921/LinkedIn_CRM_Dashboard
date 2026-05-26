from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
import time
import random

import requests
from bs4 import BeautifulSoup

from goteeoff_scraper.utils.linkedin import extract_linkedin_urls


@dataclass
class DDGResult:
    rank: int
    title: str
    snippet: str
    url: str


class DuckDuckGoHtmlClient:
    """
    Uses DuckDuckGo HTML endpoint:
    https://duckduckgo.com/html/?q=...
    This is much more scraper-friendly than Bing/Google.
    """
    BASE_URL = "https://duckduckgo.com/html/"

    def __init__(self, user_agent: Optional[str] = None, timeout: int = 20):
        self.session = requests.Session()
        self.timeout = timeout
        self.session.headers.update({
            "User-Agent": user_agent or (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        })

    def search(self, query: str, count: int = 50) -> List[DDGResult]:
        r = self.session.get(self.BASE_URL, params={"q": query}, timeout=self.timeout)
        r.raise_for_status()

        print("[debug] ddg status:", r.status_code)
        print("[debug] ddg final url:", r.url)
        print("[debug] first 300 chars:", r.text[:300].replace("\n", " "))

        soup = BeautifulSoup(r.text, "lxml")
        title = soup.title.get_text(strip=True) if soup.title else "NO_TITLE"
        print("[debug] ddg page title:", title)

        # Try common DDG html layouts
        items = soup.select("div.result, div.web-result, article")

        results: List[DDGResult] = []
        rank = 0

        def _clean(s: str) -> str:
            return " ".join((s or "").split())

        for div in items:
            # Try a bunch of likely link selectors
            a = (
                div.select_one("a.result__a")
                or div.select_one("a.result__url")
                or div.select_one("h2 a")
                or div.select_one("a")
            )
            if not a or not a.get("href"):
                continue

            title_text = _clean(a.get_text(strip=True))
            url = a["href"].strip()

            # snippet attempts
            snippet_el = (
                div.select_one(".result__snippet")
                or div.select_one(".snippet")
                or div.select_one("p")
            )
            snippet = _clean(snippet_el.get_text(" ", strip=True) if snippet_el else "")

            rank += 1
            results.append(DDGResult(rank=rank, title=title_text, snippet=snippet, url=url))

            if len(results) >= count:
                break

        # Hard fallback: if still empty, scan ALL links on page for linkedin URLs
        if not results:
            all_hrefs = [a.get("href", "") for a in soup.find_all("a")]
            joined = "\n".join(all_hrefs)
            found = extract_linkedin_urls(joined)

            # Create pseudo-results so downstream still works
            for u in found[:count]:
                rank += 1
                results.append(DDGResult(rank=rank, title="(link)", snippet="", url=u))

        print(f"[debug] got {len(results)} results from DuckDuckGo (parsed)")

        time.sleep(random.uniform(0.8, 1.6))
        return results
