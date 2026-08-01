import { test } from "node:test";
import assert from "node:assert/strict";
import { typoVariants } from "../src/typosquat/variants.js";
import { findPypiImpostorTarget } from "../src/typosquat/pypi.js";
import { findNpmImpostorTarget } from "../src/typosquat/npm.js";

test("generates the typo classes attackers register", () => {
  const variants = typoVariants("lodahs");
  assert.ok(variants.includes("lodash"), "transposition");
  assert.ok(variants.includes("lodhs"), "deletion");
  assert.ok(variants.includes("loodahs"), "duplication");
  assert.ok(variants.includes("1odahs"), "homoglyph");
  assert.ok(variants.includes("lo-dahs"), "separator");
});

test("recovers a popular name from a dropped letter", () => {
  assert.ok(typoVariants("expres").includes("express"));
});

test("never offers the queried name back as a variant", () => {
  assert.ok(!typoVariants("react").includes("react"));
});

test("flags a name one edit from a popular pypi package", async () => {
  assert.equal(await findPypiImpostorTarget("beautifulsoup"), "beautifulsoup4");
});

test("clears popular packages and gibberish alike", async () => {
  assert.equal(await findPypiImpostorTarget("requests"), null);
  assert.equal(await findPypiImpostorTarget("abfkshe"), null);
});

test("never probes the network for a package that is already huge", async () => {
  assert.equal(await findNpmImpostorTarget("express", 500_000_000), null);
});

test("ignores scoped npm names", async () => {
  assert.equal(await findNpmImpostorTarget("@scope/pkg", 10), null);
});
