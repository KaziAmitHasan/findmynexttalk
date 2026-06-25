import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from parse_researchr_html import parse_program_html, sort_program_items


HTML_SNIPPET = """
<table data-facet-date="Mon 6 Jul 2026" data-facet-track="FSE Doctoral Symposium" data-facet-room="MB 3.210" class="session-table">
  <tr class="session-details">
    <td></td><td></td><td colspan="2">
      <div class="session-info-in-table">Opening and Lightning talks</div>
    </td>
  </tr>
  <tr data-slot-id="slot-lightning" class="hidable">
    <td></td>
    <td class="daycolor-1 text-right">
      <div class="text-muted"><div class="start-time">09:33</div><strong>3m</strong></div>
      <div class="event-type">Talk</div>
    </td>
    <td></td>
    <td>
      <strong><a href="#" data-event-modal="same-event">Towards Efficient and Secure Pull-Request-Based Software Development</a></strong>
      <div class="prog-track">Doctoral Symposium</div>
      <div class="performers"><a href="/profile/fse-2026/kaziamithasan">Kazi Amit Hasan</a></div>
    </td>
  </tr>
</table>
<table data-facet-date="Mon 6 Jul 2026" data-facet-track="FSE Doctoral Symposium" data-facet-room="MB 3.210" class="session-table">
  <tr class="session-details">
    <td></td><td></td><td colspan="2">
      <div class="session-info-in-table">Doctoral Symposium talks</div>
    </td>
  </tr>
  <tr data-slot-id="slot-full-talk" class="hidable">
    <td></td>
    <td class="daycolor-1 text-right">
      <div class="text-muted"><div class="start-time">14:45</div><strong>15m</strong></div>
      <div class="event-type">Talk</div>
    </td>
    <td></td>
    <td>
      <strong><a href="#" data-event-modal="same-event">Towards Efficient and Secure Pull-Request-Based Software Development</a></strong>
      <div class="prog-track">Doctoral Symposium</div>
      <div class="performers"><a href="/profile/fse-2026/kaziamithasan">Kazi Amit Hasan</a></div>
    </td>
  </tr>
</table>
"""


class RepeatedSlotsTest(unittest.TestCase):
    def test_same_event_in_two_slots_is_preserved(self):
        items = sort_program_items(parse_program_html(HTML_SNIPPET))

        self.assertEqual(len(items), 2)
        self.assertEqual([item["startTime"] for item in items], ["09:33", "14:45"])
        self.assertNotEqual(items[0]["id"], items[1]["id"])


if __name__ == "__main__":
    unittest.main()
