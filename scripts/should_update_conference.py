#!/usr/bin/env python3
"""Decide whether a scheduled conference data update should continue."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def main() -> int:
    parser = argparse.ArgumentParser(description="Skip conference updates after the configured end date.")
    parser.add_argument("--conference", default="fse2026", help="Local conference slug, e.g. fse2026")
    parser.add_argument("--data-root", type=Path, default=Path("public/data"))
    parser.add_argument("--today", help="Override today's date as YYYY-MM-DD, for tests or dry runs")
    parser.add_argument("--grace-days", type=int, default=0, help="Optional days after endDate to keep updating")
    args = parser.parse_args()

    try:
        decision = should_update_conference(
            args.conference,
            data_root=args.data_root,
            today=date.fromisoformat(args.today) if args.today else None,
            grace_days=args.grace_days,
        )
    except (FileNotFoundError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    write_github_output(
        {
            "should_update": "true" if decision.should_update else "false",
            "reason": decision.reason,
            "end_date": decision.end_date.isoformat(),
            "today": decision.today.isoformat(),
        }
    )
    print(decision.reason)
    return 0


class UpdateDecision:
    def __init__(self, should_update: bool, reason: str, today: date, end_date: date):
        self.should_update = should_update
        self.reason = reason
        self.today = today
        self.end_date = end_date


def should_update_conference(
    conference: str,
    *,
    data_root: Path = Path("public/data"),
    today: date | None = None,
    grace_days: int = 0,
) -> UpdateDecision:
    if grace_days < 0:
        raise ValueError("grace_days must be 0 or greater")

    data_dir = data_root / conference
    metadata = load_json_object(data_dir / "metadata.json")
    timezone = metadata.get("timezone") or "UTC"
    end_date = read_end_date(metadata, data_dir / "program.json")
    current_date = today or local_today(timezone)
    final_update_date = end_date + timedelta(days=grace_days)

    if current_date > final_update_date:
        return UpdateDecision(
            False,
            f"Skipping {conference}: today {current_date.isoformat()} is after conference end date {end_date.isoformat()}.",
            current_date,
            end_date,
        )

    return UpdateDecision(
        True,
        f"Updating {conference}: today {current_date.isoformat()} is on or before conference end date {end_date.isoformat()}.",
        current_date,
        end_date,
    )


def read_end_date(metadata: dict, program_path: Path) -> date:
    raw_end_date = metadata.get("endDate")
    if raw_end_date:
        return parse_iso_date(raw_end_date, "metadata.endDate")

    program = load_json_array(program_path)
    dates = sorted(item.get("date") for item in program if isinstance(item, dict) and item.get("date"))
    if not dates:
        raise ValueError(f"{program_path}: could not infer conference end date")

    return parse_iso_date(dates[-1], f"{program_path}: latest program date")


def local_today(timezone: str) -> date:
    try:
        return datetime.now(ZoneInfo(timezone)).date()
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"unknown timezone '{timezone}'") from exc


def parse_iso_date(value: str, label: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{label}: invalid ISO date '{value}'") from exc


def load_json_object(path: Path) -> dict:
    value = load_json(path)
    if not isinstance(value, dict):
        raise ValueError(f"{path}: expected a JSON object")
    return value


def load_json_array(path: Path) -> list:
    value = load_json(path)
    if not isinstance(value, list):
        raise ValueError(f"{path}: expected a JSON array")
    return value


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise FileNotFoundError(f"{path}: file does not exist")
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path}: invalid JSON at line {exc.lineno}: {exc.msg}") from exc


def write_github_output(values: dict[str, str]) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT")
    if not output_path:
        return

    with Path(output_path).open("a", encoding="utf-8") as output:
        for key, value in values.items():
            output.write(f"{key}={value}\n")


if __name__ == "__main__":
    raise SystemExit(main())
