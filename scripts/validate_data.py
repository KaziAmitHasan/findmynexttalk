#!/usr/bin/env python3
"""Validate static conference data before committing or deploying."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


TIME_RE = re.compile(r"^[0-2][0-9]:[0-5][0-9]$")


def main() -> int:
    program_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("public/data/fse2026/program.json")
    metadata_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/data/fse2026/metadata.json")

    errors: list[str] = []
    program = load_json(program_path, errors)
    metadata = load_json(metadata_path, errors)

    if isinstance(program, list):
      validate_program(program, errors)
    else:
      errors.append(f"{program_path}: expected a JSON array")

    if isinstance(metadata, dict):
      validate_metadata(metadata, errors)
    else:
      errors.append(f"{metadata_path}: expected a JSON object")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print_summary(program)
    return 0


def load_json(path: Path, errors: list[str]):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"{path}: file does not exist")
    except json.JSONDecodeError as exc:
        errors.append(f"{path}: invalid JSON at line {exc.lineno}: {exc.msg}")
    return None


def validate_program(program: list[dict], errors: list[str]) -> None:
    seen_ids: set[str] = set()
    required = ["id", "kind", "title", "date", "startTime", "endTime", "sourceUrl", "searchText"]

    for index, item in enumerate(program):
        label = item.get("id") or f"item[{index}]"

        for field in required:
            if not item.get(field):
                errors.append(f"{label}: missing required field '{field}'")

        item_id = item.get("id")
        if item_id in seen_ids:
            errors.append(f"{label}: duplicate id")
        if item_id:
            seen_ids.add(item_id)

        if not item.get("track") and not item.get("session"):
            errors.append(f"{label}: expected at least one of track or session")

        validate_date(label, item.get("date"), errors)
        validate_time(label, "startTime", item.get("startTime"), errors)
        validate_time(label, "endTime", item.get("endTime"), errors)
        validate_duration(label, item.get("durationMinutes"), errors)
        validate_url(label, item.get("sourceUrl"), errors)

        authors = item.get("authors", [])
        if not isinstance(authors, list):
            errors.append(f"{label}: authors must be a list")
        elif any(not isinstance(author, dict) or not author.get("name") for author in authors):
            errors.append(f"{label}: each author must be an object with a name")

        speakers = item.get("speakerNames", [])
        if not isinstance(speakers, list):
            errors.append(f"{label}: speakerNames must be a list")


def validate_metadata(metadata: dict, errors: list[str]) -> None:
    for field in ["conference", "location", "dates", "startDate", "endDate", "timezone", "source", "lastUpdated", "statusNote"]:
        if not metadata.get(field):
            errors.append(f"metadata: missing required field '{field}'")

    validate_date("metadata.startDate", metadata.get("startDate"), errors)
    validate_date("metadata.endDate", metadata.get("endDate"), errors)
    validate_metadata_date_range(metadata, errors)
    validate_url("metadata", metadata.get("source"), errors)


def validate_date(label: str, value: str | None, errors: list[str]) -> None:
    if not value:
        return

    try:
        from datetime import date

        date.fromisoformat(value)
    except ValueError:
        errors.append(f"{label}: invalid ISO date '{value}'")


def validate_time(label: str, field: str, value: str | None, errors: list[str], required: bool = True) -> None:
    if not value:
        if required:
            errors.append(f"{label}: missing required field '{field}'")
        return

    if not TIME_RE.match(value):
        errors.append(f"{label}: {field} must use HH:MM format")


def validate_url(label: str, value: str | None, errors: list[str]) -> None:
    if not value:
        return

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        errors.append(f"{label}: invalid URL '{value}'")


def validate_duration(label: str, value, errors: list[str]) -> None:
    if not isinstance(value, int) or value <= 0:
        errors.append(f"{label}: durationMinutes must be a positive integer")


def validate_metadata_date_range(metadata: dict, errors: list[str]) -> None:
    start_date = metadata.get("startDate")
    end_date = metadata.get("endDate")
    if not start_date or not end_date:
        return

    try:
        from datetime import date

        if date.fromisoformat(start_date) > date.fromisoformat(end_date):
            errors.append("metadata: startDate must be on or before endDate")
    except ValueError:
        return


def print_summary(program) -> None:
    if not isinstance(program, list):
        return

    by_day: dict[str, int] = {}
    by_track: dict[str, int] = {}

    for item in program:
        by_day[item.get("date", "unknown")] = by_day.get(item.get("date", "unknown"), 0) + 1
        by_track[item.get("track", "unknown")] = by_track.get(item.get("track", "unknown"), 0) + 1

    print(f"Validated {len(program)} program items.")
    print(f"Days: {by_day}")
    print(f"Tracks: {by_track}")


if __name__ == "__main__":
    raise SystemExit(main())
