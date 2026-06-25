import { normalizeText } from "./queryParser.js";

export function expandQueryWithSynonyms(query, synonyms = {}) {
  const normalized = normalizeText(query);
  const additions = new Set();

  for (const [term, aliases] of Object.entries(synonyms)) {
    const normalizedTerm = normalizeText(term);
    if (containsTerm(normalized, normalizedTerm)) {
      for (const alias of aliases) {
        additions.add(alias);
      }
    }
  }

  return [query, ...additions].join(" ").trim();
}

function containsTerm(haystack, needle) {
  if (!needle) {
    return false;
  }

  return new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(haystack);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
