from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
import time
import random

import requests
from bs4 import BeautifulSoup

@dataclass
class BingResult:
    rank: int
    title: str
    snippet: str
    url: str
    display_url: Optional[str] = None
    
class BingSearchClient:
    """
    Lightweight Bing HTML fetcher.
    Note: Bing may rate-limit. We keep requests low (limit=50) + random delays.
    """
    BASE_URL = "https://www.bing.com/search"

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

    def search(self, query: str, count: int = 50, offset: int = 0) -> List[BingResult]:
        params = {"q": query, "count": min(count, 50), "first": offset + 1}
        r = self.session.get(self.BASE_URL, params=params, timeout=self.timeout)
        print("[debug] bing status:", r.status_code)
        print("[debug] bing final url:", r.url)
        print("[debug] first 300 chars:", r.text[:300].replace("\n", " "))
        r.raise_for_status()


        soup = BeautifulSoup(r.text, "lxml")
        title = soup.title.get_text(strip=True) if soup.title else "NO_TITLE"
        print("[debug] page title:", title)
        items = soup.select("li.b_algo")

        results: List[BingResult] = []
        rank = offset

        for li in items:
            a = li.select_one("h2 a")
            if not a or not a.get("href"):
                continue

            title = a.get_text(strip=True)
            url = a["href"].strip()
            display_url = a.get_text(strip=True)

            snippet_el = li.select_one("div.b_caption p") or li.select_one("p")
            snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""

            rank += 1
            results.append(BingResult(rank=rank, title=title, snippet=snippet, url=url, display_url=display_url))

            if len(results) >= count:
                break

        # polite delay
        time.sleep(random.uniform(1.0, 2.2))
        return results