#!/usr/bin/env python3
"""Audit mined program data against the Researchr event calendar."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from parse_ical import parse_ical_file


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit mined program data completeness.")
    parser.add_argument("--program", type=Path, default=Path("public/data/fse2026/program.json"))
    parser.add_argument("--ical", type=Path, default=Path("conferences/fse2026/event-calendar.ics"))
    args = parser.parse_args()

    program = json.loads(args.program.read_text(encoding="utf-8"))
    ical_events = parse_ical_file(args.ical)
    report, errors = audit_program(program, ical_events)

    print_report(report)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    return 0


def audit_program(program: list[dict], ical_events: dict[str, dict]) -> tuple[dict, list[str]]:
    errors: list[str] = []
    program_slot_ids = [item.get("sourceSlotId") for item in program if item.get("sourceSlotId")]
    program_slot_id_set = set(program_slot_ids)
    ical_slot_id_set = set(ical_events)

    duplicate_slot_ids = sorted(
        slot_id for slot_id in program_slot_id_set if program_slot_ids.count(slot_id) > 1
    )
    missing_in_program = sorted(ical_slot_id_set - program_slot_id_set)
    missing_in_ical = sorted(program_slot_id_set - ical_slot_id_set)

    if len(program) != len(ical_events):
        errors.append(f"program item count {len(program)} does not match iCal event count {len(ical_events)}")
    if duplicate_slot_ids:
        errors.append(f"duplicate sourceSlotId values in program: {duplicate_slot_ids[:10]}")
    if missing_in_program:
        errors.append(f"{len(missing_in_program)} iCal slot IDs are missing from program.json")
    if missing_in_ical:
        errors.append(f"{len(missing_in_ical)} program slot IDs are missing from event-calendar.ics")

    non_catering_missing_rooms = [
        item
        for item in program
        if not item.get("room") and item.get("track") != "Catering"
    ]
    if non_catering_missing_rooms:
        errors.append(f"{len(non_catering_missing_rooms)} non-catering items are missing room")

    missing_required_schedule = [
        item
        for item in program
        if not item.get("date")
        or not item.get("startTime")
        or not item.get("endTime")
        or not isinstance(item.get("durationMinutes"), int)
    ]
    if missing_required_schedule:
        errors.append(f"{len(missing_required_schedule)} items are missing date/start/end/duration")

    report = {
        "programItems": len(program),
        "icalEvents": len(ical_events),
        "uniqueProgramSlotIds": len(program_slot_id_set),
        "missingInProgram": len(missing_in_program),
        "missingInIcal": len(missing_in_ical),
        "withRooms": count_with(program, "room"),
        "withRoomsNonCateringMissing": len(non_catering_missing_rooms),
        "withSessions": count_with(program, "session"),
        "withTracks": count_with(program, "track"),
        "withSpeakers": count_with(program, "speakerNames"),
        "withAuthorAffiliations": sum(
            1 for item in program if any(author.get("affiliation") for author in item.get("authors", []))
        ),
        "withAbstracts": count_with(program, "abstract"),
        "withPreprints": count_with(program, "preprintUrl"),
        "withDois": count_with(program, "doiUrl"),
        "withPresentations": count_with(program, "presentationUrl"),
    }

    return report, errors


def count_with(program: list[dict], field: str) -> int:
    return sum(1 for item in program if item.get(field))


def print_report(report: dict) -> None:
    print("Data audit")
    for key, value in report.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    raise SystemExit(main())
