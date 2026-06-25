import { extractTopicTerms, normalizeText } from "./queryParser.js";
import MiniSearch from "minisearch";

export function searchProgram(program, expandedQuery, parsedQuery) {
  if (!Array.isArray(program) || program.length === 0) {
    return [];
  }

  const index = buildSearchIndex(program);
  const initialTerms = buildSearchTerms(expandedQuery, parsedQuery);
  const effectiveParsedQuery = inferPeopleOrAffiliationIntent(program, parsedQuery, initialTerms);
  const terms =
    (effectiveParsedQuery.speaker && !parsedQuery.speaker) || effectiveParsedQuery.affiliation
      ? []
      : initialTerms;
  const phrase = terms.join(" ");

  const indexedResults = terms.length
    ? index.search(phrase, {
        boost: {
          title: 5,
          keywordsText: 5,
          abstract: 3,
          speakerNamesText: 2,
          authorsText: 2,
          track: 1.5,
          session: 1.5,
          room: 1
        },
        fuzzy: 0.2,
        prefix: true
      })
    : [];

  const hasStructuredFilter = Boolean(
      effectiveParsedQuery.date ||
      effectiveParsedQuery.timeBand ||
      effectiveParsedQuery.timePoint ||
      effectiveParsedQuery.room ||
      effectiveParsedQuery.speaker ||
      effectiveParsedQuery.affiliation ||
      effectiveParsedQuery.track ||
      effectiveParsedQuery.eventType
  );
  const candidateIds = hasStructuredFilter || !terms.length
    ? new Set(program.map((item) => item.id))
    : indexedResults.length
      ? new Set(indexedResults.map((result) => result.id))
      : new Set();

  return program
    .filter((item) => candidateIds.has(item.id))
    .filter((item) => matchesStructuredFilters(item, effectiveParsedQuery))
    .map((item) => {
      const scored = scoreItem(item, terms, phrase, effectiveParsedQuery);
      return {
        ...item,
        _score: scored.score,
        _hasTopicMatch: scored.hasTopicMatch,
        whyMatched: explainMatch(scored.reasons)
      };
    })
    .filter((item) => item._score > 0 || hasStructuredFilter)
    .filter((item) => !terms.length || item._hasTopicMatch)
    .sort((a, b) => b._score - a._score || compareSchedule(a, b))
    .slice(0, 12);
}

export function buildSearchIndex(program) {
  const documents = program.map((item) => ({
    ...item,
    keywordsText: (item.keywords || []).join(" "),
    speakerNamesText: (item.speakerNames || []).join(" "),
    authorsText: (item.authors || []).map((author) => author.name).join(" "),
    affiliationsText: (item.authors || []).map((author) => author.affiliation).join(" ")
  }));

  const index = new MiniSearch({
    fields: [
      "title",
      "abstract",
      "keywordsText",
      "speakerNamesText",
      "authorsText",
      "affiliationsText",
      "track",
      "session",
      "eventType",
      "room",
      "searchText"
    ],
    storeFields: [
      "id",
      "title",
      "abstract",
      "keywordsText",
      "speakerNamesText",
      "authorsText",
      "affiliationsText",
      "track",
      "session",
      "eventType",
      "room",
      "date",
      "startTime",
      "endTime",
      "sourceUrl"
    ],
    searchOptions: {
      fuzzy: 0.2,
      prefix: true
    }
  });

  index.addAll(documents);
  return index;
}

function buildSearchTerms(expandedQuery, parsedQuery) {
  const rawTerms = Array.isArray(parsedQuery.topicTerms)
    ? [
        ...parsedQuery.topicTerms,
        ...extractTopicTerms(normalizeText(expandedQuery), parsedQuery)
      ]
    : normalizeText(expandedQuery)
        .split(/\s+/)
        .filter((term) => term.length > 1);

  return [...new Set(rawTerms.map(normalizeText).filter(Boolean))];
}

function inferPeopleOrAffiliationIntent(program, parsedQuery, terms) {
  if (
    parsedQuery.speaker ||
    parsedQuery.room ||
    parsedQuery.date ||
    parsedQuery.timeBand ||
    parsedQuery.timePoint ||
    parsedQuery.track ||
    parsedQuery.eventType
  ) {
    if (parsedQuery.speaker && !program.some((item) => personNameMatches(item, parsedQuery.speaker))) {
      if (program.some((item) => affiliationMatches(item, parsedQuery.speaker))) {
        return {
          ...parsedQuery,
          speaker: "",
          affiliation: parsedQuery.speaker,
          topicTerms: []
        };
      }
    }

    return parsedQuery;
  }

  if (terms.length < 2 || terms.length > 4) {
    return parsedQuery;
  }

  const candidateName = terms.join(" ");
  const matchingAuthorItems = program.filter((item) => personNameMatches(item, candidateName));

  if (!matchingAuthorItems.length) {
    if (program.some((item) => affiliationMatches(item, candidateName))) {
      return {
        ...parsedQuery,
        affiliation: candidateName,
        topicTerms: []
      };
    }

    return parsedQuery;
  }

  return {
    ...parsedQuery,
    speaker: candidateName,
    topicTerms: []
  };
}

function scoreItem(item, terms, phrase, parsedQuery) {
  let score = 0;
  let topicScore = 0;
  const reasons = [];
  const text = normalizeText(item.searchText || "");
  const title = normalizeText(item.title || "");
  const abstract = normalizeText(item.abstract || "");
  const keywords = normalizeText((item.keywords || []).join(" "));
  const speakers = normalizeText([...(item.speakerNames || []), ...(item.authors || []).map((author) => author.name)].join(" "));
  const room = normalizeText(item.room || "");
  const track = normalizeText(item.track || "");
  const session = normalizeText(item.session || "");
  const eventType = normalizeText(item.eventType || "");

  if (phrase && title.includes(phrase)) {
    score += 100;
    topicScore += 100;
    reasons.push(`title contains "${phrase}"`);
  }

  if (phrase && keywords.includes(phrase)) {
    score += 60;
    topicScore += 60;
    reasons.push(`keywords contain "${phrase}"`);
  }

  for (const term of terms) {
    if (title.includes(term)) {
      score += 30;
      topicScore += 30;
      reasons.push(`title contains "${term}"`);
    }
    if (keywords.includes(term)) {
      score += 25;
      topicScore += 25;
      reasons.push(`keyword contains "${term}"`);
    }
    if (speakers.includes(term)) {
      score += 20;
      topicScore += 20;
      reasons.push(`speaker contains "${term}"`);
    }
    if (abstract.includes(term)) {
      score += 10;
      topicScore += 10;
      reasons.push(`abstract contains "${term}"`);
    }
    if (track.includes(term)) {
      score += 8;
      topicScore += 8;
      reasons.push(`track contains "${term}"`);
    }
    if (session.includes(term)) {
      score += 8;
      topicScore += 8;
      reasons.push(`session contains "${term}"`);
    }
    if (eventType.includes(term)) {
      score += 8;
      topicScore += 8;
      reasons.push(`type contains "${term}"`);
    }
    if (room.includes(term)) {
      score += 6;
      topicScore += 6;
      reasons.push(`room contains "${term}"`);
    }
    if (text.includes(term) && !title.includes(term) && !keywords.includes(term) && !abstract.includes(term)) {
      score += 2;
      topicScore += 2;
      reasons.push(`program text contains "${term}"`);
    }
  }

  if (parsedQuery.date && item.date === parsedQuery.date) {
    score += 50;
    reasons.push(`date is ${parsedQuery.dateLabel}`);
  }

  if (parsedQuery.timeBand && isWithinBand(item.startTime, parsedQuery.timeBand)) {
    score += 35;
    reasons.push(`time is ${parsedQuery.timeBand.label}`);
  }

  if (parsedQuery.timePoint && matchesTimePoint(item, parsedQuery.timePoint)) {
    score += parsedQuery.timePoint.mode === "next" ? 45 : 55;
    reasons.push(timePointReason(parsedQuery.timePoint));
  }

  if (parsedQuery.room && normalizeText(parsedQuery.room) === room) {
    score += 80;
    reasons.push(`room is ${parsedQuery.room}`);
  }

  if (parsedQuery.speaker && personNameMatches(item, parsedQuery.speaker)) {
    score += 100;
    reasons.push(`speaker is ${parsedQuery.speaker}`);
  }

  if (parsedQuery.affiliation && affiliationMatches(item, parsedQuery.affiliation)) {
    score += 90;
    reasons.push(`affiliation is ${parsedQuery.affiliation}`);
  }

  if (parsedQuery.track && track.includes(parsedQuery.track)) {
    score += 60;
    reasons.push(`track is ${parsedQuery.track}`);
  }

  if (parsedQuery.eventType && eventTypeMatches(item, parsedQuery.eventType)) {
    score += 70;
    reasons.push(`type is ${parsedQuery.eventType}`);
  }

  return { score, hasTopicMatch: topicScore > 0, reasons: uniqueReasons(reasons) };
}

function matchesStructuredFilters(item, parsedQuery) {
  const room = normalizeText(item.room || "");
  const track = normalizeText(item.track || "");

  if (parsedQuery.speaker && !personNameMatches(item, parsedQuery.speaker)) {
    return false;
  }

  if (parsedQuery.affiliation && !affiliationMatches(item, parsedQuery.affiliation)) {
    return false;
  }

  if (parsedQuery.room && normalizeText(parsedQuery.room) !== room) {
    return false;
  }

  if (parsedQuery.date && item.date !== parsedQuery.date) {
    return false;
  }

  if (parsedQuery.timeBand && !isWithinBand(item.startTime, parsedQuery.timeBand)) {
    return false;
  }

  if (parsedQuery.timePoint && !matchesTimePoint(item, parsedQuery.timePoint)) {
    return false;
  }

  if (parsedQuery.track && !track.includes(parsedQuery.track)) {
    return false;
  }

  if (parsedQuery.eventType && !eventTypeMatches(item, parsedQuery.eventType)) {
    return false;
  }

  return true;
}

function explainMatch(reasons) {
  return reasons.length ? `Why matched: ${reasons.slice(0, 3).join("; ")}.` : "Why matched: schedule filter.";
}

function isWithinBand(startTime, band) {
  if (!startTime) {
    return false;
  }

  return startTime >= band.start && startTime < band.end;
}

function matchesTimePoint(item, timePoint) {
  if (timePoint.outOfConferenceRange) {
    return false;
  }

  if (!timePoint.time || !item.startTime) {
    return false;
  }

  if (timePoint.mode === "next") {
    return item.startTime >= timePoint.time;
  }

  return item.startTime <= timePoint.time && (item.endTime || item.startTime) > timePoint.time;
}

function timePointReason(timePoint) {
  if (timePoint.mode === "next") {
    return `starts after ${timePoint.time}`;
  }

  return `time overlaps ${timePoint.time}`;
}

function personNameMatches(item, queryName) {
  const queryTokens = nameTokens(queryName);
  if (!queryTokens.length) {
    return false;
  }

  const names = [
    ...(item.speakerNames || []),
    ...(item.authors || []).map((author) => author.name)
  ];

  return names.some((name) => {
    const candidateTokens = nameTokens(name);
    return queryTokens.every((queryToken) =>
      candidateTokens.some((candidateToken) => tokenMatchesName(queryToken, candidateToken))
    );
  });
}

function affiliationMatches(item, queryAffiliation) {
  const query = normalizeText(queryAffiliation);
  if (!query) {
    return false;
  }

  const affiliations = (item.authors || [])
    .map((author) => normalizeText(author.affiliation || ""))
    .filter(Boolean);

  return affiliations.some((affiliation) => affiliation.includes(query));
}

function eventTypeMatches(item, queryEventType) {
  return normalizeText(item.eventType || "") === normalizeText(queryEventType);
}

function nameTokens(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length > 1);
}

function tokenMatchesName(queryToken, candidateToken) {
  if (queryToken === candidateToken) {
    return true;
  }

  if (queryToken.length >= 3 && candidateToken.length >= 3) {
    return queryToken.startsWith(candidateToken) || candidateToken.startsWith(queryToken);
  }

  return levenshteinDistance(queryToken, candidateToken) <= 1;
}

function levenshteinDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function uniqueReasons(reasons) {
  return [...new Set(reasons)];
}

function compareSchedule(a, b) {
  return (
    (a.date || "").localeCompare(b.date || "") ||
    (a.startTime || "").localeCompare(b.startTime || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}
