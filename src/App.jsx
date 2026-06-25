import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { parseQuery } from "./search/queryParser.js";
import { expandQueryWithSynonyms } from "./search/synonymMap.js";
import { searchProgram } from "./search/localSearch.js";
import { groupResultsByTime, isScheduleLikeQuery } from "./utils/resultGrouping.js";
import { conferenceDataPath, conferenceRoute, getConferenceSlug } from "./utils/conferenceRouting.js";

const SAMPLE_PROMPTS = [
  "Find talks about GitHub pull requests",
  "When is Kazi presenting?",
  "Find talks of Singapore Management University",
  "AIware keynotes",
  "What is happening Monday morning?",
  "What can I attend at 2 pm?",
  "What is next?",
  "Show talks in MB 3.210",
  "Find testing talks after lunch"
];

export default function App() {
  const conferenceSlug = useMemo(
    () => getConferenceSlug(window.location.pathname, import.meta.env.BASE_URL),
    []
  );
  const [conferences, setConferences] = useState([]);
  const [program, setProgram] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [synonyms, setSynonyms] = useState({});
  const [query, setQuery] = useState("Find talks about GitHub pull requests");
  const [submittedQuery, setSubmittedQuery] = useState("Find talks about GitHub pull requests");
  const [filters, setFilters] = useState({ day: "", track: "", room: "" });
  const [hidePastEvents, setHidePastEvents] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoadError("");
        setProgram([]);
        setMetadata(null);
        setSynonyms({});

        const conferencesResponse = await fetch(`${import.meta.env.BASE_URL}data/conferences.json`);
        if (!conferencesResponse.ok) {
          throw new Error("Could not load conference list.");
        }

        const conferenceList = await conferencesResponse.json();
        setConferences(conferenceList);

        if (!conferenceSlug) {
          return;
        }

        const conference = conferenceList.find((item) => item.slug === conferenceSlug);
        if (!conference) {
          throw new Error(`Conference "${conferenceSlug}" is not configured.`);
        }

        const dataPath = conference.dataPath || conferenceDataPath(conferenceSlug);
        const [programResponse, metadataResponse, synonymsResponse] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}${dataPath}/program.json`),
          fetch(`${import.meta.env.BASE_URL}${dataPath}/metadata.json`),
          fetch(`${import.meta.env.BASE_URL}${dataPath}/synonyms.json`)
        ]);

        if (!programResponse.ok || !metadataResponse.ok || !synonymsResponse.ok) {
          throw new Error("Could not load conference data.");
        }

        setProgram(await programResponse.json());
        setMetadata(await metadataResponse.json());
        setSynonyms(await synonymsResponse.json());
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Could not load conference data.");
      }
    }

    loadData();
  }, [conferenceSlug]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const conferenceDates = useMemo(
    () => [...new Set(program.map((item) => item.date).filter(Boolean))].sort(),
    [program]
  );
  const parsedQuery = useMemo(
    () =>
      parseQuery(submittedQuery, {
        conferenceDates: conferenceDates.length ? conferenceDates : undefined,
        timeZone: metadata?.timezone
      }),
    [submittedQuery, conferenceDates, metadata]
  );

  const results = useMemo(() => {
    const expanded = expandQueryWithSynonyms(submittedQuery, synonyms);
    return applyUiFilters(
      searchProgram(program, expanded, parsedQuery, {
        hidePastEvents,
        hasExplicitDateFilter: Boolean(filters.day),
        conferenceDates,
        timeZone: metadata?.timezone,
        now: currentTime
      }),
      filters
    );
  }, [program, submittedQuery, synonyms, parsedQuery, filters, hidePastEvents, conferenceDates, metadata, currentTime]);

  const filterOptions = useMemo(() => buildFilterOptions(program), [program]);
  const showScheduleGroups = useMemo(() => isScheduleLikeQuery(parsedQuery), [parsedQuery]);
  const resultGroups = useMemo(
    () => (showScheduleGroups ? groupResultsByTime(results) : []),
    [results, showScheduleGroups]
  );
  const noResultSuggestions = useMemo(
    () => buildNoResultSuggestions(parsedQuery, filterOptions),
    [parsedQuery, filterOptions]
  );

  function submitSearch(event) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  }

  function runPrompt(prompt) {
    setQuery(prompt);
    setSubmittedQuery(prompt);
  }

  if (!conferenceSlug) {
    return (
      <main className="app-shell">
        <section className="assistant-panel">
          <div className="conference-landing">
            <div className="app-header">
              <div>
                <p className="eyebrow">Conference Search</p>
                <h1>Find My Next Talk</h1>
              </div>
              <div className="header-meta">
                <span>{conferences.length || loadError ? `${conferences.length} conference${conferences.length === 1 ? "" : "s"}` : "Loading"}</span>
              </div>
            </div>

            <section className="conference-picker" aria-label="Available conferences">
              <div className="picker-copy">
                <h2>Choose a conference</h2>
                <p>Search conference programs by title, author, affiliation, topic, room, track, and time.</p>
              </div>

              {loadError ? <p className="result-summary error">{loadError}</p> : null}

              <div className="conference-grid">
                {conferences.map((conference) => (
                  <a
                    className="conference-card"
                    href={conferenceRoute(conference.slug, import.meta.env.BASE_URL)}
                    key={conference.slug}
                  >
                    <span>{conference.label}</span>
                    <strong>Open search tool</strong>
                  </a>
                ))}
              </div>
            </section>
          </div>

          <footer>
            <span>Static search tools for Researchr conference programs.</span>
            <span>Developed by Kazi Amit Hasan</span>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="assistant-panel">
        <div className="app-header">
          <div>
            <p className="eyebrow">{metadata?.conference ?? conferenceSlug.toUpperCase()}</p>
            <h1>Find My Next Talk</h1>
          </div>
          <div className="header-meta">
            <span>{metadata?.conference ?? "Loading data"}</span>
          </div>
        </div>

        <form className="search-form" onSubmit={submitSearch}>
          <label htmlFor="query">Search the program</label>
          <div className="search-row">
            <input
              id="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find talks about GitHub pull requests"
            />
            <button type="submit" aria-label="Search">
              <Search size={18} aria-hidden="true" />
              <span>Search</span>
            </button>
          </div>
        </form>

        <div className="control-disclosures">
          <details>
            <summary>
              <Sparkles size={14} aria-hidden="true" />
              Suggestions
            </summary>
            <div className="prompt-list" aria-label="Sample prompts">
              {SAMPLE_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" onClick={() => runPrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </details>

          <details>
            <summary>
              <SlidersHorizontal size={14} aria-hidden="true" />
              Filters
              {activeFilterCount(filters) ? <span>{activeFilterCount(filters)}</span> : null}
            </summary>
            <section className="filter-bar" aria-label="Program filters">
              <label>
                Day
                <select
                  value={filters.day}
                  onChange={(event) => setFilters((current) => ({ ...current, day: event.target.value }))}
                >
                  <option value="">Any day</option>
                  {filterOptions.days.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Track
                <select
                  value={filters.track}
                  onChange={(event) => setFilters((current) => ({ ...current, track: event.target.value }))}
                >
                  <option value="">Any track</option>
                  {filterOptions.tracks.map((track) => (
                    <option key={track} value={track}>
                      {track}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Room
                <select
                  value={filters.room}
                  onChange={(event) => setFilters((current) => ({ ...current, room: event.target.value }))}
                >
                  <option value="">Any room</option>
                  {filterOptions.rooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-filter">
                <input
                  type="checkbox"
                  checked={hidePastEvents}
                  onChange={(event) => setHidePastEvents(event.target.checked)}
                />
                Hide past events
              </label>
              <button type="button" onClick={() => setFilters({ day: "", track: "", room: "" })}>
                Clear
              </button>
            </section>
          </details>
        </div>

        {loadError ? <p className="result-summary error">{loadError}</p> : null}

        {!loadError ? (
          <p className="result-summary">
            {results.length > 0
              ? `${results.length} ${results.length === 1 ? "item" : "items"} found`
              : "No matching talks found"}
          </p>
        ) : null}

        {!results.length && !loadError ? (
          <details className="inline-disclosure">
            <summary>Show suggestions</summary>
            <div className="prompt-list compact" aria-label="Suggested searches">
              {noResultSuggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => runPrompt(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </details>
        ) : null}

        {showScheduleGroups ? (
          <section className="schedule-results" aria-label="Search results grouped by time">
            {resultGroups.map((group) => (
              <section className="time-group" key={group.key}>
                <div className="time-group-header">
                  <h2>{group.label}</h2>
                  <span>{group.items.length} item{group.items.length === 1 ? "" : "s"}</span>
                </div>
                <div className="results-grid">
                  {group.items.map((item) => renderTalkCard(item))}
                </div>
              </section>
            ))}
          </section>
        ) : (
          <section className="results-grid" aria-label="Search results">
            {results.map((item) => renderTalkCard(item))}
          </section>
        )}

        <footer>
          <span>{metadata?.statusNote ?? "Program data loading."}</span>
          <span>Developed by Kazi Amit Hasan</span>
        </footer>
      </section>
    </main>
  );
}

function renderTalkCard(item) {
  return (
    <article className="talk-card" key={item.id}>
      <div className="result-brief">
        <div>
          <p className="result-time">{formatDateTime(item)}</p>
          <h3>{item.title}</h3>
        </div>
        <p className="room-line">{item.room || "Location not assigned"}</p>
      </div>
      <details className="card-details">
        <summary>More details</summary>
        <div className="speaker-list">{formatAuthors(item)}</div>
        <dl>
          <div>
            <dt>Duration</dt>
            <dd>{formatDuration(item)}</dd>
          </div>
          <div>
            <dt>Track</dt>
            <dd>{item.track || "TBD"}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{item.session || "TBD"}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{item.eventType || item.kind}</dd>
          </div>
        </dl>
        {item.abstract ? <p className="abstract">{truncateText(item.abstract, 360)}</p> : null}
        <p className="why-match">{item.whyMatched}</p>
        <div className="card-actions">
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            Official page
          </a>
          {item.preprintUrl ? (
            <a href={item.preprintUrl} target="_blank" rel="noreferrer">
              Preprint
            </a>
          ) : null}
          {item.doiUrl ? (
            <a href={item.doiUrl} target="_blank" rel="noreferrer">
              DOI
            </a>
          ) : null}
        </div>
      </details>
    </article>
  );
}

function applyUiFilters(items, filters) {
  return items.filter((item) => {
    if (filters.day && item.date !== filters.day) return false;
    if (filters.track && item.track !== filters.track) return false;
    if (filters.room && item.room !== filters.room) return false;
    return true;
  });
}

function activeFilterCount(filters) {
  return [filters.day, filters.track, filters.room].filter(Boolean).length;
}

function buildFilterOptions(program) {
  return {
    days: unique(program.map((item) => item.date).filter(Boolean)).map((date) => ({
      value: date,
      label: formatDayLabel(date)
    })),
    tracks: unique(program.map((item) => item.track).filter(Boolean)),
    rooms: unique(program.map((item) => item.room).filter(Boolean))
  };
}

function buildNoResultSuggestions(parsedQuery, filterOptions) {
  const suggestions = [];

  if (parsedQuery.speaker) {
    suggestions.push(parsedQuery.speaker);
  }

  if (parsedQuery.track) {
    suggestions.push(`${titleCase(parsedQuery.track)} talks`);
  }

  if (parsedQuery.eventType) {
    suggestions.push(parsedQuery.dateLabel ? `${parsedQuery.eventType} on ${parsedQuery.dateLabel}` : `${parsedQuery.eventType}s`);
  }

  if (parsedQuery.room) {
    suggestions.push(`what is in ${parsedQuery.room}`);
  }

  if (parsedQuery.dateLabel) {
    suggestions.push(`what is happening ${parsedQuery.dateLabel}`);
  }

  suggestions.push(
    "Find talks about LLMs",
    "Find talks of Singapore Management University",
    "AIware keynotes",
    filterOptions.rooms[0] ? `what is in ${filterOptions.rooms[0]}` : "what is in MB 3.210"
  );

  return unique(suggestions.filter(Boolean)).slice(0, 5);
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatAuthors(item) {
  if (item.authors?.length) {
    return (
      <ul>
        {item.authors.slice(0, 6).map((author) => (
          <li key={`${item.id}-${author.name}`}>
            <strong>{author.name}</strong>
            {author.affiliation ? <span>{author.affiliation}</span> : null}
          </li>
        ))}
        {item.authors.length > 6 ? <li>{item.authors.length - 6} more authors</li> : null}
      </ul>
    );
  }

  if (item.speakerNames?.length) {
    return <p>{item.speakerNames.join(", ")}</p>;
  }

  return <p>No speaker listed in the source data.</p>;
}

function formatDateTime(item) {
  const date = item.date ? new Date(`${item.date}T00:00:00`) : null;
  const day = date
    ? date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "Date TBD";

  if (!item.startTime) {
    return day;
  }

  return `${day}, ${item.startTime}${item.endTime ? `-${item.endTime}` : ""}`;
}

function formatDayLabel(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatDuration(item) {
  if (item.durationMinutes) {
    return `${item.durationMinutes} min`;
  }
  return item.room || "Time TBD";
}

function truncateText(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}
