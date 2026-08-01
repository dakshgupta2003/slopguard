import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_SIMILARITY, rankBySimilarity, similarity } from "../src/suggest/similarity.js";

const POPULAR = ["requests", "httpx", "flask", "django", "numpy", "beautifulsoup4"];
const MIN_SCORE = MIN_SIMILARITY;

test("ignores separator style when comparing names", () => {
  assert.equal(similarity("fast-json-parse", "fastjsonparse"), 1);
});

test("suggests the real package for a near-miss name", () => {
  assert.deepEqual(rankBySimilarity("requestlib", POPULAR, MIN_SCORE, 3), ["requests"]);
});

test("treats a swapped pair of letters as a single edit", () => {
  assert.deepEqual(rankBySimilarity("djnago", POPULAR, MIN_SCORE, 3), ["django"]);
});

test("suggests nothing for gibberish", () => {
  assert.deepEqual(rankBySimilarity("abfkshe", POPULAR, MIN_SCORE, 3), []);
});

test("never suggests the queried name itself", () => {
  assert.equal(rankBySimilarity("flask", POPULAR, MIN_SCORE, 3).includes("flask"), false);
});
