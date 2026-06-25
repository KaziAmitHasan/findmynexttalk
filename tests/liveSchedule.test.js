import assert from "node:assert/strict";
import test from "node:test";

import { buildLiveSchedule } from "../src/utils/liveSchedule.js";

const program = [
  {
    id: "opening",
    title: "Opening",
    date: "2026-07-05",
    startTime: "09:00",
    endTime: "09:30",
    room: "MB 1.210"
  },
  {
    id: "ongoing-talk",
    title: "Ongoing Talk",
    date: "2026-07-06",
    startTime: "09:33",
    endTime: "09:36",
    room: "MB 3.210"
  },
  {
    id: "next-talk",
    title: "Next Talk",
    date: "2026-07-06",
    startTime: "09:40",
    endTime: "09:50",
    room: "MB 1.210"
  },
  {
    id: "future-talk",
    title: "Future Talk",
    date: "2026-07-07",
    startTime: "10:00",
    endTime: "10:20",
    room: "MB 1.210"
  }
];

const conferenceDates = ["2026-07-05", "2026-07-06", "2026-07-07"];

test("live schedule shows first items before the conference", () => {
  const live = buildLiveSchedule(program, {
    conferenceDates,
    now: "2026-06-25T12:00:00-04:00",
    timeZone: "America/Toronto"
  });

  assert.equal(live.status, "before");
  assert.deepEqual(live.ongoing.map((item) => item.id), []);
  assert.deepEqual(live.upcoming.map((item) => item.id).slice(0, 2), ["opening", "ongoing-talk"]);
});

test("live schedule shows ongoing and upcoming items during the conference", () => {
  const live = buildLiveSchedule(program, {
    conferenceDates,
    now: "2026-07-06T09:34:00-04:00",
    timeZone: "America/Toronto"
  });

  assert.equal(live.status, "during");
  assert.deepEqual(live.ongoing.map((item) => item.id), ["ongoing-talk"]);
  assert.deepEqual(live.upcoming.map((item) => item.id), ["next-talk", "future-talk"]);
});

test("live schedule removes ended items during the conference", () => {
  const live = buildLiveSchedule(program, {
    conferenceDates,
    now: "2026-07-06T09:37:00-04:00",
    timeZone: "America/Toronto"
  });

  assert.equal(live.status, "during");
  assert.deepEqual(live.ongoing.map((item) => item.id), []);
  assert.deepEqual(live.upcoming.map((item) => item.id), ["next-talk", "future-talk"]);
});

test("live schedule reports after-conference state", () => {
  const live = buildLiveSchedule(program, {
    conferenceDates,
    now: "2026-07-08T12:00:00-04:00",
    timeZone: "America/Toronto"
  });

  assert.equal(live.status, "after");
  assert.deepEqual(live.ongoing, []);
  assert.deepEqual(live.upcoming, []);
});
