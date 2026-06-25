# Find My Next Talk

A static, GitHub Pages-friendly search tool for Researchr conference programs.

## Live App

The app is deployed at:

```text
https://kaziamithasan.github.io/findmynexttalk/
```

The root page lists available conferences. FSE 2026 is served at:

```text
https://kaziamithasan.github.io/findmynexttalk/fse2026
```

## Current Status

This repository currently includes:

- React + Vite scaffold
- mined FSE 2026 data under `public/data/fse2026/`
- deterministic query parsing for topics, authors, affiliations, rooms, tracks, event types, dates, time bands, exact clock times, now, and next
- browser-side MiniSearch candidate discovery plus deterministic ranking/filtering
- local data validation script
- real-program regression tests for important attendee searches

This is intentionally a search tool only. It does not include bookmarks, login, user accounts, a backend, or an LLM API.

## Commands

```bash
npm install
npm run dev
npm run check
npm run audit:data
npm run build
```

Data validation can run without installing Node dependencies:

```bash
python3 scripts/validate_data.py public/data/fse2026/program.json public/data/fse2026/metadata.json
```

Audit mined data against the Researchr event calendar:

```bash
python3 scripts/audit_data.py --program public/data/fse2026/program.json --ical conferences/fse2026/event-calendar.ics
```

Node unit tests can run without Vite dependencies:

```bash
node --test tests/*.test.js
```

## GitHub Pages Deployment

The Vite base path is configured for:

```text
https://<username>.github.io/findmynexttalk/
```

Deployment is handled by `.github/workflows/deploy.yml`.

After pushing to GitHub:

1. Open the repository settings.
2. Go to `Pages`.
3. Set `Source` to `GitHub Actions`.
4. Run the `Deploy to GitHub Pages` workflow or push to `main`.

## Data Updates

`.github/workflows/update-data.yml` runs daily and can also be started manually.

It refreshes the Researchr program data, validates `program.json`, audits the iCal coverage, runs Python tests, and commits changed data files back to the repository.
It also builds and deploys the refreshed static site to GitHub Pages.

## Adding Another Researchr Conference

Researchr program pages under `https://conf.researchr.org/program/` generally share the same HTML structure.

For a new conference:

1. Add a new entry to `public/data/conferences.json`.
2. Create a folder for the manually downloaded detailed event calendar:

```text
conferences/<conference-slug>/event-calendar.ics
```

3. Run the scraper with that slug and Researchr program URL:

```bash
python3 scripts/scrape_program.py \
  --conference <conference-slug> \
  --conference-name "Conference Name" \
  --location "City, Country" \
  --dates "Date range" \
  --timezone "America/Toronto" \
  --url "https://conf.researchr.org/program/<conference>/<program-page>/"
```

This writes:

```text
public/data/<conference-slug>/program.json
public/data/<conference-slug>/metadata.json
```

Copy or create `public/data/<conference-slug>/synonyms.json` as well.

The app route will be:

```text
https://kaziamithasan.github.io/findmynexttalk/<conference-slug>
```

## Data Source

Canonical program source:

```text
https://conf.researchr.org/program/fse-2026/program-fse-2026/
```
