#!/usr/bin/env python3
"""Fetch the FSE 2026 Researchr program and export static JSON data."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from parse_researchr_html import PROGRAM_URL, build_metadata, parse_program_html, sort_program_items
from parse_ical import merge_ical_events, parse_ical_file


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape FSE 2026 program data from Researchr.")
    parser.add_argument("--url", default=PROGRAM_URL, help="Researchr program URL")
    parser.add_argument("--html", type=Path, help="Use a local HTML file instead of fetching")
    parser.add_argument(
        "--ical",
        type=Path,
        default=Path("event-calendar.ics"),
        help="Optional Researchr detailed event-calendar.ics file",
    )
    parser.add_argument(
        "--refresh-ical",
        action="store_true",
        help="Try to refresh the local iCal file from the program page before merging.",
    )
    parser.add_argument("--program-out", type=Path, default=Path("public/data/program.json"))
    parser.add_argument("--metadata-out", type=Path, default=Path("public/data/metadata.json"))
    args = parser.parse_args()

    html_text = args.html.read_text(encoding="utf-8") if args.html else fetch(args.url)
    if args.refresh_ical:
        refresh_ical_file(html_text, args.url, args.ical)

    program = sort_program_items(parse_program_html(html_text, base_url=args.url))
    if args.ical and args.ical.exists():
        program = sort_program_items(merge_ical_events(program, parse_ical_file(args.ical)))
    metadata = build_metadata(args.url)

    args.program_out.parent.mkdir(parents=True, exist_ok=True)
    args.metadata_out.parent.mkdir(parents=True, exist_ok=True)
    args.program_out.write_text(json.dumps(program, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    args.metadata_out.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Wrote {len(program)} program items to {args.program_out}")
    print(f"Wrote metadata to {args.metadata_out}")
    return 0


def fetch(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "findmynexttalk/0.1 (+https://github.com/kaziamithasan89/findmynexttalk)"
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def refresh_ical_file(html_text: str, base_url: str, output_path: Path) -> bool:
    ical_url = discover_event_calendar_url(html_text, base_url)
    if not ical_url:
        print("Could not discover event-calendar.ics link; using existing local iCal file if present.")
        return False

    output_path.write_text(fetch(ical_url), encoding="utf-8")
    print(f"Refreshed iCal data from {ical_url}")
    return True


def discover_event_calendar_url(html_text: str, base_url: str) -> str:
    for match in re.finditer(r"""href=["']([^"']*(?:event-calendar\.ics|event-calendar)[^"']*)["']""", html_text, re.I):
        return urljoin(base_url, match.group(1).replace("&amp;", "&"))

    return ""


if __name__ == "__main__":
    raise SystemExit(main())
