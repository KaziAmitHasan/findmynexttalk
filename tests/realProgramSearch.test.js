import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { searchProgram } from "../src/search/localSearch.js";
import { normalizeText, parseQuery } from "../src/search/queryParser.js";
import { expandQueryWithSynonyms } from "../src/search/synonymMap.js";

const program = JSON.parse(fs.readFileSync("public/data/fse2026/program.json", "utf8"));
const synonyms = JSON.parse(fs.readFileSync("public/data/fse2026/synonyms.json", "utf8"));
const conferenceDates = [...new Set(program.map((item) => item.date).filter(Boolean))].sort();

function runSearch(query, options = {}, searchOptions = {}) {
  const parsed = parseQuery(query, options);
  return searchProgram(program, expandQueryWithSynonyms(query, synonyms), parsed, searchOptions);
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

function searchCorpus(item) {
  return normalizeText(
    [
      item.title,
      item.abstract,
      item.session,
      item.track,
      item.searchText,
      ...(item.keywords || [])
    ].join(" ")
  );
}

function itemHasAuthorName(item, name) {
  const expected = normalizeText(name);
  return [
    ...(item.speakerNames || []),
    ...(item.authors || []).map((author) => author.name)
  ].some((candidate) => normalizeText(candidate) === expected);
}

function itemHasAffiliation(item, affiliation) {
  const expected = normalizeText(affiliation);
  return (item.authors || []).some((author) => normalizeText(author.affiliation).includes(expected));
}

function findAuthorFixture(preferredPattern = null) {
  const byAuthor = new Map();

  for (const item of program) {
    for (const author of item.authors || []) {
      if (!author.name) continue;
      const key = normalizeText(author.name);
      const existing = byAuthor.get(key) || { name: author.name, items: [] };
      existing.items.push(item);
      byAuthor.set(key, existing);
    }
  }

  const fixtures = [...byAuthor.values()].filter((fixture) => fixture.items.length >= 2);
  return (
    fixtures.find((fixture) => preferredPattern?.test(fixture.name)) ||
    fixtures.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name))[0]
  );
}

function findAffiliationFixture({ preferredPattern = null, minItems = 1, date = "" } = {}) {
  const byAffiliation = new Map();

  for (const item of program) {
    if (date && item.date !== date) continue;

    for (const author of item.authors || []) {
      if (!author.affiliation) continue;
      const key = normalizeText(author.affiliation);
      const existing = byAffiliation.get(key) || { affiliation: author.affiliation, items: [] };
      if (!existing.items.some((existingItem) => existingItem.id === item.id)) {
        existing.items.push(item);
      }
      byAffiliation.set(key, existing);
    }
  }

  const fixtures = [...byAffiliation.values()].filter((fixture) => fixture.items.length >= minItems);
  return (
    fixtures.find((fixture) => preferredPattern?.test(fixture.affiliation)) ||
    fixtures.sort((a, b) => b.items.length - a.items.length || a.affiliation.localeCompare(b.affiliation))[0]
  );
}

function assertContainsItems(results, expectedItems) {
  for (const expected of expectedItems) {
    assert.ok(results.some((item) => item.id === expected.id), `Missing expected result ${expected.id}`);
  }
}

function dateQueryLabel(date) {
  const parsed = new Date(`${date}T00:00:00Z`);
  const day = parsed.getUTCDate();
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
  const month = parsed.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return `${day}${suffix} ${month}`;
}

function weekdayName(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC"
  });
}

function timeBandFor(time) {
  return time < "12:00" ? "morning" : "afternoon";
}

function minuteBefore(time) {
  const [hour, minute] = time.split(":").map(Number);
  const total = Math.max(0, hour * 60 + minute - 1);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function firstTimedItem(predicate = () => true) {
  return [...program]
    .filter((item) => item.date && item.startTime && item.endTime && predicate(item))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0];
}

test("real data author search returns all presentations for a multi-item author", () => {
  const fixture = findAuthorFixture(/kazi amit hasan/i);
  assert.ok(fixture, "Expected real data to include at least one multi-item author");

  const results = runSearch(`Find talks of ${fixture.name}`);

  assert.ok(results.length >= fixture.items.length);
  assert.ok(results.every((item) => itemHasAuthorName(item, fixture.name)));
  assertContainsItems(results, fixture.items);
});

test("real data author search works without special-casing a person", () => {
  const fixture = findAuthorFixture(/david lo/i);
  assert.ok(fixture, "Expected real data to include at least one multi-item author");
  const nameParts = fixture.name.split(/\s+/);
  const typoName = [...nameParts.slice(0, -1), `${nameParts.at(-1)}x`].join(" ");

  const results = runSearch(`Find talks of ${typoName}`);

  assert.ok(results.length >= fixture.items.length);
  assert.ok(results.every((item) => itemHasAuthorName(item, fixture.name)));
});

test("real data institution search matches author affiliations", () => {
  const fixture = findAffiliationFixture({
    preferredPattern: /singapore management university/i,
    minItems: 5
  });
  assert.ok(fixture, "Expected real data to include at least one repeated affiliation");

  const results = runSearch(`Find talks of ${fixture.affiliation}`);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => itemHasAffiliation(item, fixture.affiliation)));
  assert.ok(results.some((item) => fixture.items.some((expected) => expected.id === item.id)));
});

test("real data institution search works with date clauses", () => {
  const fixture = findAffiliationFixture({
    preferredPattern: /singapore management university/i,
    minItems: 1,
    date: conferenceDates[1] || conferenceDates[0]
  });
  assert.ok(fixture, "Expected real data to include at least one dated affiliation");
  const date = fixture.items[0].date;

  const results = runSearch(`Find talks of ${fixture.affiliation} on ${dateQueryLabel(date)}`);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date === date));
  assert.ok(results.every((item) => itemHasAffiliation(item, fixture.affiliation)));
});

test("real data institution search handles apostrophes in university names", (t) => {
  const fixture = findAffiliationFixture({ preferredPattern: /['’]/, minItems: 1 });
  if (!fixture) {
    t.skip("No apostrophe-bearing affiliation is present in the refreshed program data");
    return;
  }

  const results = runSearch(`papers from ${fixture.affiliation}`);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => itemHasAffiliation(item, fixture.affiliation)));
  assert.ok(results.some((item) => fixture.items.some((expected) => expected.id === item.id)));
});

test("real data institution search handles missing apostrophes in university names", (t) => {
  const fixture = findAffiliationFixture({ preferredPattern: /['’]/, minItems: 1 });
  if (!fixture) {
    t.skip("No apostrophe-bearing affiliation is present in the refreshed program data");
    return;
  }
  const noApostropheAffiliation = fixture.affiliation.replace(/['’]/g, "");
  const queries = [
    `papers from ${fixture.affiliation}`,
    `papers from ${noApostropheAffiliation}`,
    `papers from ${fixture.affiliation.replace(/'/g, "’")}`
  ];

  for (const query of queries) {
    const results = runSearch(query);

    assert.ok(results.length >= 1);
    assert.ok(results.every((item) => itemHasAffiliation(item, fixture.affiliation)));
    assert.ok(results.some((item) => fixture.items.some((expected) => expected.id === item.id)));
  }
});

test("real data keynote query returns only keynote events", () => {
  const expected = program.filter((item) => item.eventType === "Keynote");
  assert.ok(expected.length >= 1, "Expected real data to include keynote events");

  const results = runSearch("keynotes");

  assert.equal(results.length, expected.length);
  assert.ok(results.every((item) => item.eventType === "Keynote"));
  assertContainsItems(results, expected);
});

test("real data AIware keynote query excludes AIware talks and Q&A", (t) => {
  const expected = program.filter((item) => item.track === "AIware Keynotes" && item.eventType === "Keynote");
  if (!expected.length) {
    t.skip("No AIware keynote events are present in the refreshed program data");
    return;
  }

  const results = runSearch("AIware keynotes");

  assert.equal(results.length, expected.length);
  assert.ok(results.every((item) => item.track === "AIware Keynotes"));
  assert.ok(results.every((item) => item.eventType === "Keynote"));
  assertContainsItems(results, expected);
});

test("real data date plus event type query returns matching schedule items", (t) => {
  const lunch = program.find((item) => item.eventType === "Lunch" && item.date);
  if (!lunch) {
    t.skip("No lunch events are present in the refreshed program data");
    return;
  }
  const expected = program.filter((item) => item.eventType === "Lunch" && item.date === lunch.date);

  const results = runSearch(`lunch on ${weekdayName(lunch.date)}`);

  assert.equal(results.length, expected.length);
  assert.ok(results.every((item) => item.date === lunch.date));
  assert.ok(results.every((item) => item.eventType === "Lunch"));
  assertContainsItems(results, expected);
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

test("real data GitHub pull request query keeps broad relevant results", (t) => {
  const expected = program.filter((item) => /pull request|pull-request|github/i.test(searchCorpus(item)));
  if (!expected.length) {
    t.skip("No pull-request or GitHub items are present in the refreshed program data");
    return;
  }

  const results = runSearch("Find talks about GitHub pull requests");

  assert.ok(results.length >= Math.min(3, expected.length));
  assert.ok(results.some((item) => /pull request|pull-request|github/i.test(searchCorpus(item))));
});

test("real data live conference search hides past generic results", (t) => {
  const expected = program.filter((item) => /pull request|pull-request|github/i.test(searchCorpus(item)));
  if (!expected.length) {
    t.skip("No pull-request or GitHub items are present in the refreshed program data");
    return;
  }

  const results = runSearch(
    "Find talks about GitHub pull requests",
    {},
    {
      hidePastEvents: true,
      now: "2026-07-07T10:00:00-04:00",
      timeZone: "America/Toronto"
    }
  );

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date > "2026-07-07" || item.endTime >= "10:00"));
  assert.ok(!results.some((item) => item.date < "2026-07-07"));
});

test("real data live conference search hides explicit past dates by default", (t) => {
  const expectedPast = program.filter(
    (item) => item.date === "2026-07-06" && /pull request|pull-request|github/i.test(searchCorpus(item))
  );
  if (!expectedPast.length) {
    t.skip("No Monday pull-request or GitHub items are present in the refreshed program data");
    return;
  }

  const results = runSearch(
    "Find talks about GitHub pull requests on Monday",
    {},
    {
      hidePastEvents: true,
      now: "2026-07-07T10:00:00-04:00",
      timeZone: "America/Toronto"
    }
  );

  assert.deepEqual(results, []);
});

test("real data live conference search can show explicit past dates when hide past events is disabled", (t) => {
  const expectedPast = program.filter(
    (item) => item.date === "2026-07-06" && /pull request|pull-request|github/i.test(searchCorpus(item))
  );
  if (!expectedPast.length) {
    t.skip("No Monday pull-request or GitHub items are present in the refreshed program data");
    return;
  }

  const results = runSearch(
    "Find talks about GitHub pull requests on Monday",
    {},
    {
      hidePastEvents: false,
      now: "2026-07-07T10:00:00-04:00",
      timeZone: "America/Toronto"
    }
  );

  assert.ok(results.length >= Math.min(1, expectedPast.length));
  assert.ok(results.every((item) => item.date === "2026-07-06"));
});

test("real data calendar date and exact topic phrase query returns matching day talks", () => {
  let fixture;
  let results = [];

  for (const item of [...program].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))) {
    if (!item.date || !item.title) continue;
    const topicWords = normalizeText(item.title)
      .split(/\s+/)
      .filter((word) => word.length > 4)
      .slice(0, 2)
      .join(" ");
    if (!topicWords) continue;

    const candidateResults = runSearch(`find talks about ${topicWords} on ${dateQueryLabel(item.date)}`);
    if (candidateResults.some((result) => result.id === item.id)) {
      fixture = item;
      results = candidateResults;
      break;
    }
  }

  assert.ok(fixture, "Expected real data to include a titled timed item");

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date === fixture.date));
  assert.ok(results.some((item) => item.id === fixture.id));
});

test("real data room schedule query returns only that room", (t) => {
  const fixture = firstTimedItem((item) => /^MB\s+\S+/i.test(item.room || ""));
  if (!fixture) {
    t.skip("No MB room is present in the refreshed program data");
    return;
  }

  const results = runSearch(`what is in ${fixture.room}`);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.room === fixture.room));
});

test("real data date and time-band query returns only matching slots", () => {
  const fixture = firstTimedItem((item) => item.startTime < "12:00") || firstTimedItem();
  assert.ok(fixture, "Expected real data to include a timed item");
  const band = timeBandFor(fixture.startTime);

  const results = runSearch(`what is happening ${weekdayName(fixture.date)} ${band}`);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date === fixture.date));
  assert.ok(results.every((item) => (band === "morning" ? item.startTime < "12:00" : item.startTime >= "12:00")));
});

test("real data date and time-band topic query handles PR abbreviation", (t) => {
  const fixture = firstTimedItem((item) => /pull request|pull-request|github/i.test(searchCorpus(item)));
  if (!fixture) {
    t.skip("No pull-request or GitHub item is present in the refreshed program data");
    return;
  }
  const band = timeBandFor(fixture.startTime);

  const results = runSearch(`what is happening ${weekdayName(fixture.date)} ${band} about github pr`);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date === fixture.date));
  assert.ok(results.every((item) => (band === "morning" ? item.startTime < "12:00" : item.startTime >= "12:00")));
  assert.ok(results.some((item) => /pull request|pull-request|github/i.test(searchCorpus(item))));
});

test("real data exact time query returns events active at that time", () => {
  const fixture = firstTimedItem();
  assert.ok(fixture, "Expected real data to include a timed item");

  const results = runSearch(`what can I attend at ${fixture.startTime} on ${weekdayName(fixture.date)}`);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date === fixture.date));
  assert.ok(results.every((item) => item.startTime <= fixture.startTime && item.endTime > fixture.startTime));
});

test("real data exact start time query includes an item that starts then", () => {
  const fixture = firstTimedItem();
  assert.ok(fixture, "Expected real data to include a timed item");

  const results = runSearch(`what is happening at ${fixture.startTime} ${weekdayName(fixture.date)}`);

  assert.ok(results.some((item) => item.id === fixture.id));
  assert.ok(results.every((item) => item.date === fixture.date));
  assert.ok(results.every((item) => item.startTime <= fixture.startTime && item.endTime > fixture.startTime));
});

test("real data now query uses supplied conference timestamp", () => {
  const fixture = firstTimedItem();
  assert.ok(fixture, "Expected real data to include a timed item");
  const results = runSearch("what is happening now", {
    now: `${fixture.date}T${fixture.startTime}:00-04:00`
  });

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date === fixture.date));
  assert.ok(results.every((item) => item.startTime <= fixture.startTime && item.endTime > fixture.startTime));
  assert.ok(results.some((item) => item.id === fixture.id));
});

test("real data next query returns upcoming slots after supplied conference timestamp", () => {
  const fixture = firstTimedItem((item) => item.startTime > "00:00");
  assert.ok(fixture, "Expected real data to include a timed item after midnight");
  const now = minuteBefore(fixture.startTime);

  const results = runSearch("what is next", {
    now: `${fixture.date}T${now}:00-04:00`
  });

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date === fixture.date));
  assert.ok(results.every((item) => item.startTime >= now));
  assert.equal(results[0].startTime, fixture.startTime);
});
