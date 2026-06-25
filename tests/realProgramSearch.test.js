import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { searchProgram } from "../src/search/localSearch.js";
import { parseQuery } from "../src/search/queryParser.js";
import { expandQueryWithSynonyms } from "../src/search/synonymMap.js";

const program = JSON.parse(fs.readFileSync("public/data/fse2026/program.json", "utf8"));
const synonyms = JSON.parse(fs.readFileSync("public/data/fse2026/synonyms.json", "utf8"));

function runSearch(query, options = {}) {
  const parsed = parseQuery(query, options);
  return searchProgram(program, expandQueryWithSynonyms(query, synonyms), parsed);
}

function authorNames(item) {
  return [
    ...(item.speakerNames || []),
    ...(item.authors || []).map((author) => author.name)
  ].join(" ");
}

function affiliations(item) {
  return (item.authors || []).map((author) => author.affiliation || "").join(" ");
}

test("real data finds all Kazi Amit Hasan presentations", () => {
  const results = runSearch("When is Kazi presenting?");

  assert.deepEqual(
    results.map((item) => `${item.date} ${item.startTime} ${item.title}`),
    [
      "2026-07-06 09:33 Towards Efficient and Secure Pull-Request-Based Software Development",
      "2026-07-06 14:45 Towards Efficient and Secure Pull-Request-Based Software Development"
    ]
  );
});

test("real data author search works without special-casing a person", () => {
  const results = runSearch("Find talks of david loo");

  assert.ok(results.length >= 2);
  assert.ok(results.every((item) => /david lo/i.test(authorNames(item))));
});

test("real data institution search matches author affiliations", () => {
  const results = runSearch("Find talks of Singapore Management University");

  assert.ok(results.length >= 10);
  assert.ok(results.every((item) => /singapore management university/i.test(affiliations(item))));
});

test("real data institution search handles apostrophes in university names", () => {
  const results = runSearch("papers from Queen's University");

  assert.ok(results.length >= 5);
  assert.ok(results.every((item) => /queen.?s university/i.test(affiliations(item))));
});

test("real data institution search handles missing apostrophes in university names", () => {
  const queries = [
    "papers from Queen's University",
    "papers from Queens University",
    "papers from Queen’s University"
  ];

  for (const query of queries) {
    const results = runSearch(query);

    assert.ok(results.length >= 5);
    assert.ok(results.every((item) => /queen.?s university/i.test(affiliations(item))));
  }
});

test("real data keynote query returns only keynote events", () => {
  const results = runSearch("keynotes");

  assert.ok(results.length >= 8);
  assert.ok(results.every((item) => item.eventType === "Keynote"));
  assert.equal(results[0].date, "2026-07-06");
  assert.equal(results[0].startTime, "11:00");
});

test("real data AIware keynote query excludes AIware talks and Q&A", () => {
  const results = runSearch("AIware keynotes");

  assert.ok(results.length >= 5);
  assert.ok(results.every((item) => item.track === "AIware Keynotes"));
  assert.ok(results.every((item) => item.eventType === "Keynote"));
});

test("real data date plus event type query returns the matching schedule item only", () => {
  const results = runSearch("lunch on Tuesday");

  assert.deepEqual(
    results.map((item) => `${item.date} ${item.eventType} ${item.title}`),
    ["2026-07-07 Lunch Lunch"]
  );
});

test("real data combined track and topic query requires both constraints", () => {
  const results = runSearch("Tool Demonstrations about testing");

  assert.ok(results.length >= 5);
  assert.ok(results.every((item) => item.track === "Tool Demonstrations"));
  assert.ok(
    results.every((item) =>
      /test|testing|fuzz|verification/i.test(`${item.title} ${item.abstract} ${item.session} ${(item.keywords || []).join(" ")}`)
    )
  );
});

test("real data calendar date and exact topic phrase query returns matching day talks", () => {
  const results = runSearch("find talks about code translation on 6th July");

  assert.deepEqual(
    new Set(results.map((item) => `${item.date} ${item.startTime} ${item.title}`)),
    new Set([
      "2026-07-06 09:15 Execution Control Matters: Deterministic and Agentic Tool Orchestration for LLM-Based Code Translation",
      "2026-07-06 14:20 Beyond Translation Accuracy: Addressing False Failures in LLM-Based Code Translation"
    ])
  );
});

test("real data room schedule query returns only that room", () => {
  const results = runSearch("what is in MB 3.210");

  assert.ok(results.length >= 10);
  assert.ok(results.every((item) => item.room === "MB 3.210"));
});

test("real data date and time-band query returns only matching slots", () => {
  const results = runSearch("what is happening Monday morning");

  assert.ok(results.length >= 10);
  assert.ok(results.every((item) => item.date === "2026-07-06"));
  assert.ok(results.every((item) => item.startTime < "12:00"));
});

test("real data exact time query returns events active at that time", () => {
  const results = runSearch("what can I attend at 2 pm on Tuesday");

  assert.ok(results.length >= 5);
  assert.ok(results.every((item) => item.date === "2026-07-07"));
  assert.ok(results.every((item) => item.startTime <= "14:00" && item.endTime > "14:00"));
});

test("real data exact start time query includes Kazi's afternoon talk", () => {
  const results = runSearch("what is happening at 14:45 Monday");

  assert.ok(
    results.some(
      (item) =>
        item.startTime === "14:45" &&
        item.title === "Towards Efficient and Secure Pull-Request-Based Software Development"
    )
  );
  assert.ok(results.every((item) => item.date === "2026-07-06"));
  assert.ok(results.every((item) => item.startTime <= "14:45" && item.endTime > "14:45"));
});

test("real data now query uses supplied conference timestamp", () => {
  const results = runSearch("what is happening now", {
    now: "2026-07-06T09:34:00-04:00"
  });

  assert.ok(results.length >= 2);
  assert.ok(results.every((item) => item.date === "2026-07-06"));
  assert.ok(results.every((item) => item.startTime <= "09:34" && item.endTime > "09:34"));
  assert.ok(
    results.some(
      (item) =>
        item.startTime === "09:33" &&
        item.title === "Towards Efficient and Secure Pull-Request-Based Software Development"
    )
  );
});

test("real data next query returns upcoming slots after supplied conference timestamp", () => {
  const results = runSearch("what is next", {
    now: "2026-07-06T09:34:00-04:00"
  });

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date === "2026-07-06"));
  assert.ok(results.every((item) => item.startTime >= "09:34"));
  assert.equal(results[0].startTime, "09:35");
});
