import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from parse_researchr_html import parse_program_html


HTML_SNIPPET = """
<table>
  <tr data-slot-id="slot-1" class="hidable">
    <td class="track-color"></td>
    <td class="daycolor-1 text-right">
      <div class="text-muted">
        <div class="start-time">09:33</div>
        <strong>3m</strong>
      </div>
      <div class="event-type">Talk</div>
    </td>
    <td></td>
    <td>
      <strong>
        <a href="#" data-event-modal="event-1">
          Towards Efficient and Secure Pull-Request-Based Software Development
        </a>
      </strong>
      <div class="prog-track">Doctoral Symposium</div>
      <span>at</span>
      <a href="https://conf.researchr.org/room/fse-2026/fse-2026-venue-mb-3.210"
         class="room-link navigate">MB 3.210</a>
    </td>
  </tr>
</table>
"""


class ResearchrHtmlParserTest(unittest.TestCase):
    def test_extracts_visible_schedule_row(self):
        items = parse_program_html(HTML_SNIPPET)

        self.assertEqual(len(items), 1)
        item = items[0]
        self.assertEqual(item["title"], "Towards Efficient and Secure Pull-Request-Based Software Development")
        self.assertEqual(item["date"], "2026-07-06")
        self.assertEqual(item["startTime"], "09:33")
        self.assertEqual(item["eventType"], "Talk")
        self.assertEqual(item["track"], "Doctoral Symposium")
        self.assertEqual(item["room"], "MB 3.210")
        self.assertIn("#event-event-1", item["sourceUrl"])
        self.assertIn("pull request", item["keywords"])


if __name__ == "__main__":
    unittest.main()
