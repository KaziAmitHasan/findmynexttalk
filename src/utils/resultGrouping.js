export function isScheduleLikeQuery(parsedQuery) {
  if (!parsedQuery) {
    return false;
  }

  const hasTopicTerms = Array.isArray(parsedQuery.topicTerms) && parsedQuery.topicTerms.length > 0;
  const hasScheduleIntent = Boolean(
    parsedQuery.date ||
      parsedQuery.timeBand ||
      parsedQuery.timePoint ||
      parsedQuery.room ||
      parsedQuery.track ||
      parsedQuery.eventType
  );

  return hasScheduleIntent && !parsedQuery.speaker && !hasTopicTerms;
}

export function groupResultsByTime(items) {
  const groups = new Map();

  for (const item of sortBySchedule(items)) {
    const key = [item.date || "", item.startTime || "", item.endTime || ""].join("|");

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: formatGroupLabel(item),
        items: []
      });
    }

    groups.get(key).items.push(item);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    items: group.items.sort(compareWithinTimeGroup)
  }));
}

function sortBySchedule(items) {
  return [...items].sort(
    (a, b) =>
      (a.date || "").localeCompare(b.date || "") ||
      (a.startTime || "").localeCompare(b.startTime || "") ||
      (a.endTime || "").localeCompare(b.endTime || "") ||
      compareWithinTimeGroup(a, b)
  );
}

function compareWithinTimeGroup(a, b) {
  return (
    (a.room || "").localeCompare(b.room || "") ||
    (a.track || "").localeCompare(b.track || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function formatGroupLabel(item) {
  const day = item.date ? formatDayLabel(item.date) : "Date TBD";
  const time = item.startTime ? `${item.startTime}${item.endTime ? `-${item.endTime}` : ""}` : "Time TBD";

  return `${day}, ${time}`;
}

function formatDayLabel(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}
