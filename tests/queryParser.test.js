import assert from "node:assert/strict";
import test from "node:test";

import { expandQueryWithSynonyms } from "../src/search/synonymMap.js";
import { parseQuery } from "../src/search/queryParser.js";

test("detects Monday morning queries", () => {
  const parsed = parseQuery("What is happening Monday morning?");

  assert.equal(parsed.date, "2026-07-06");
  assert.equal(parsed.timeBand.key, "morning");
});

test("detects calendar date queries", () => {
  assert.equal(parseQuery("find talks about code translation on 6th July").date, "2026-07-06");
  assert.equal(parseQuery("find talks about code translation on July 6").date, "2026-07-06");
  assert.equal(parseQuery("find talks about code translation on Jul 6").date, "2026-07-06");
  assert.deepEqual(parseQuery("find talks about code translation on 6th July").topicTerms, ["code", "translation"]);
});

test("detects Researchr-style room names", () => {
  const parsed = parseQuery("show talks in MB 3.210");

  assert.equal(parsed.room, "MB 3.210");
});

test("detects speaker from presenting query", () => {
  const parsed = parseQuery("when is Kazi Amit Hasan presenting?");

  assert.equal(parsed.speaker, "Kazi Amit Hasan");
});

test("detects speaker from by query", () => {
  const parsed = parseQuery("talks by Yuan Tian");

  assert.equal(parsed.speaker, "Yuan Tian");
});

test("detects speaker from talks of query", () => {
  const parsed = parseQuery("Find talks of David Loo");

  assert.equal(parsed.speaker, "David Loo");
});

test("detects institution names with straight or curly apostrophes", () => {
  assert.equal(parseQuery("papers from Queen's University").speaker, "Queen's University");
  assert.equal(parseQuery("papers from Queen’s University").speaker, "Queen’s University");
  assert.equal(parseQuery("papers from Queens University").speaker, "Queens University");
});

test("detects keynote as an event type instead of a topic", () => {
  const parsed = parseQuery("AIware keynotes");

  assert.equal(parsed.track, "aiware keynotes");
  assert.equal(parsed.eventType, "keynote");
  assert.deepEqual(parsed.topicTerms, []);
});

test("detects lunch as an event type with date filters", () => {
  const parsed = parseQuery("lunch on Tuesday");

  assert.equal(parsed.date, "2026-07-07");
  assert.equal(parsed.eventType, "lunch");
  assert.deepEqual(parsed.topicTerms, []);
});

test("detects twelve-hour exact time queries", () => {
  const parsed = parseQuery("what can I attend at 2 pm on Tuesday");

  assert.equal(parsed.date, "2026-07-07");
  assert.equal(parsed.timePoint.time, "14:00");
  assert.equal(parsed.timePoint.mode, "overlap");
  assert.deepEqual(parsed.topicTerms, []);
});

test("detects twenty-four-hour exact time queries", () => {
  const parsed = parseQuery("what is happening at 14:45 Monday");

  assert.equal(parsed.date, "2026-07-06");
  assert.equal(parsed.timePoint.time, "14:45");
  assert.deepEqual(parsed.topicTerms, []);
});

test("detects now queries in conference timezone", () => {
  const parsed = parseQuery("what is happening now", {
    now: "2026-07-06T09:34:00-04:00"
  });

  assert.equal(parsed.date, "2026-07-06");
  assert.equal(parsed.timePoint.key, "now");
  assert.equal(parsed.timePoint.time, "09:34");
});

test("detects next queries before the conference as first scheduled day", () => {
  const parsed = parseQuery("what is next", {
    now: "2026-06-25T12:00:00-04:00"
  });

  assert.equal(parsed.date, "2026-07-05");
  assert.equal(parsed.timePoint.key, "next");
  assert.equal(parsed.timePoint.time, "00:00");
});

test("keeps useful topic terms", () => {
  const parsed = parseQuery("find me talks related to GitHub pull request");

  assert.deepEqual(parsed.topicTerms, ["github", "pull", "request"]);
});

test("expands synonyms from configured terms", () => {
  const expanded = expandQueryWithSynonyms("github pr", {
    pr: ["pull request", "pull requests"]
  });

  assert.match(expanded, /github pr/);
  assert.match(expanded, /pull request/);
});
