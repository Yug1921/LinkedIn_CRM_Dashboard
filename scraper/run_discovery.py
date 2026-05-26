from __future__ import annotations

import argparse
import os
from typing import List, Dict, Any

from dotenv import load_dotenv
from goteeoff_scraper.providers.google_cse import GoogleCSEClient
from goteeoff_scraper.core.query_builder import build_bing_query
from goteeoff_scraper.core.ingest_client import IngestClient
from goteeoff_scraper.utils.linkedin import extract_linkedin_urls, normalize_linkedin_url
from goteeoff_scraper.config.constants import LEAD_CATEGORY_HINTS, DEFAULT_COUNTRIES

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--category", required=True, choices=LEAD_CATEGORY_HINTS)
    p.add_argument("--country", action="append", default=None,
                   help="Provide multiple --country values. If omitted, uses defaults for category.")
    p.add_argument("--limit", type=int, default=50)
    p.add_argument("--api-base", default="http://127.0.0.1:8000")
    p.add_argument("--dry-run", action="store_true", help="Do not POST to backend, just print results.")
    return p.parse_args()


def main():
    args = parse_args()

    load_dotenv()
    api_key = os.getenv("GOOGLE_CSE_API_KEY", "")
    cx = os.getenv("GOOGLE_CSE_CX", "")
    if not api_key or not cx:
        raise SystemExit("Missing GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX in scraper/.env")

    limit = max(1, min(args.limit, 50))  # keep it gentle per run
    countries = args.country if args.country else DEFAULT_COUNTRIES.get(args.category, ["Global"])

    client = GoogleCSEClient(api_key=api_key, cx=cx)
    ingest = IngestClient(api_base=os.getenv("API_BASE", args.api_base))

    seen_normalized = set()
    batch: List[Dict[str, Any]] = []

    for country in countries:
        query = build_bing_query(args.category, country)
        print(f"\n[+] Query: {query}")

        # Google CSE: 10 results per request
        start = 1
        while len(batch) < limit:
            results = client.search(query=query, limit=min(10, limit - len(batch)), start=start)
            if not results:
                break

            for r in results:
                # Google returns direct result links (often LinkedIn)
                candidates = [r.url]
                for raw in candidates:
                    try:
                        norm = normalize_linkedin_url(raw)
                    except Exception:
                        continue

                    if norm in seen_normalized:
                        continue
                    seen_normalized.add(norm)

                    batch.append({
                        "raw_url": raw,
                        "source": "google_cse",
                        "source_query": query,
                        "category_hint": args.category,
                        "raw_data": {
                            "rank": r.rank,
                            "title": r.title,
                            "snippet": r.snippet,
                            "url": r.url,
                            "country_context": country,
                            "engine": "google_cse",
                        }
                    })

                    if len(batch) >= limit:
                        break

            start += 10

        if len(batch) >= limit:
            break

    print(f"\nCollected {len(batch)} unique LinkedIn URLs (normalized).")

    if args.dry_run:
        for item in batch[:10]:
            print(" -", item["raw_url"])
        print("\nDry run enabled; not posting to backend.")
        return

    if not batch:
        print("No URLs to ingest.")
        return

    resp = ingest.ingest_linkedin_urls(batch)
    print("\nIngest response:")
    print(resp)


if __name__ == "__main__":
    main()