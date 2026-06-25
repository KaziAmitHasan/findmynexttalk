import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import validate_data


class ValidateDataTest(unittest.TestCase):
    def test_accepts_valid_program_item(self):
        errors = []
        validate_data.validate_program(
            [
                {
                    "id": "fse2026-valid-item",
                    "kind": "talk",
                    "title": "Valid Talk",
                    "date": "2026-07-06",
                    "startTime": "09:30",
                    "endTime": "09:45",
                    "durationMinutes": 15,
                    "sourceUrl": "https://conf.researchr.org/program/fse-2026/program-fse-2026/",
                    "searchText": "Valid Talk speaker track session",
                    "track": "Research Papers",
                    "session": "Testing",
                    "authors": [{"name": "Test Author"}],
                    "speakerNames": ["Test Author"],
                }
            ],
            errors,
        )

        self.assertEqual(errors, [])

    def test_rejects_duplicate_ids(self):
        item = {
            "id": "duplicate",
            "kind": "talk",
            "title": "Duplicate Talk",
            "date": "2026-07-06",
            "startTime": "09:30",
            "endTime": "09:45",
            "durationMinutes": 15,
            "sourceUrl": "https://conf.researchr.org/program/fse-2026/program-fse-2026/",
            "searchText": "Duplicate Talk",
            "track": "Research Papers",
            "authors": [],
            "speakerNames": [],
        }
        errors = []

        validate_data.validate_program([item, dict(item)], errors)

        self.assertTrue(any("duplicate id" in error for error in errors))

    def test_rejects_invalid_iso_dates(self):
        errors = []

        validate_data.validate_date("bad-date", "not-a-date", errors)

        self.assertTrue(any("invalid ISO date" in error for error in errors))

    def test_rejects_invalid_time_format(self):
        errors = []

        validate_data.validate_time("bad-time", "startTime", "9:30", errors)

        self.assertTrue(any("HH:MM" in error for error in errors))

    def test_rejects_invalid_url(self):
        errors = []

        validate_data.validate_url("bad-url", "not-a-url", errors)

        self.assertTrue(any("invalid URL" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
