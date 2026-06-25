import assert from "node:assert/strict";
import test from "node:test";

import { groupResultsByTime, isScheduleLikeQuery } from "../src/utils/resultGrouping.js";

test("detects schedule-like queries from structured time and room filters", () => {
  assert.equal(
    isScheduleLikeQuery({
      date: "2026-07-06",
      timeBand: { key: "morning" },
      topicTerms: []
    }),
    true
  );

  assert.equal(
    isScheduleLikeQuery({
      room: "MB 3.210",
      topicTerms: []
    }),
    true
  );
});

test("does not group topic or speaker searches as schedule-like", () => {
  assert.equal(
    isScheduleLikeQuery({
      date: "2026-07-06",
      topicTerms: ["testing"]
    }),
    false
  );

  assert.equal(
    isScheduleLikeQuery({
      speaker: "Kazi",
      topicTerms: []
    }),
    false
  );
});

test("groups results by date, start time, and end time", () => {
  const groups = groupResultsByTime([
    {
      id: "b",
      date: "2026-07-06",
      startTime: "09:00",
      endTime: "09:10",
      room: "MB 3.210",
      title: "Second room"
    },
    {
      id: "c",
      date: "2026-07-06",
      startTime: "09:10",
      endTime: "09:20",
      room: "MB 1.210",
      title: "Later"
    },
    {
      id: "a",
      date: "2026-07-06",
      startTime: "09:00",
      endTime: "09:10",
      room: "MB 1.210",
      title: "First room"
    }
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, "Mon, Jul 6, 09:00-09:10");
  assert.deepEqual(
    groups[0].items.map((item) => item.id),
    ["a", "b"]
  );
  assert.deepEqual(
    groups.map((group) => group.items.map((item) => item.id).join(",")),
    ["a,b", "c"]
  );
});
