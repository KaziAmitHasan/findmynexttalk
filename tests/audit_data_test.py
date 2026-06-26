import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from audit_data import audit_program


class AuditDataTest(unittest.TestCase):
    def test_accepts_matching_program_and_ical_slots(self):
        program = [
            {
                "sourceSlotId": "slot-1",
                "date": "2026-07-06",
                "startTime": "09:00",
                "endTime": "09:15",
                "durationMinutes": 15,
                "room": "MB 3.210",
                "track": "Doctoral Symposium",
                "session": "Session",
                "speakerNames": ["Kazi Amit Hasan"],
                "authors": [{"name": "Kazi Amit Hasan", "affiliation": "Queen's University"}],
                "abstract": "Abstract",
            }
        ]
        report, errors = audit_program(program, {"slot-1": {"sourceSlotId": "slot-1"}})

        self.assertEqual(errors, [])
        self.assertEqual(report["programItems"], 1)
        self.assertEqual(report["icalEvents"], 1)

    def test_rejects_ical_slots_missing_from_program(self):
        program = [
            {
                "sourceSlotId": "slot-1",
                "date": "2026-07-06",
                "startTime": "09:00",
                "endTime": "09:15",
                "durationMinutes": 15,
                "room": "MB 3.210",
                "track": "Research Papers",
                "session": "Session",
            }
        ]
        _, errors = audit_program(program, {"slot-2": {"sourceSlotId": "slot-2"}})

        self.assertTrue(any("missing from program.json" in error for error in errors))

    def test_accepts_mined_program_slots_missing_from_ical(self):
        program = [
            {
                "sourceSlotId": "slot-1",
                "date": "2026-07-06",
                "startTime": "09:00",
                "endTime": "09:15",
                "durationMinutes": 15,
                "room": "MB 3.210",
                "track": "Research Papers",
                "session": "Session",
            },
            {
                "sourceSlotId": "html-only-slot",
                "date": "2026-07-06",
                "startTime": "09:15",
                "endTime": "09:30",
                "durationMinutes": 15,
                "room": "MB 3.210",
                "track": "SSBSE Research Papers",
                "session": "Session",
            },
        ]
        report, errors = audit_program(program, {"slot-1": {"sourceSlotId": "slot-1"}})

        self.assertEqual(errors, [])
        self.assertEqual(report["missingInIcal"], 1)


if __name__ == "__main__":
    unittest.main()
