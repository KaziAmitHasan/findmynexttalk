export const DEFAULT_CONFERENCE_SLUG = "fse2026";

export function getConferenceSlug(pathname, basePath = "/findmynexttalk/") {
  const normalizedBase = normalizePath(basePath);
  const normalizedPath = normalizePath(pathname);
  const relativePath = normalizedPath.startsWith(normalizedBase)
    ? normalizedPath.slice(normalizedBase.length)
    : normalizedPath.replace(/^\/+/, "");
  const slug = relativePath.split("/").filter(Boolean)[0];

  return slug || "";
}

export function conferenceDataPath(slug) {
  return `data/${slug || DEFAULT_CONFERENCE_SLUG}`;
}

export function conferenceRoute(slug, basePath = "/findmynexttalk/") {
  const normalizedBase = normalizePath(basePath);
  return `${normalizedBase}${slug}`;
}

function normalizePath(value) {
  const path = String(value || "/");
  return path.endsWith("/") ? path : `${path}/`;
}
