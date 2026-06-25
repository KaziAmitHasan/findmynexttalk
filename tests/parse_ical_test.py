import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from parse_ical import merge_ical_events, parse_ical


ICAL_SNIPPET = """BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260706T133300Z
DTEND:20260706T133600Z
UID:cf03f69d-93a1-4c11-b776-da8fcd9bdcbd@conf.researchr.org
SUMMARY:[FSE Doctoral Symposium] Towards Efficient and Secure Pull-Request-Based Software Development - Kazi Amit Hasan
DESCRIPTION:Abstract\\nThis is the abstract.\\nSpeaker Bio\\nThis is the bio.
LOCATION:MB 3.210 - 1450 Guy St, Montreal, Quebec H3H 0A1, Montreal, Canada
END:VEVENT
END:VCALENDAR
"""


class ParseIcalTest(unittest.TestCase):
    def test_parses_ical_event_in_conference_timezone(self):
        events = parse_ical(ICAL_SNIPPET)
        event = events["cf03f69d-93a1-4c11-b776-da8fcd9bdcbd"]

        self.assertEqual(event["date"], "2026-07-06")
        self.assertEqual(event["startTime"], "09:33")
        self.assertEqual(event["endTime"], "09:36")
        self.assertEqual(event["durationMinutes"], 3)
        self.assertEqual(event["room"], "MB 3.210")
        self.assertEqual(event["abstract"], "This is the abstract.")

    def test_merges_by_source_slot_id(self):
        items = [
            {
                "sourceSlotId": "cf03f69d-93a1-4c11-b776-da8fcd9bdcbd",
                "date": "2026-07-06",
                "startTime": "09:33",
                "endTime": "",
                "durationMinutes": None,
                "room": "",
                "abstract": "",
                "searchText": "Talk",
            }
        ]

        merged = merge_ical_events(items, parse_ical(ICAL_SNIPPET))

        self.assertEqual(merged[0]["endTime"], "09:36")
        self.assertEqual(merged[0]["durationMinutes"], 3)
        self.assertEqual(merged[0]["room"], "MB 3.210")
        self.assertEqual(merged[0]["abstract"], "This is the abstract.")


if __name__ == "__main__":
    unittest.main()
