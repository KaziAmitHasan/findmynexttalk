const DATE_BY_WEEKDAY = {
  sunday: "2026-07-05",
  sun: "2026-07-05",
  monday: "2026-07-06",
  mon: "2026-07-06",
  tuesday: "2026-07-07",
  tue: "2026-07-07",
  wednesday: "2026-07-08",
  wed: "2026-07-08",
  thursday: "2026-07-09",
  thu: "2026-07-09"
};

const CONFERENCE_DATES = ["2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09"];
const CONFERENCE_TIMEZONE = "America/Toronto";

const TRACK_ALIASES = [
  ["doctoral symposium", "doctoral symposium"],
  ["aiware main track", "aiware main track"],
  ["aiware keynotes", "aiware keynotes"],
  ["aiware arxiv", "aiware arxiv track"],
  ["aiware benchmark", "aiware benchmark dataset track"],
  ["benchmark dataset", "aiware benchmark dataset track"],
  ["research papers", "research papers"],
  ["research paper", "research papers"],
  ["journal first", "journal first paper"],
  ["journal-first", "journal first paper"],
  ["tool demonstrations", "tool demonstrations"],
  ["tool demonstration", "tool demonstrations"],
  ["tools", "tool demonstrations"],
  ["industry papers", "industry papers"],
  ["industry", "industry papers"],
  ["ideas visions and reflections", "ideas visions and reflections"],
  ["ivr", "ideas visions and reflections"],
  ["student research competition", "student research competition"],
  ["src", "student research competition"],
  ["software engineering education", "software engineering education"],
  ["education", "software engineering education"],
  ["promise", "promise"],
  ["plenary", "plenary events"]
];

const EVENT_TYPE_ALIASES = [
  ["keynotes", "keynote"],
  ["keynote", "keynote"],
  ["lunch", "lunch"],
  ["coffee break", "coffee break"],
  ["break", "coffee break"],
  ["q a", "live q a"],
  ["qa", "live q a"],
  ["live q a", "live q a"],
  ["awards", "awards"],
  ["award", "awards"],
  ["opening", "day opening"],
  ["closing", "day closing"]
];

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "and",
  "am",
  "are",
  "around",
  "at",
  "attend",
  "by",
  "can",
  "could",
  "find",
  "for",
  "from",
  "happening",
  "in",
  "is",
  "apr",
  "april",
  "aug",
  "august",
  "dec",
  "december",
  "feb",
  "february",
  "jan",
  "january",
  "jul",
  "july",
  "jun",
  "june",
  "keynote",
  "keynotes",
  "mar",
  "march",
  "may",
  "me",
  "morning",
  "near",
  "next",
  "now",
  "nov",
  "november",
  "on",
  "of",
  "oct",
  "october",
  "paper",
  "papers",
  "pm",
  "presenting",
  "presentation",
  "presentations",
  "related",
  "schedule",
  "sep",
  "sept",
  "september",
  "show",
  "currently",
  "current",
  "talking",
  "talk",
  "talks",
  "the",
  "to",
  "what",
  "when",
  "where",
  "right"
]);

export function parseQuery(query, options = {}) {
  const original = String(query ?? "").trim();
  const normalized = normalizeText(original);
  const conferenceDates = options.conferenceDates || CONFERENCE_DATES;
  const dateByWeekday = options.dateByWeekday || buildDateByWeekday(conferenceDates);
  const relativeTimePoint = detectRelativeTimePoint(normalized, { ...options, conferenceDates });
  const clockTimePoint = relativeTimePoint ? null : detectClockTimePoint(original);
  const timePoint = relativeTimePoint || clockTimePoint;
  const detectedDate = detectDate(normalized, dateByWeekday, conferenceDates);
  const date = detectedDate || timePoint?.date || "";
  const timeBand = detectTimeBand(normalized);
  const room = detectRoom(original);
  const speaker = detectSpeaker(original);
  const track = detectTrack(normalized);
  const eventType = detectEventType(normalized);
  const detected = { date, timeBand, timePoint, room, speaker, track, eventType };
  const topicTerms = extractTopicTerms(normalized, detected);

  return {
    original,
    normalized,
    cleanedQuery: topicTerms.join(" "),
    date,
    dateLabel: date ? labelDate(date) : "",
    hasExplicitDate: Boolean(detectedDate),
    timeBand,
    timePoint,
    room,
    speaker,
    track,
    eventType,
    topicTerms
  };
}

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/([a-z0-9])['’]([a-z0-9])/g, "$1$2")
    .replace(/[^\w\s./:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectDate(normalizedQuery, dateByWeekday = DATE_BY_WEEKDAY, conferenceDates = CONFERENCE_DATES) {
  for (const [token, date] of Object.entries(dateByWeekday)) {
    if (new RegExp(`\\b${escapeRegExp(token)}\\b`).test(normalizedQuery)) {
      return date;
    }
  }

  for (const [token, date] of Object.entries(buildCalendarDateAliases(conferenceDates))) {
    if (new RegExp(`\\b${escapeRegExp(token)}\\b`).test(normalizedQuery)) {
      return date;
    }
  }

  return "";
}

export function detectTimeBand(normalizedQuery) {
  if (/\b(after lunch|afternoon|post lunch)\b/.test(normalizedQuery)) {
    return { key: "afternoon", label: "afternoon", start: "12:00", end: "17:00" };
  }

  if (/\b(morning|before lunch)\b/.test(normalizedQuery)) {
    return { key: "morning", label: "morning", start: "00:00", end: "12:00" };
  }

  if (/\b(evening|night)\b/.test(normalizedQuery)) {
    return { key: "evening", label: "evening", start: "17:00", end: "23:59" };
  }

  return null;
}

export function detectClockTimePoint(query) {
  const value = String(query ?? "");
  const meridiemMatch = value.match(/\b(?:at|around|near|by)?\s*(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm)\b/i);

  if (meridiemMatch) {
    const hour = Number(meridiemMatch[1]);
    const minute = Number(meridiemMatch[2] || "0");
    const meridiem = meridiemMatch[3].toLowerCase();
    return {
      key: "at",
      mode: "overlap",
      time: formatTime(meridiem === "pm" && hour !== 12 ? hour + 12 : meridiem === "am" && hour === 12 ? 0 : hour, minute),
      label: `at ${formatDisplayTime(meridiem === "pm" && hour !== 12 ? hour + 12 : meridiem === "am" && hour === 12 ? 0 : hour, minute)}`
    };
  }

  const twentyFourHourMatch = value.match(/\b(?:at|around|near|by)?\s*([01]?[0-9]|2[0-3]):([0-5][0-9])\b/i);

  if (twentyFourHourMatch) {
    const hour = Number(twentyFourHourMatch[1]);
    const minute = Number(twentyFourHourMatch[2]);
    return {
      key: "at",
      mode: "overlap",
      time: formatTime(hour, minute),
      label: `at ${formatDisplayTime(hour, minute)}`
    };
  }

  return null;
}

export function detectRelativeTimePoint(normalizedQuery, options = {}) {
  const asksNow = /\b(now|right now|currently|current)\b/.test(normalizedQuery);
  const asksNext = /\b(next|up next)\b/.test(normalizedQuery);

  if (!asksNow && !asksNext) {
    return null;
  }

  const current = currentConferenceDateTime(options.now || new Date(), options.timeZone || CONFERENCE_TIMEZONE);
  const conferenceDates = options.conferenceDates || CONFERENCE_DATES;

  if (asksNext && current.date < conferenceDates[0]) {
    return {
      key: "next",
      mode: "next",
      date: conferenceDates[0],
      time: "00:00",
      label: "next scheduled item"
    };
  }

  if (!conferenceDates.includes(current.date)) {
    return {
      key: asksNext ? "next" : "now",
      mode: asksNext ? "next" : "overlap",
      date: current.date,
      time: current.time,
      label: asksNext ? "next scheduled item" : "now",
      outOfConferenceRange: true
    };
  }

  return {
    key: asksNext ? "next" : "now",
    mode: asksNext ? "next" : "overlap",
    date: current.date,
    time: current.time,
    label: asksNext ? `next after ${current.time}` : `now (${current.time})`
  };
}

export function detectRoom(query) {
  const value = String(query ?? "");
  const mbMatch = value.match(/\b(MB)\s*([0-9](?:\.[0-9]{1,4}|[A-Z])?)\b/i);

  if (mbMatch) {
    return `${mbMatch[1].toUpperCase()} ${mbMatch[2].toUpperCase()}`;
  }

  const hallMatch = value.match(/\b(H[0-9]{2,4})\b/i);
  return hallMatch ? hallMatch[1].toUpperCase() : "";
}

export function detectSpeaker(query) {
  const value = String(query ?? "").trim();
  const byMatch = value.match(/\b(?:talks?|papers?|presentations?|sessions?)\s+(?:by|from|of)\s+([A-Za-z][A-Za-z .'\-’]{1,80})/i);
  const directByMatch = value.match(/\b(?:by|from)\s+([A-Za-z][A-Za-z .'\-’]{1,80})/i);
  const presentingMatch = value.match(/\b(?:when is|when does|is)\s+([A-Za-z][A-Za-z .'\-’]{1,80}?)\s+(?:presenting|speaking|talking)\b/i);

  const rawSpeaker = byMatch?.[1] || directByMatch?.[1] || presentingMatch?.[1] || "";
  return cleanSpeakerCandidate(rawSpeaker);
}

function cleanSpeakerCandidate(value) {
  return String(value ?? "")
    .replace(/\s+\bon\b.*$/i, "")
    .replace(/\s+\b(?:at|around|near)\s+(?:[0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?|[0-9]{1,2}:[0-9]{2})\b.*$/i, "")
    .replace(/\s+\b(?:after|before)\s+(?:lunch|noon|morning|afternoon|evening)\b.*$/i, "")
    .replace(/\s+\b(?:on|at|around|near|after|before)$/i, "")
    .replace(/[?.,!]+$/g, "")
    .trim();
}

export function detectTrack(normalizedQuery) {
  const match = TRACK_ALIASES.find(([alias]) => normalizedQuery.includes(alias));
  return match?.[1] || "";
}

export function detectEventType(normalizedQuery) {
  const match = EVENT_TYPE_ALIASES.find(([alias]) => new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(normalizedQuery));
  return match?.[1] || "";
}

export function extractTopicTerms(normalizedQuery, detected = {}) {
  let text = normalizedQuery;

  for (const value of [detected.room, detected.speaker, detected.track, detected.eventType, detected.timePoint?.time]) {
    if (value) {
      text = text.replace(normalizeText(value), " ");
    }
  }

  return text
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term) && !DATE_BY_WEEKDAY[term])
    .filter((term) => !/^[0-9]{1,2}(st|nd|rd|th)$/.test(term))
    .filter((term) => !/^[0-9:.]+$/.test(term));
}

export function buildDateByWeekday(conferenceDates = CONFERENCE_DATES) {
  const dateByWeekday = {};

  for (const date of conferenceDates) {
    const parsed = new Date(`${date}T00:00:00`);
    const long = parsed.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
    const short = parsed.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toLowerCase();
    dateByWeekday[long] = date;
    dateByWeekday[short] = date;
  }

  return dateByWeekday;
}

function labelDate(date) {
  const labels = {
    "2026-07-05": "Sunday, July 5",
    "2026-07-06": "Monday, July 6",
    "2026-07-07": "Tuesday, July 7",
    "2026-07-08": "Wednesday, July 8",
    "2026-07-09": "Thursday, July 9"
  };

  return labels[date] || date;
}

function buildCalendarDateAliases(conferenceDates = CONFERENCE_DATES) {
  const aliases = {};

  for (const date of conferenceDates) {
    const parsed = new Date(`${date}T00:00:00Z`);
    const month = parsed.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }).toLowerCase();
    const shortMonth = parsed.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toLowerCase();
    const day = parsed.getUTCDate();
    const ordinal = ordinalDay(day);

    aliases[`${month} ${day}`] = date;
    aliases[`${month} ${ordinal}`] = date;
    aliases[`${shortMonth} ${day}`] = date;
    aliases[`${shortMonth} ${ordinal}`] = date;
    aliases[`${day} ${month}`] = date;
    aliases[`${ordinal} ${month}`] = date;
    aliases[`${day} ${shortMonth}`] = date;
    aliases[`${ordinal} ${shortMonth}`] = date;
  }

  return aliases;
}

function ordinalDay(day) {
  if (day % 100 >= 11 && day % 100 <= 13) {
    return `${day}th`;
  }

  const suffix = { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
  return `${day}${suffix}`;
}

function currentConferenceDateTime(now, timeZone) {
  const date = now instanceof Date ? now : new Date(now);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`
  };
}

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDisplayTime(hour, minute) {
  return formatTime(hour, minute);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
