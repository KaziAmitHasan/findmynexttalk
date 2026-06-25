# FSE 2026 Program Assistant Engineering Plan

## 1. Project State

| Area | Status | Notes |
| --- | --- | --- |
| Planning | DONE | Engineering plan created and will be updated as work lands. |
| Repository scaffold | DONE | React + Vite scaffold builds successfully. |
| Data contract | DONE | Live mined Researchr JSON now uses the target schema. |
| Data mining | IN PROGRESS | Detailed Table + event-calendar.ics merge extracts 586 verified schedule items; detail-page enrichment pending. |
| Search | IN PROGRESS | MiniSearch candidate discovery plus deterministic structured filters for authors, affiliations, rooms, days, tracks, event types, and topics. |
| UI | IN PROGRESS | Search cards now show enriched schedule data; schedule-like queries are grouped by time. |
| Tests | IN PROGRESS | JS tests, Python tests, data validation, iCal audit, and build pass. |
| Deployment | IN PROGRESS | GitHub Pages and data update workflows added; live repository settings/push still needed. |

Status values:

- `TODO`: Not started.
- `IN PROGRESS`: Actively being implemented.
- `DONE`: Implemented and verified.
- `BLOCKED`: Cannot proceed without user input, access, or upstream change.

## 2. Product Goal

Build a zero-cost, static, GitHub Pages-hosted conference program assistant for FSE 2026.

The assistant must:

- Accept natural-language-like queries.
- Search only local, mined FSE 2026 program data.
- Return structured talk/session cards with time, room, track, speakers, and source links.
- Avoid backend services, databases, paid LLM APIs, and hallucinated generated answers.
- Clearly show data freshness because the official Researchr program is tentative and may change.

Canonical source:

```text
https://conf.researchr.org/program/fse-2026/program-fse-2026/
```

## 3. Non-Goals

- TODO: Do not add authentication.
- TODO: Do not add a backend API.
- TODO: Do not store PDFs, videos, or large binary conference artifacts.
- TODO: Do not generate answers from an LLM.
- TODO: Do not claim schedule certainty beyond the mined official source.
- TODO: Do not add bookmarks, personal schedules, user accounts, or persistence; this is a search tool only.

## 4. Architecture

```text
Researchr program page
        |
        | scrape_program.py
        | parse_ical.py
        | parse_researchr_html.py
        | enrich_talk_pages.py
        v
public/data/program.json
public/data/metadata.json
public/data/synonyms.json
        |
        | Vite static build
        v
React app on GitHub Pages
        |
        | MiniSearch in browser
        v
Chat-style search answers and searchable schedule results
```

Design constraints:

- TODO: All runtime search must happen in the browser.
- TODO: All app data must be static files under `public/data`.
- TODO: Generated data must be deterministic to keep diffs reviewable.
- TODO: Every answer card must include an official source URL when available.
- TODO: The UI must not expose scraper/debug internals to users.

## 5. Repository Layout

Target structure:

```text
.
├── .github/workflows/
│   ├── deploy.yml
│   └── update-data.yml
├── public/
│   └── data/
│       ├── metadata.json
│       ├── program.json
│       └── synonyms.json
├── scripts/
│   ├── enrich_talk_pages.py
│   ├── parse_ical.py
│   ├── parse_researchr_html.py
│   ├── scrape_program.py
│   └── validate_data.py
├── src/
│   ├── components/
│   ├── search/
│   ├── utils/
│   ├── App.jsx
│   ├── main.jsx
│   └── style.css
├── tests/
├── index.html
├── package.json
├── PLAN.md
├── README.md
└── vite.config.js
```

## 6. Data Contract

### 6.1 Program Item

Each entry in `public/data/program.json` must follow this shape:

```json
{
  "id": "fse2026-talk-001",
  "kind": "talk",
  "title": "Towards Efficient and Secure Pull-Request-Based Software Development",
  "abstract": "",
  "authors": [
    {
      "name": "Kazi Amit Hasan",
      "affiliation": "Queen's University, Canada"
    }
  ],
  "speakerNames": ["Kazi Amit Hasan"],
  "track": "Doctoral Symposium",
  "session": "Opening and Lightning talks",
  "eventType": "Talk",
  "date": "2026-07-06",
  "startTime": "09:33",
  "endTime": "09:36",
  "durationMinutes": 3,
  "room": "MB 3.210",
  "sourceUrl": "https://conf.researchr.org/...",
  "presentationUrl": null,
  "doiUrl": null,
  "preprintUrl": null,
  "keywords": ["pull request", "software development", "security", "GitHub"],
  "searchText": "title authors speakers track session abstract keywords"
}
```

Required fields:

- TODO: `id`
- TODO: `kind`
- TODO: `title`
- TODO: `date`
- TODO: `startTime`
- TODO: `track` or `session`
- TODO: `sourceUrl`
- TODO: `searchText`

Nullable fields:

- TODO: `abstract`
- TODO: `room`
- TODO: `presentationUrl`
- TODO: `doiUrl`
- TODO: `preprintUrl`

### 6.2 Metadata

`public/data/metadata.json`:

```json
{
  "conference": "FSE 2026",
  "location": "Montreal, Canada",
  "dates": "Sun 5 - Thu 9 July 2026",
  "timezone": "America/Toronto",
  "source": "https://conf.researchr.org/program/fse-2026/program-fse-2026/",
  "lastUpdated": "2026-06-25T00:00:00-04:00",
  "statusNote": "The official program is tentative and subject to change."
}
```

## 7. Scraper Design

### 7.1 Sources

- TODO: Main Researchr program HTML.
- TODO: `event-calendar.ics` if available.
- TODO: `session-calendar.ics` if available.
- TODO: Individual talk/session detail pages linked from the program.

### 7.2 Extraction Priority

1. TODO: Use iCal for date, start time, end time, duration, room, and calendar event title.
2. TODO: Use program HTML for track, session grouping, talk ordering, speaker names, and detail links.
3. TODO: Use detail pages for abstracts, affiliations, DOI/preprint/slides links, and richer author metadata.

### 7.3 Merge Rules

- TODO: Prefer exact source URL match when merging records.
- TODO: Fall back to normalized title + date + start time.
- TODO: Keep both iCal and HTML titles in debug output if they conflict.
- TODO: Normalize whitespace, punctuation, and Unicode dashes.
- TODO: Generate stable IDs from date, normalized title, and source path.

### 7.4 Scraper Acceptance Criteria

- TODO: Produces valid `program.json` and `metadata.json`.
- TODO: Covers every visible scheduled item on the program page where technically extractable.
- TODO: Preserves official source URLs.
- TODO: Does not commit large raw HTML snapshots.
- TODO: Fails validation on critical missing fields.

## 8. Search Design

### 8.1 Query Types

- DONE: Topic: `pull request`, `LLM`, `testing`, `security`.
- DONE: Speaker/author: `talks by Kazi`, `when is Yuan Tian presenting`, `Find talks of david loo`.
- DONE: Institution/affiliation: `Find talks of Singapore Management University`, `papers from Queen's University`.
- DONE: Room: `MB 3.210`, `what is in room MB 1.210`.
- DONE: Time: `Monday morning`, `Tuesday after lunch`.
- DONE: Exact clock time: `2 pm`, `what can I attend at 14:45`.
- DONE: Track: `Doctoral Symposium`, `Tool Demonstrations`, `Research Papers`, `AIware Keynotes`.
- DONE: Event type: `keynotes`, `lunch on Tuesday`, `coffee break`.
- DONE: Combination: `Tool Demonstrations about testing`, `AIware keynotes`, `Research papers about pull request`.

### 8.2 Ranking

MiniSearch field boost targets:

- TODO: `title`: 5
- TODO: `keywords`: 5
- TODO: `abstract`: 3
- TODO: `speakerNames`: 2
- TODO: `authorsText`: 2
- TODO: `track`: 1.5
- TODO: `session`: 1.5
- TODO: `room`: 1

Post-search rank adjustments:

- DONE: Exact title phrase match.
- DONE: Exact speaker/author match.
- DONE: Exact affiliation match.
- DONE: Exact room match.
- DONE: Date/time filter match.
- DONE: Track filter match.
- DONE: Event type filter match.
- DONE: Topic terms remain required when combined with structured filters.

### 8.3 Search Acceptance Criteria

- DONE: `github pr` finds pull request talks.
- DONE: `talks by Kazi` finds Kazi Amit Hasan entries.
- DONE: `Find talks of david loo` finds David Lo entries without a person-specific rule.
- DONE: `Find talks of Singapore Management University` finds affiliation matches without an institution-specific rule.
- DONE: `keynotes` returns only keynote events.
- DONE: `AIware keynotes` excludes AIware main-track talks and AIware Q&A events.
- DONE: `lunch on Tuesday` returns only Tuesday lunch.
- DONE: `what can I attend at 2 pm on Tuesday` returns events overlapping 14:00.
- DONE: `what is happening at 14:45 Monday` returns events overlapping 14:45, including Kazi Amit Hasan's afternoon talk.
- DONE: `what is happening now` uses the current conference-local date/time during FSE.
- DONE: `what is next` returns upcoming slots after the current conference-local time, or the first conference day before FSE starts.
- DONE: `Monday morning` filters to July 6 morning events.
- DONE: `MB 3.210` finds events in that room.
- DONE: No-result queries return a clear non-hallucinated response with suggestions.

### 8.4 Interaction Coverage Matrix

| User intent | Example | Current behavior | Test coverage |
| --- | --- | --- | --- |
| Author/person | `When is Kazi presenting?` | Hard filters author/speaker names, typo-tolerant by token | DONE |
| Author/person typo | `Find talks of david loo` | Matches David Lo generically with one-character token tolerance | DONE |
| Institution | `Find talks of Singapore Management University` | Converts unmatched person-like query into affiliation search | DONE |
| Institution punctuation | `papers from Queen's University` | Normalizes apostrophes/curly apostrophes before affiliation matching | DONE |
| Topic | `GitHub pull request` | Uses MiniSearch plus deterministic title/keyword/abstract scoring | DONE |
| Topic + track | `Tool Demonstrations about testing` | Requires both track and topic/synonym match | DONE |
| Track | `Doctoral Symposium talks` | Hard filters normalized track aliases | DONE |
| Event type | `keynotes` | Hard filters `eventType === Keynote` | DONE |
| Event type + track | `AIware keynotes` | Hard filters both AIware Keynotes and Keynote type | DONE |
| Event type + date | `lunch on Tuesday` | Hard filters date and lunch type | DONE |
| Room | `what is in MB 3.210` | Hard filters exact normalized room | DONE |
| Day/time band | `what is happening Monday morning` | Hard filters conference date and time band | DONE |
| Exact clock time | `what is at 2 pm` | Hard filters events whose start/end window overlaps the requested time | DONE |
| Now | `what is happening now` | Uses America/Toronto conference time and active event windows | DONE |
| Next | `what is next` | Uses America/Toronto conference time and upcoming event starts | DONE |

## 9. UI Design

### 9.1 Views

- TODO: Chat/search home.
- TODO: Schedule view.
- TODO: Talk detail modal or panel.
- TODO: Data status footer/banner.

### 9.2 Interaction Requirements

- TODO: Sample prompt buttons populate and run search.
- TODO: Result cards show title, speaker, time, track, room, session, and source link.
- TODO: Result cards include a deterministic "why matched" explanation.
- TODO: Search results can be filtered by day, track, and room.
- DONE: No-result states explain what was understood and suggest concrete alternate searches.
- DONE: Schedule-like results are grouped by date/time for scanability.

### 9.3 UI Acceptance Criteria

- TODO: First screen is the usable assistant, not a marketing landing page.
- TODO: Works on desktop and mobile widths.
- TODO: Text does not overflow cards or buttons.
- TODO: Loading, empty, and error states are visible and useful.

## 10. Testing Strategy

### 10.1 Unit Tests

- DONE: Query parser detects weekdays, time bands, rooms, likely speaker queries, tracks, and event types.
- DONE: Synonym expansion maps common software-engineering terms.
- DONE: Ranking helpers return deterministic order.
- DONE: Result grouping helpers detect schedule-like queries and group cards by time.

### 10.2 Data Validation Tests

- TODO: `program.json` is valid JSON.
- TODO: `metadata.json` is valid JSON.
- TODO: Required fields are present.
- TODO: Dates are within 2026-07-05 through 2026-07-09.
- TODO: Start/end times use `HH:MM`.
- TODO: Duplicate IDs fail validation.
- TODO: Invalid source URLs fail validation.

### 10.3 Integration/Build Checks

- TODO: `npm test` passes.
- TODO: `npm run test:data` passes.
- TODO: `npm run build` passes after dependencies are installed.

### 10.4 Real-Data Interaction Regression Queries

- DONE: `find me talks related to GitHub pull request`
- DONE: `when is Kazi presenting`
- DONE: `Find talks of david loo`
- DONE: `Find talks of Singapore Management University`
- DONE: `papers from Queen's University`
- DONE: `keynotes`
- DONE: `AIware keynotes`
- DONE: `lunch on Tuesday`
- DONE: `what can I attend at 2 pm on Tuesday`
- DONE: `what is happening at 14:45 Monday`
- DONE: `what is happening now`
- DONE: `what is next`
- DONE: `what is happening Monday morning`
- DONE: `show talks in MB 3.210`
- DONE: `Tool Demonstrations about testing`

### 10.5 Remaining Manual Acceptance Queries

- TODO: mobile visual check after search/status UI is polished.

## 11. Deployment

### 11.1 GitHub Pages

- DONE: Configure Vite `base` for repository Pages deployment.
- DONE: Build output to `dist`.
- DONE: Add GitHub Actions Pages deployment workflow.
- TODO: Push repository to GitHub and enable Pages source as GitHub Actions.

### 11.2 Data Update Workflow

- DONE: Add manual `workflow_dispatch`.
- DONE: Add daily scheduled run.
- DONE: Run scraper with iCal refresh attempt.
- DONE: Run validator and iCal audit.
- DONE: Commit data changes only when changed.
- DONE: Build and deploy refreshed static site after data updates.

## 12. Implementation Queue

### Now

- DONE: Replace high-level plan with engineering execution plan.
- DONE: Scaffold project files.
- DONE: Add data contract seed files.
- DONE: Add first query parser and tests.
- DONE: Add data validator and validation test command.
- DONE: Prepare for dependency install and browser build verification.
- DONE: Integrate MiniSearch.
- DONE: Add first Researchr HTML scraper pass.
- DONE: Replace seed data with live mined Researchr program data.
- IN PROGRESS: Start local dev server for manual UI review.

### Next

- DONE: Install dependencies.
- DONE: Verify `npm run build`.
- TODO: Add iCal parsing/enrichment for end times and calendar source fidelity.
- TODO: Add detail-page enrichment for abstracts, affiliations, preprints, DOI/slides links.

### Later

- TODO: Complete full Researchr mining.
- DONE: Add search-focused schedule browsing polish.
- TODO: Add GitHub Actions workflows.
- TODO: Polish and deploy.

## 13. Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Researchr HTML changes | Scraper breaks | Prefer iCal for times, modular parsers, validation | TODO |
| Program changes | Stale app data | Daily workflow, last-updated UI, official links | TODO |
| iCal lacks speaker/track metadata | Incomplete search cards | Merge with HTML and detail pages | TODO |
| Detail pages are inconsistent | Missing abstracts/links | Treat detail enrichment as optional per field | TODO |
| Search misses abbreviations | Bad results | Curated synonyms and test queries | TODO |
| GitHub Pages size limits | Deploy failure | Store metadata only, link large assets | TODO |

## 14. Definition Of Done For MVP

- TODO: Full app runs locally with `npm run dev`.
- TODO: App builds with `npm run build`.
- TODO: Search works against mined or seed `program.json`.
- TODO: Data validation passes.
- TODO: Unit tests pass.
- TODO: UI shows official source links and last-updated status.
- TODO: GitHub Pages deployment workflow exists.

## 15. Completed Implementation Log

- DONE: Added `package.json` with Vite, React, MiniSearch, and test scripts.
- DONE: Added `index.html`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, and `src/style.css`.
- DONE: Added `public/data/program.json`, `public/data/metadata.json`, and `public/data/synonyms.json`.
- DONE: Added query parsing in `src/search/queryParser.js`.
- DONE: Added synonym expansion in `src/search/synonymMap.js`.
- DONE: Added simple deterministic local search in `src/search/localSearch.js`.
- DONE: Added data validation script in `scripts/validate_data.py`.
- DONE: Added Python validation tests in `tests/validate_data_test.py`.
- DONE: Added Node query parser tests in `tests/queryParser.test.js`.
- DONE: Verified Python validation tests pass.
- DONE: Verified current seed data passes validation.
- DONE: Verified Node tests pass.
- DONE: Verified Vite production build succeeds.
- DONE: Added MiniSearch-backed result ranking.
- DONE: Added `scripts/parse_researchr_html.py` and `scripts/scrape_program.py`.
- DONE: Verified live scraper extracts 550 deduped FSE 2026 schedule items.
- DONE: Verified mined dataset includes rooms for 540 items.
- DONE: Verified mined dataset includes Kazi Amit Hasan's pull-request talk at MB 3.210.
- DONE: Replaced seed dataset with mined Researchr program data.
- DONE: Fixed scraper identity bug where repeated slots for the same Researchr event were collapsed.
- DONE: Re-mined Detailed Table data with 586 schedule items.
- DONE: Verified Kazi Amit Hasan has both July 6 entries: 09:33 lightning talk and 14:45 full talk.
- DONE: Added `event-calendar.ics` parsing and merge by Researchr slot UID.
- DONE: Verified 586 iCal events match 586 mined JSON items with zero missing on either side.
- DONE: Added iCal abstracts/descriptions for 543 program items.
- DONE: Added `scripts/audit_data.py` and wired `npm run audit:data` into `npm run check`.
- DONE: Added UI filters for day, track, and room.
- DONE: Updated result cards to show end time, duration, room, author affiliations, abstract snippets, preprint links, and DOI links.
- DONE: Replaced vague MiniSearch score dominance with deterministic field-weighted ranking.
- DONE: Structured intents for speaker, room, date, time band, and track now act as hard filters before ranking.
- DONE: Added ranking regression tests for speaker, topic, track, and room queries.
- DONE: Added generic affiliation/institution search, including queries like `Find talks of Singapore Management University`.
- DONE: Added event-type intent parsing for keynotes, lunch, coffee breaks, Q&A, awards, opening, and closing.
- DONE: Added hard event-type filtering so `keynotes` and `AIware keynotes` do not return unrelated talks.
- DONE: Fixed mixed structured/topic search so date or track matches alone do not swamp topic-specific results.
- DONE: Added real-program interaction regression tests for authors, institutions, keynotes, lunch, topics, rooms, and day/time queries.
- DONE: Added exact clock-time, now, and next query support with real-program regression tests.
- DONE: Tightened room parsing to actual Researchr room formats so `at 2 pm` is not misread as room `AT 2`.
- DONE: Added grouped schedule-style result rendering and tests for grouping behavior.
