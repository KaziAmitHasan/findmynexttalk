# Find My Next Talk

### Problem:
Navigating through page-long schedules of talks, keynotes, and presentations in multi-day conferences is very exhausting and confusing (multiple sessions at a time). Although I always make a list of potential talks I want to attend, it's still hard to find talks/presentations related to my choice of research topic (e.g., CI/CD, GitHub Pull Requests, Testing), institution, or researchers.

### Solution

So, I solved this by developing an open-source tool, FindMyNextTalk. It's a static search tool for conference programs hosted on the
[Researchr](https://conf.researchr.org/) platform.

Visit the web app: https://kaziamithasan.github.io/findmynexttalk/

#### Supported Conferences

| Conference | Find My Next Talk URL | Status |
| --- | --- | --- |
| [FSE 2026](https://conf.researchr.org/program/fse-2026/program-fse-2026/) | https://kaziamithasan.github.io/findmynexttalk/fse2026 | Supported |

#### How it works

Visit https://kaziamithasan.github.io/findmynexttalk/ and select the conference. You can ask your query in natural language, and it will show you the talks! For example,


```text
Find talks about GitHub pull requests
Find talks from Queen's University
Find talks by David Lo
What is happening now?
Show keynotes on July 7
Find testing talks in Research Papers
What is in MB 1.210?
```

Find My Next Talk converts the official Researchr program into structured static data and
provides a fast browser-side search experience over that data.

#### Features

- Natural-language-like search for topics, titles, authors, speakers, and affiliations
- Room, track, event type, date, time band, exact time, now, and next queries
- Date-grouped results with compact cards for scanning schedules quickly
- Current-session view for conferences that are in progress
- Optional hiding of past events while a conference is running
- Synonym support for common research and software-engineering terms
- Links from each result back to the official Researchr source
- Fully static deployment on GitHub Pages
- No login, profile creation, backend server, database, or LLM API

#### Data Inventory

| Conference | Slug | Program Data | Metadata | Event Calendar | Audit Status |
| --- | --- | --- | --- | --- | --- |
| FSE 2026 | `fse2026` | `public/data/fse2026/program.json` | `public/data/fse2026/metadata.json` | `conferences/fse2026/event-calendar.ics` | 586 program items, 0 missing against iCal |

The FSE 2026 dataset includes scheduled items, talks, sessions, rooms, tracks, speakers,
authors, affiliations, abstracts, links, and metadata where available from the official
Researchr program.

### Repository Layout

```text
public/data/conferences.json          Conference registry used by the app
public/data/<conference>/program.json Normalized searchable program data
public/data/<conference>/metadata.json Conference metadata and source information
public/data/<conference>/synonyms.json Conference-specific search synonyms
conferences/<conference>/             Manually downloaded event-calendar.ics files
scripts/scrape_program.py             Researchr data miner
scripts/validate_data.py              Data validation checks
scripts/audit_data.py                 Program JSON versus iCal audit
src/                                  React application
tests/                                Query, ranking, routing, and data regression tests
```

## Local Development

Clone the repository:

```bash
git clone https://github.com/KaziAmitHasan/findmynexttalk.git
cd findmynexttalk
```

Install Node.js dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

The app will be available at the local URL printed by Vite, usually:

```text
http://localhost:5173/findmynexttalk/
```

Run the full verification suite before opening a pull request:

```bash
npm run check
```

Build the static site for production:

```bash
npm run build
```


## Adding Another Researchr Conference

Researchr program pages under `https://conf.researchr.org/program/` generally use the same
program structure. To add a new conference:

1. Add the conference to `public/data/conferences.json`.
2. Create `conferences/<conference-slug>/`.
3. Download the detailed Researchr event calendar and save it as:

```text
conferences/<conference-slug>/event-calendar.ics
```

4. Run the scraper:

```bash
python3 scripts/scrape_program.py \
  --conference <conference-slug> \
  --conference-name "Conference Name" \
  --location "City, Country" \
  --dates "Date range" \
  --timezone "America/Toronto" \
  --url "https://conf.researchr.org/program/<conference>/<program-page>/"
```

5. Validate the generated data:

```bash
npm run check
```

Generated files:

```text
public/data/<conference-slug>/program.json
public/data/<conference-slug>/metadata.json
```

Add or customize `public/data/<conference-slug>/synonyms.json` when the conference needs
domain-specific search terms.


## Developer and Contact

Created and developed by Kazi Amit Hasan.

- GitHub: [KaziAmitHasan](https://github.com/KaziAmitHasan)
- Project: [Find My Next Talk](https://github.com/KaziAmitHasan/findmynexttalk)
- Issues and feature requests: [open an issue](https://github.com/KaziAmitHasan/findmynexttalk/issues)
