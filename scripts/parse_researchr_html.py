#!/usr/bin/env python3
"""Parse visible schedule rows from a Researchr program page."""

from __future__ import annotations

import hashlib
import html
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from html.parser import HTMLParser
from typing import Iterable
from urllib.parse import urljoin


PROGRAM_URL = "https://conf.researchr.org/program/fse-2026/program-fse-2026/"
CONFERENCE_DATES_BY_DAY_INDEX = {
    "daycolor-0": "2026-07-05",
    "daycolor-1": "2026-07-06",
    "daycolor-2": "2026-07-07",
    "daycolor-3": "2026-07-08",
    "daycolor-4": "2026-07-09",
}


@dataclass
class FieldCapture:
    tag: str
    name: str


@dataclass
class ScheduleRow:
    slot_id: str
    event_id: str = ""
    title_parts: list[str] = field(default_factory=list)
    start_time_parts: list[str] = field(default_factory=list)
    event_type_parts: list[str] = field(default_factory=list)
    track_parts: list[str] = field(default_factory=list)
    room_parts: list[str] = field(default_factory=list)
    session_parts: list[str] = field(default_factory=list)
    performer_parts: list[str] = field(default_factory=list)
    affiliation_parts: list[str] = field(default_factory=list)
    duration_parts: list[str] = field(default_factory=list)
    publication_links: list[dict[str, str]] = field(default_factory=list)
    source_url: str = PROGRAM_URL
    date: str = ""
    session_end_time: str = ""
    duration_minutes: int | None = None

    def text_for(self, field_name: str) -> str:
        value = {
            "title": self.title_parts,
            "start_time": self.start_time_parts,
            "event_type": self.event_type_parts,
            "track": self.track_parts,
            "room": self.room_parts,
            "session": self.session_parts,
            "performer": self.performer_parts,
            "affiliation": self.affiliation_parts,
            "duration": self.duration_parts,
        }[field_name]
        return normalize_whitespace(" ".join(value))


class ResearchrProgramParser(HTMLParser):
    def __init__(self, base_url: str = PROGRAM_URL):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.rows: list[ScheduleRow] = []
        self.current: ScheduleRow | None = None
        self.table_stack: list[dict[str, str]] = []
        self.capture_stack: list[FieldCapture] = []
        self.in_performers = 0
        self.in_session_details = False
        self.capture_session_title = False
        self.capture_session_slot = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key: value or "" for key, value in attrs}
        classes = set(attr.get("class", "").split())

        if tag == "table" and "session-table" in classes:
            self.table_stack.append(
                {
                    "date": parse_researchr_date(attr.get("data-facet-date", "")),
                    "room": clean_room(attr.get("data-facet-room", "")),
                    "track": clean_track(attr.get("data-facet-track", "")),
                    "session": "",
                    "session_start": "",
                    "session_end": "",
                }
            )

        if tag == "tr" and "session-details" in classes:
            self.in_session_details = True

        if self.in_session_details and "session-info-in-table" in classes:
            self.capture_session_title = True

        if self.in_session_details and "slot-label" in classes:
            self.capture_session_slot = True

        if tag == "tr" and attr.get("data-slot-id"):
            self.current = ScheduleRow(slot_id=attr["data-slot-id"])
            context = self.table_stack[-1] if self.table_stack else {}
            if context.get("date"):
                self.current.date = context["date"]
            if context.get("room"):
                self.current.room_parts.append(context["room"])
            if context.get("track"):
                self.current.track_parts.append(context["track"])
            if context.get("session"):
                self.current.session_parts.append(context["session"])
            if context.get("session_end"):
                self.current.session_end_time = context["session_end"]

        if self.current is None:
            return

        if "performers" in classes:
            self.in_performers += 1

        for class_name in classes:
            if class_name in CONFERENCE_DATES_BY_DAY_INDEX:
                self.current.date = CONFERENCE_DATES_BY_DAY_INDEX[class_name]

        if tag == "a" and attr.get("data-event-modal") and not self.current.event_id:
            self.current.event_id = attr["data-event-modal"]
            self.current.source_url = f"{self.base_url}#event-{self.current.event_id}"
            self.capture_stack.append(FieldCapture(tag=tag, name="title"))
            return

        if "start-time" in classes:
            self.capture_stack.append(FieldCapture(tag=tag, name="start_time"))
            return

        if "event-type" in classes:
            self.capture_stack.append(FieldCapture(tag=tag, name="event_type"))
            return

        if "prog-track" in classes:
            self.capture_stack.append(FieldCapture(tag=tag, name="track"))
            return

        if "room-link" in classes:
            href = attr.get("href")
            if href:
                self.current.source_url = self.current.source_url or urljoin(self.base_url, href)
            self.capture_stack.append(FieldCapture(tag=tag, name="room"))
            return

        if self.in_performers and tag == "a":
            self.capture_stack.append(FieldCapture(tag=tag, name="performer"))
            return

        if self.in_performers and "prog-aff" in classes:
            self.capture_stack.append(FieldCapture(tag=tag, name="affiliation"))
            return

        if "publication-link" in classes and tag == "a":
            href = attr.get("href")
            if href:
                self.current.publication_links.append({"url": urljoin(self.base_url, href), "label": ""})
            self.capture_stack.append(FieldCapture(tag=tag, name="publication"))
            return

        if tag == "strong":
            self.capture_stack.append(FieldCapture(tag=tag, name="duration"))
            return

    def handle_endtag(self, tag: str) -> None:
        if self.capture_stack and self.capture_stack[-1].tag == tag:
            self.capture_stack.pop()

        if tag == "div" and self.in_performers:
            self.in_performers -= 1

        if tag == "tr" and self.in_session_details:
            self.in_session_details = False
            self.capture_session_title = False
            self.capture_session_slot = False

        if tag == "tr" and self.current is not None:
            if self.current.text_for("title"):
                self.rows.append(self.current)
            self.current = None
            self.capture_stack.clear()

        if tag == "table" and self.table_stack:
            self.table_stack.pop()

    def handle_data(self, data: str) -> None:
        if self.capture_session_slot and self.table_stack:
            value = normalize_whitespace(data)
            start_time, end_time = parse_slot_label(value)
            if start_time and end_time:
                self.table_stack[-1]["session_start"] = start_time
                self.table_stack[-1]["session_end"] = end_time
                self.capture_session_slot = False
            return

        if self.capture_session_title and self.table_stack:
            value = normalize_whitespace(data)
            if value and not self.table_stack[-1].get("session"):
                self.table_stack[-1]["session"] = value
                self.capture_session_title = False
            return

        if self.current is None or not self.capture_stack:
            return

        value = normalize_whitespace(data)
        if not value:
            return

        field_name = self.capture_stack[-1].name
        if field_name == "title":
            self.current.title_parts.append(value)
        elif field_name == "start_time":
            self.current.start_time_parts.append(value)
        elif field_name == "event_type":
            self.current.event_type_parts.append(value)
        elif field_name == "track":
            self.current.track_parts.append(value)
        elif field_name == "room":
            self.current.room_parts.append(value)
        elif field_name == "performer":
            self.current.performer_parts.append(value)
        elif field_name == "affiliation":
            self.current.affiliation_parts.append(value)
        elif field_name == "duration":
            if re.fullmatch(r"[0-9]+\s*m", value.lower()):
                self.current.duration_parts.append(value)
                self.current.duration_minutes = parse_duration_minutes(value)
        elif field_name == "publication":
            if self.current.publication_links:
                previous = self.current.publication_links[-1].get("label", "")
                self.current.publication_links[-1]["label"] = normalize_whitespace(f"{previous} {value}")


def parse_program_html(html_text: str, base_url: str = PROGRAM_URL) -> list[dict]:
    parser = ResearchrProgramParser(base_url=base_url)
    parser.feed(html_text)
    return [row_to_program_item(row, base_url) for row in parser.rows]


def row_to_program_item(row: ScheduleRow, base_url: str = PROGRAM_URL) -> dict:
    title = row.text_for("title")
    track = row.text_for("track")
    room = row.text_for("room")
    session = row.text_for("session")
    speaker_names = unique_strings(row.performer_parts)
    authors = build_authors(row.performer_parts, row.affiliation_parts)
    event_type = row.text_for("event_type") or "Event"
    start_time = normalize_time(row.text_for("start_time"))
    duration_minutes = row.duration_minutes
    end_time = add_minutes(start_time, duration_minutes)
    if not end_time and row.session_end_time:
        end_time = row.session_end_time
        duration_minutes = diff_minutes(start_time, end_time)
    source_url = row.source_url or base_url
    item_id = stable_id(row.date, title, row.slot_id or row.event_id)
    keywords = infer_keywords(title, track, event_type)
    urls = classify_publication_links(row.publication_links)
    search_text = normalize_whitespace(
        " ".join(
            [
                title,
                track,
                event_type,
                room,
                session,
                " ".join(speaker_names),
                " ".join(author.get("affiliation", "") for author in authors),
                " ".join(keywords),
            ]
        )
    )

    return {
        "id": item_id,
        "sourceSlotId": row.slot_id,
        "researchrEventId": row.event_id,
        "kind": infer_kind(event_type),
        "title": title,
        "abstract": "",
        "authors": authors,
        "speakerNames": speaker_names,
        "track": track,
        "session": session,
        "eventType": event_type,
        "date": row.date,
        "startTime": start_time,
        "endTime": end_time,
        "durationMinutes": duration_minutes,
        "room": room,
        "sourceUrl": source_url,
        "presentationUrl": urls["presentationUrl"],
        "doiUrl": urls["doiUrl"],
        "preprintUrl": urls["preprintUrl"],
        "keywords": keywords,
        "searchText": search_text,
    }


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def normalize_time(value: str) -> str:
    match = re.search(r"\b([0-2]?[0-9]):([0-5][0-9])\b", value or "")
    if not match:
        return ""
    return f"{int(match.group(1)):02d}:{match.group(2)}"


def parse_slot_label(value: str) -> tuple[str, str]:
    match = re.search(r"\b([0-2]?[0-9]:[0-5][0-9])\s*[-–—]\s*([0-2]?[0-9]:[0-5][0-9])\b", value or "")
    if not match:
        return "", ""
    return normalize_time(match.group(1)), normalize_time(match.group(2))


def parse_duration_minutes(value: str) -> int | None:
    match = re.search(r"\b([0-9]+)\s*m\b", value or "", re.IGNORECASE)
    return int(match.group(1)) if match else None


def add_minutes(start_time: str, minutes: int | None) -> str:
    if not start_time or minutes is None:
        return ""

    parsed = datetime.strptime(start_time, "%H:%M")
    return (parsed + timedelta(minutes=minutes)).strftime("%H:%M")


def diff_minutes(start_time: str, end_time: str) -> int | None:
    if not start_time or not end_time:
        return None

    start = datetime.strptime(start_time, "%H:%M")
    end = datetime.strptime(end_time, "%H:%M")
    if end < start:
        end += timedelta(days=1)
    return int((end - start).total_seconds() // 60)


def parse_researchr_date(value: str) -> str:
    match = re.search(r"\b(Sun|Mon|Tue|Wed|Thu)\s+([0-9]{1,2})\s+Jul\s+2026\b", value or "")
    if not match:
        return ""

    day = int(match.group(2))
    return f"2026-07-{day:02d}"


def clean_room(value: str) -> str:
    value = normalize_whitespace(value)
    if not value or "not assigned" in value.lower():
        return ""
    return value


def clean_track(value: str) -> str:
    value = normalize_whitespace(value)
    return re.sub(r"^FSE\s+", "", value)


def stable_id(date_value: str, title: str, fallback: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:64]
    digest = hashlib.sha1(f"{date_value}|{title}|{fallback}".encode("utf-8")).hexdigest()[:8]
    return f"fse2026-{date_value or 'undated'}-{slug or 'event'}-{digest}"


def unique_strings(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = normalize_whitespace(value)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result


def build_authors(names: list[str], affiliations: list[str]) -> list[dict[str, str]]:
    authors: list[dict[str, str]] = []
    seen: set[str] = set()

    for index, name in enumerate(names):
        cleaned_name = normalize_whitespace(name)
        if not cleaned_name or cleaned_name in seen:
            continue
        seen.add(cleaned_name)
        affiliation = normalize_whitespace(affiliations[index]) if index < len(affiliations) else ""
        authors.append({"name": cleaned_name, "affiliation": affiliation})

    return authors


def classify_publication_links(links: list[dict[str, str]]) -> dict[str, str | None]:
    result: dict[str, str | None] = {
        "presentationUrl": None,
        "doiUrl": None,
        "preprintUrl": None,
    }

    for link in links:
        url = link.get("url", "")
        label = normalize_whitespace(link.get("label", "")).lower()
        lowered_url = url.lower()

        if not result["doiUrl"] and ("doi.org" in lowered_url or "doi" in label):
            result["doiUrl"] = url
        elif not result["preprintUrl"] and ("pre-print" in label or "preprint" in label or "arxiv.org" in lowered_url):
            result["preprintUrl"] = url
        elif not result["presentationUrl"] and any(token in label for token in ["slides", "presentation", "video"]):
            result["presentationUrl"] = url

    return result


def infer_kind(event_type: str) -> str:
    normalized = event_type.lower()
    if "talk" in normalized or "presentation" in normalized:
        return "talk"
    if "break" in normalized:
        return "break"
    if "keynote" in normalized:
        return "keynote"
    return "event"


def infer_keywords(*values: str) -> list[str]:
    text = re.sub(r"[-–—]+", " ", " ".join(values).lower())
    keywords: list[str] = []
    keyword_map = {
        "pull request": ["pull request", "GitHub"],
        "github": ["GitHub"],
        "llm": ["LLM", "large language model"],
        "large language model": ["LLM", "large language model"],
        "test": ["testing"],
        "security": ["security"],
        "secure": ["security"],
        "agent": ["agents"],
        "code": ["code"],
    }

    for needle, additions in keyword_map.items():
        if needle in text:
            for addition in additions:
                if addition not in keywords:
                    keywords.append(addition)

    return keywords


def build_metadata(source_url: str = PROGRAM_URL) -> dict:
    return {
        "conference": "FSE 2026",
        "location": "Montreal, Canada",
        "dates": "Sun 5 - Thu 9 July 2026",
        "timezone": "America/Toronto",
        "source": source_url,
        "lastUpdated": datetime.now().astimezone().isoformat(timespec="seconds"),
        "statusNote": "The official Researchr program is tentative and subject to change.",
    }


def sort_program_items(items: Iterable[dict]) -> list[dict]:
    deduped: dict[str, dict] = {}
    for item in items:
        item_id = item.get("id")
        if item_id and item_id not in deduped:
            deduped[item_id] = item

    return sorted(
        deduped.values(),
        key=lambda item: (item.get("date") or "", item.get("startTime") or "", item.get("title") or ""),
    )
