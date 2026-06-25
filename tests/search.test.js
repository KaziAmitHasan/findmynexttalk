import assert from "node:assert/strict";
import test from "node:test";

import { searchProgram } from "../src/search/localSearch.js";
import { parseQuery } from "../src/search/queryParser.js";
import { expandQueryWithSynonyms } from "../src/search/synonymMap.js";

const program = [
  {
    id: "pull-request-talk",
    title: "Towards Efficient and Secure Pull-Request-Based Software Development",
    abstract: "",
    authors: [{ name: "Kazi Amit Hasan" }],
    speakerNames: ["Kazi Amit Hasan"],
    track: "Doctoral Symposium",
    session: "Opening and Lightning talks",
    date: "2026-07-06",
    startTime: "09:33",
    endTime: "09:36",
    room: "MB 3.210",
    sourceUrl: "https://conf.researchr.org/program/fse-2026/program-fse-2026/",
    keywords: ["pull request", "GitHub", "security"],
    searchText:
      "Towards Efficient and Secure Pull-Request-Based Software Development Kazi Amit Hasan pull request GitHub security Doctoral Symposium MB 3.210"
  },
  {
    id: "pull-request-full-talk",
    title: "Towards Efficient and Secure Pull-Request-Based Software Development",
    abstract: "",
    authors: [{ name: "Kazi Amit Hasan" }],
    speakerNames: ["Kazi Amit Hasan"],
    track: "Doctoral Symposium",
    session: "Talks (Session 2)",
    date: "2026-07-06",
    startTime: "14:45",
    endTime: "15:00",
    room: "MB 3.210",
    sourceUrl: "https://conf.researchr.org/program/fse-2026/program-fse-2026/",
    keywords: ["pull request", "GitHub", "security"],
    searchText:
      "Towards Efficient and Secure Pull-Request-Based Software Development Kazi Amit Hasan pull request GitHub security Doctoral Symposium MB 3.210"
  },
  {
    id: "llm-testing-talk",
    title: "Testing Large Language Model Tools for Software Engineering",
    abstract: "Testing tools for large language model software engineering workflows.",
    authors: [],
    speakerNames: [],
    track: "Research Papers",
    session: "Software Testing and Analysis",
    date: "2026-07-07",
    startTime: "13:30",
    endTime: "13:45",
    room: "MB 1.210",
    sourceUrl: "https://conf.researchr.org/program/fse-2026/program-fse-2026/",
    keywords: ["LLM", "testing", "software engineering"],
    searchText:
      "Testing Large Language Model Tools for Software Engineering Research Papers Software Testing and Analysis LLM testing software engineering"
  },
  {
    id: "david-lo-talk",
    title: "Automated Repair of TEE Partitioning Issues via DSL-Guided and LLM-Assisted Patching",
    abstract: "",
    authors: [{ name: "David Lo", affiliation: "Singapore Management University" }],
    speakerNames: ["David Lo"],
    track: "Research Papers",
    session: "Security 1",
    date: "2026-07-07",
    startTime: "11:00",
    endTime: "11:20",
    room: "MB 3.435",
    sourceUrl: "https://conf.researchr.org/program/fse-2026/program-fse-2026/",
    keywords: ["security", "repair"],
    searchText:
      "Automated Repair of TEE Partitioning Issues via DSL-Guided and LLM-Assisted Patching David Lo Research Papers Security"
  },
  {
    id: "david-williams-talk",
    title: "BayesInsights",
    abstract: "",
    authors: [{ name: "David Williams" }],
    speakerNames: ["David Williams"],
    track: "Industry Papers",
    session: "Developer Experience",
    date: "2026-07-08",
    startTime: "16:50",
    endTime: "17:10",
    room: "MB 3.445",
    sourceUrl: "https://conf.researchr.org/program/fse-2026/program-fse-2026/",
    keywords: ["developer experience"],
    searchText: "BayesInsights David Williams Industry Papers Developer Experience"
  },
  {
    id: "smu-talk",
    title: "Configuring Agentic AI Coding Tools",
    abstract: "",
    authors: [{ name: "Christoph Treude", affiliation: "Singapore Management University" }],
    speakerNames: ["Christoph Treude"],
    track: "AIware Main Track",
    session: "Coding Agents",
    date: "2026-07-06",
    startTime: "09:10",
    endTime: "09:15",
    room: "MB 1.210",
    sourceUrl: "https://conf.researchr.org/program/fse-2026/program-fse-2026/",
    keywords: ["coding agents"],
    searchText: "Configuring Agentic AI Coding Tools Christoph Treude Singapore Management University"
  }
];

test("MiniSearch-backed search expands PR synonyms", () => {
  const query = "github pr";
  const parsed = parseQuery(query);
  const expanded = expandQueryWithSynonyms(query, {
    pr: ["pull request", "pull requests"]
  });

  const results = searchProgram(program, expanded, parsed);

  assert.equal(results[0].id, "pull-request-talk");
});

test("structured room search can work without a topic hit", () => {
  const query = "what is in MB 3.210";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.room === "MB 3.210"));
});

test("structured date and time-band search returns matching day events", () => {
  const query = "Monday morning";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.date === "2026-07-06"));
  assert.ok(results.every((item) => item.startTime < "12:00"));
});

test("speaker query filters out unrelated stopword matches", () => {
  const query = "When is Kazi presenting?";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.equal(results.length, 2);
  assert.equal(results[0].id, "pull-request-talk");
  assert.equal(results[1].id, "pull-request-full-talk");
  assert.match(results[0].whyMatched, /speaker is Kazi/);
});

test("topic phrase ranks title and keyword matches above vague text", () => {
  const query = "GitHub pull request";
  const parsed = parseQuery(query);
  const expanded = expandQueryWithSynonyms(query, {
    "pull request": ["code review"]
  });

  const results = searchProgram(program, expanded, parsed);

  assert.equal(results[0].id, "pull-request-talk");
  assert.equal(results[1].id, "pull-request-full-talk");
});

test("track query filters to the requested track", () => {
  const query = "Doctoral Symposium talks";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.ok(results.length >= 2);
  assert.ok(results.every((item) => item.track === "Doctoral Symposium"));
});

test("room query filters to the requested room", () => {
  const query = "talks in MB 1.210";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.room === "MB 1.210"));
  assert.doesNotMatch(results[0].whyMatched, /contains "in"/);
});

test("talks of author query matches author names generically", () => {
  const query = "Find talks of david lo";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, "david-lo-talk");
});

test("author query tolerates one-character name typo", () => {
  const query = "Find talks of david loo";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, "david-lo-talk");
});

test("bare full author name query is inferred as author intent", () => {
  const query = "david loo";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, "david-lo-talk");
});

test("talks of institution query matches author affiliations", () => {
  const query = "Find talks of Singapore Management University";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.deepEqual(
    results.map((item) => item.id),
    ["smu-talk", "david-lo-talk"]
  );
  assert.ok(results.every((item) => item.authors.some((author) => author.affiliation === "Singapore Management University")));
});

test("bare institution query is inferred as affiliation intent", () => {
  const query = "Singapore Management University";
  const parsed = parseQuery(query);

  const results = searchProgram(program, query, parsed);

  assert.deepEqual(
    results.map((item) => item.id),
    ["smu-talk", "david-lo-talk"]
  );
});
