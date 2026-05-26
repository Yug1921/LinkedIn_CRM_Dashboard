from __future__ import annotations

from typing import Any, Dict, List, Optional
import httpx

class IngestClient:
    def __init__(self, api_base: str = "http://127.0.0.1:8000", timeout: int = 30):
        self.api_base = api_base.rstrip("/")
        self.timeout = timeout

    def ingest_linkedin_urls(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        url = f"{self.api_base}/api/ingest/linkedin-urls"
        payload = {"urls": items}
        with httpx.Client(timeout=self.timeout) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            return r.json()