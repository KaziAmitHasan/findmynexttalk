import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from scrape_program import discover_event_calendar_url


class ScrapeProgramTest(unittest.TestCase):
    def test_discovers_relative_event_calendar_url(self):
        html = '<a href="/program/fse-2026/program-fse-2026/event-calendar.ics?track=all">iCal</a>'

        self.assertEqual(
            discover_event_calendar_url(html, "https://conf.researchr.org/program/fse-2026/program-fse-2026/"),
            "https://conf.researchr.org/program/fse-2026/program-fse-2026/event-calendar.ics?track=all",
        )

    def test_decodes_html_ampersands(self):
        html = '<a href="event-calendar.ics?room=MB&amp;track=AIware">iCal</a>'

        self.assertEqual(
            discover_event_calendar_url(html, "https://conf.researchr.org/program/fse-2026/program-fse-2026/"),
            "https://conf.researchr.org/program/fse-2026/program-fse-2026/event-calendar.ics?room=MB&track=AIware",
        )


if __name__ == "__main__":
    unittest.main()
