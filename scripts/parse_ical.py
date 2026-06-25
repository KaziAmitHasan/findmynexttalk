#!/usr/bin/env python3
"""Parse Researchr iCalendar event files without external dependencies."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


LOCAL_TIMEZONE = ZoneInfo("America/Toronto")
UTC = ZoneInfo("UTC")


def parse_ical_file(path: str | Path) -> dict[str, dict]:
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    return parse_ical(text)


def parse_ical(text: str) -> dict[str, dict]:
    events: dict[str, dict] = {}

    for block in split_event_blocks(unfold_lines(text)):
        event = parse_event_block(block)
        if event.get("sourceSlotId"):
            events[event["sourceSlotId"]] = event

    return events


def unfold_lines(text: str) -> list[str]:
    unfolded: list[str] = []
    for raw_line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raw_line.startswith((" ", "\t")) and unfolded:
            unfolded[-1] += raw_line[1:]
        else:
            unfolded.append(raw_line)
    return unfolded


def split_event_blocks(lines: list[str]) -> list[list[str]]:
    blocks: list[list[str]] = []
    current: list[str] | None = None

    for line in lines:
        if line == "BEGIN:VEVENT":
            current = []
        elif line == "END:VEVENT" and current is not None:
            blocks.append(current)
            current = None
        elif current is not None:
            current.append(line)

    return blocks


def parse_event_block(lines: list[str]) -> dict:
    values: dict[str, str] = {}
    for line in lines:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.split(";", 1)[0]
        values[key] = unescape_ical(value)

    source_slot_id = values.get("UID", "").split("@", 1)[0]
    start = parse_ical_datetime(values.get("DTSTART", ""))
    end = parse_ical_datetime(values.get("DTEND", ""))
    location = values.get("LOCATION", "")
    description = values.get("DESCRIPTION", "")
    start_local = start.astimezone(LOCAL_TIMEZONE) if start else None
    end_local = end.astimezone(LOCAL_TIMEZONE) if end else None

    return {
        "sourceSlotId": source_slot_id,
        "uid": values.get("UID", ""),
        "summary": values.get("SUMMARY", ""),
        "description": description,
        "abstract": extract_abstract(description),
        "date": start_local.strftime("%Y-%m-%d") if start_local else "",
        "startTime": start_local.strftime("%H:%M") if start_local else "",
        "endTime": end_local.strftime("%H:%M") if end_local else "",
        "durationMinutes": diff_minutes(start_local, end_local),
        "room": extract_room(location),
        "location": location,
        "lastModified": parse_ical_datetime(values.get("LAST-MODIFIED", "")).isoformat()
        if values.get("LAST-MODIFIED")
        else "",
    }


def parse_ical_datetime(value: str) -> datetime | None:
    if not value:
        return None

    cleaned = value.rstrip("Z")
    parsed = datetime.strptime(cleaned, "%Y%m%dT%H%M%S")
    return parsed.replace(tzinfo=UTC if value.endswith("Z") else LOCAL_TIMEZONE)


def unescape_ical(value: str) -> str:
    return (
        value.replace("\\n", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
        .strip()
    )


def extract_room(location: str) -> str:
    if not location:
        return ""
    return location.split(" - ", 1)[0].strip()


def extract_abstract(description: str) -> str:
    cleaned = description.strip()
    if not cleaned:
        return ""

    cleaned = re.sub(r"^Abstract\s*", "", cleaned, flags=re.IGNORECASE).strip()
    return re.split(r"\n\s*Speaker Bio\s*\n", cleaned, maxsplit=1, flags=re.IGNORECASE)[0].strip()


def diff_minutes(start: datetime | None, end: datetime | None) -> int | None:
    if not start or not end:
        return None
    return int((end - start).total_seconds() // 60)


def merge_ical_events(program_items: list[dict], ical_events: dict[str, dict]) -> list[dict]:
    merged: list[dict] = []

    for item in program_items:
        event = ical_events.get(item.get("sourceSlotId", ""))
        if not event:
            merged.append(item)
            continue

        updated = dict(item)
        for field in ["date", "startTime", "endTime", "durationMinutes"]:
            if event.get(field):
                updated[field] = event[field]

        if event.get("room"):
            updated["room"] = event["room"]

        if event.get("abstract") and not updated.get("abstract"):
            updated["abstract"] = event["abstract"]

        if event.get("location"):
            updated["location"] = event["location"]

        updated["searchText"] = " ".join(
            part
            for part in [
                updated.get("searchText", ""),
                updated.get("abstract", ""),
                updated.get("location", ""),
            ]
            if part
        ).strip()
        merged.append(updated)

    return merged
