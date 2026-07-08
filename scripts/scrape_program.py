#!/usr/bin/env python3
"""Fetch a Researchr conference program and export static JSON data."""

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
    parser = argparse.ArgumentParser(description="Scrape Researchr program data.")
    parser.add_argument("--conference", default="fse2026", help="Local conference slug, e.g. fse2026")
    parser.add_argument("--conference-name", default="FSE 2026", help="Display name written to metadata")
    parser.add_argument("--location", default="Montreal, Canada", help="Conference location written to metadata")
    parser.add_argument("--dates", default="Sun 5 - Thu 9 July 2026", help="Date range written to metadata")
    parser.add_argument("--timezone", default="America/Toronto", help="IANA timezone written to metadata")
    parser.add_argument("--url", default=PROGRAM_URL, help="Researchr program URL")
    parser.add_argument("--html", type=Path, help="Use a local HTML file instead of fetching")
    parser.add_argument(
        "--ical",
        type=Path,
        help="Optional Researchr detailed event-calendar.ics file. Defaults to conferences/<conference>/event-calendar.ics",
    )
    parser.add_argument(
        "--refresh-ical",
        action="store_true",
        help="Try to refresh the local iCal file from the program page. This does not affect mined program data unless --merge-ical is also used.",
    )
    parser.add_argument(
        "--merge-ical",
        action="store_true",
        help="Merge optional iCal data into mined HTML program items. HTML-only mining is the default.",
    )
    parser.add_argument("--data-out", type=Path, help="Output data directory. Defaults to public/data/<conference>")
    parser.add_argument("--program-out", type=Path)
    parser.add_argument("--metadata-out", type=Path)
    args = parser.parse_args()

    data_out = args.data_out or Path("public/data") / args.conference
    ical_path = args.ical or Path("conferences") / args.conference / "event-calendar.ics"
    program_out = args.program_out or data_out / "program.json"
    metadata_out = args.metadata_out or data_out / "metadata.json"

    html_text = args.html.read_text(encoding="utf-8") if args.html else fetch(args.url)
    if args.refresh_ical:
        refresh_ical_file(html_text, args.url, ical_path)

    program = sort_program_items(parse_program_html(html_text, base_url=args.url, conference_slug=args.conference))
    if args.merge_ical and ical_path.exists():
        program = sort_program_items(merge_ical_events(program, parse_ical_file(ical_path)))
    elif args.merge_ical:
        print(f"No iCal file found at {ical_path}; writing HTML-only program data.")
    start_date, end_date = infer_date_range(program)
    metadata = build_metadata(
        source_url=args.url,
        conference_slug=args.conference,
        conference_name=args.conference_name,
        location=args.location,
        dates=args.dates,
        start_date=start_date,
        end_date=end_date,
        timezone=args.timezone,
    )

    program_out.parent.mkdir(parents=True, exist_ok=True)
    metadata_out.parent.mkdir(parents=True, exist_ok=True)
    program_out.write_text(json.dumps(program, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    metadata_out.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Wrote {len(program)} program items to {program_out}")
    print(f"Wrote metadata to {metadata_out}")
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

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(fetch(ical_url), encoding="utf-8")
    print(f"Refreshed iCal data from {ical_url}")
    return True


def discover_event_calendar_url(html_text: str, base_url: str) -> str:
    for match in re.finditer(r"""href=["']([^"']*(?:event-calendar\.ics|event-calendar)[^"']*)["']""", html_text, re.I):
        return urljoin(base_url, match.group(1).replace("&amp;", "&"))

    return ""


def infer_date_range(program: list[dict]) -> tuple[str, str]:
    dates = sorted({item.get("date", "") for item in program if item.get("date")})
    if not dates:
        return "", ""

    return dates[0], dates[-1]


if __name__ == "__main__":
    raise SystemExit(main())
