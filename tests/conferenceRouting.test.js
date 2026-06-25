import assert from "node:assert/strict";
import test from "node:test";

import { conferenceDataPath, getConferenceSlug } from "../src/utils/conferenceRouting.js";

test("extracts conference slug from GitHub Pages route", () => {
  assert.equal(getConferenceSlug("/findmynexttalk/fse2026", "/findmynexttalk/"), "fse2026");
});

test("defaults to fse2026 on base route", () => {
  assert.equal(getConferenceSlug("/findmynexttalk/", "/findmynexttalk/"), "fse2026");
});

test("builds conference data path from slug", () => {
  assert.equal(conferenceDataPath("fse2026"), "data/fse2026");
});
