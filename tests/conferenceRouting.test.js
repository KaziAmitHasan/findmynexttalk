import assert from "node:assert/strict";
import test from "node:test";

import { conferenceDataPath, conferenceRoute, getConferenceSlug } from "../src/utils/conferenceRouting.js";

test("extracts conference slug from GitHub Pages route", () => {
  assert.equal(getConferenceSlug("/findmynexttalk/fse2026", "/findmynexttalk/"), "fse2026");
});

test("returns no conference slug on base route", () => {
  assert.equal(getConferenceSlug("/findmynexttalk/", "/findmynexttalk/"), "");
});

test("returns no conference slug on base route without trailing slash", () => {
  assert.equal(getConferenceSlug("/findmynexttalk", "/findmynexttalk/"), "");
});

test("builds conference data path from slug", () => {
  assert.equal(conferenceDataPath("fse2026"), "data/fse2026");
});

test("builds conference route from slug", () => {
  assert.equal(conferenceRoute("fse2026", "/findmynexttalk/"), "/findmynexttalk/fse2026");
});
