from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
import httpx


@dataclass
class GoogleResult:
    rank: int
    title: str
    snippet: str
    url: str


class GoogleCSEClient:
    BASE_URL = "https://www.googleapis.com/customsearch/v1"

    def __init__(self, api_key: str, cx: str, timeout: int = 30):
        if not api_key or not cx:
            raise ValueError("GoogleCSEClient requires api_key and cx")
        self.api_key = api_key
        self.cx = cx
        self.timeout = timeout

    def search(self, query: str, limit: int = 10, start: int = 1) -> List[GoogleResult]:
        """
        Google CSE returns max 10 results per request.
        Use start=1,11,21,... for pagination.
        """
        params = {
            "key": self.api_key,
            "cx": self.cx,
            "q": query,
            "num": min(limit, 10),
            "start": start,
        }

        with httpx.Client(timeout=self.timeout) as client:
            r = client.get(self.BASE_URL, params=params)
            if r.status_code >= 400:
                # Print the Google error payload (super important)
                raise RuntimeError(f"Google CSE error {r.status_code}: {r.text}")

            data = r.json()

        items = data.get("items", []) or []
        results: List[GoogleResult] = []
        rank = start - 1

        for it in items:
            rank += 1
            results.append(
                GoogleResult(
                    rank=rank,
                    title=it.get("title", "") or "",
                    snippet=it.get("snippet", "") or "",
                    url=it.get("link", "") or "",
                )
            )

        return results