import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from should_update_conference import should_update_conference


class ShouldUpdateConferenceTest(unittest.TestCase):
    def test_updates_before_conference_end(self):
        data_root = self.write_conference({"endDate": "2026-07-09", "timezone": "America/Toronto"})

        decision = should_update_conference("fse2026", data_root=data_root, today=date(2026, 7, 8))

        self.assertTrue(decision.should_update)

    def test_updates_on_conference_end_date(self):
        data_root = self.write_conference({"endDate": "2026-07-09", "timezone": "America/Toronto"})

        decision = should_update_conference("fse2026", data_root=data_root, today=date(2026, 7, 9))

        self.assertTrue(decision.should_update)

    def test_skips_after_conference_end_date(self):
        data_root = self.write_conference({"endDate": "2026-07-09", "timezone": "America/Toronto"})

        decision = should_update_conference("fse2026", data_root=data_root, today=date(2026, 7, 10))

        self.assertFalse(decision.should_update)

    def test_can_infer_end_date_from_program_for_legacy_metadata(self):
        data_root = self.write_conference(
            {"timezone": "America/Toronto"},
            program=[
                {"date": "2026-07-05"},
                {"date": "2026-07-09"},
                {"date": "2026-07-07"},
            ],
        )

        decision = should_update_conference("fse2026", data_root=data_root, today=date(2026, 7, 10))

        self.assertFalse(decision.should_update)
        self.assertEqual(decision.end_date, date(2026, 7, 9))

    def test_grace_days_allow_late_updates(self):
        data_root = self.write_conference({"endDate": "2026-07-09", "timezone": "America/Toronto"})

        decision = should_update_conference("fse2026", data_root=data_root, today=date(2026, 7, 10), grace_days=1)

        self.assertTrue(decision.should_update)

    def write_conference(self, metadata, program=None):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        root = Path(temp_dir.name)
        data_dir = root / "fse2026"
        data_dir.mkdir(parents=True)
        (data_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (data_dir / "program.json").write_text(json.dumps(program or []), encoding="utf-8")
        return root


if __name__ == "__main__":
    unittest.main()
