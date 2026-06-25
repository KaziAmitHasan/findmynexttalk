export function buildLiveSchedule(program, options = {}) {
  if (!Array.isArray(program) || !program.length) {
    return {
      status: "empty",
      current: currentConferenceDateTime(options.now || new Date(), options.timeZone || "America/Toronto"),
      ongoing: [],
      upcoming: []
    };
  }

  const dates = (options.conferenceDates?.length ? options.conferenceDates : unique(program.map((item) => item.date).filter(Boolean))).sort();
  const current = currentConferenceDateTime(options.now || new Date(), options.timeZone || "America/Toronto");
  const sorted = [...program].sort(compareSchedule);

  if (!dates.length) {
    return { status: "empty", current, ongoing: [], upcoming: sorted };
  }

  if (current.date < dates[0]) {
    return {
      status: "before",
      current,
      ongoing: [],
      upcoming: sorted
    };
  }

  if (current.date > dates[dates.length - 1]) {
    return {
      status: "after",
      current,
      ongoing: [],
      upcoming: []
    };
  }

  const ongoing = sorted.filter((item) => isOngoing(item, current));
  const upcoming = sorted.filter((item) => isUpcoming(item, current));

  return {
    status: "during",
    current,
    ongoing,
    upcoming
  };
}

function isOngoing(item, current) {
  if (item.date !== current.date || !item.startTime) {
    return false;
  }

  return item.startTime <= current.time && (item.endTime || item.startTime) > current.time;
}

function isUpcoming(item, current) {
  if (!item.date || !item.startTime) {
    return false;
  }

  return item.date > current.date || (item.date === current.date && item.startTime > current.time);
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

function compareSchedule(a, b) {
  return (
    (a.date || "").localeCompare(b.date || "") ||
    (a.startTime || "").localeCompare(b.startTime || "") ||
    (a.endTime || "").localeCompare(b.endTime || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function unique(values) {
  return [...new Set(values)];
}
