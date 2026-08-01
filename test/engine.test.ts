import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPackage, type EngineDeps } from "../src/engine.js";
import type { PackageInfo } from "../src/types.js";

function deps(info: PackageInfo, known: boolean, impostorTarget: string | null = null): EngineDeps {
  return {
    lookup: async () => info,
    inCorpus: () => known,
    suggest: async () => [],
    findImpostorTarget: async () => impostorTarget,
  };
}

test("blocks a slopsquat: known hallucination registered days ago", async () => {
  const info: PackageInfo = {
    name: "securehashlib",
    exists: true,
    ageDays: 4,
    monthlyDownloads: 11,
    hasSourceRepo: false,
  };
  const result = await checkPackage("pip", "securehashlib", deps(info, true));
  assert.equal(result.level, "block");
});

test("allows an established package", async () => {
  const info: PackageInfo = {
    name: "requests",
    exists: true,
    ageDays: 5000,
    monthlyDownloads: 900_000_000,
    hasSourceRepo: true,
  };
  const result = await checkPackage("pip", "requests", deps(info, false));
  assert.equal(result.level, "allow");
});

test("blocks a typosquat that is old and modestly downloaded", async () => {
  const info: PackageInfo = {
    name: "lodahs",
    exists: true,
    ageDays: 2400,
    monthlyDownloads: 239,
    hasSourceRepo: true,
  };
  const result = await checkPackage("npm", "lodahs", deps(info, false, "lodash"));
  assert.equal(result.level, "block");
  assert.deepEqual(result.alternatives, ["lodash"]);
});

test("warns when the package does not exist", async () => {
  const info: PackageInfo = {
    name: "totallyfakepkg",
    exists: false,
    ageDays: null,
    monthlyDownloads: null,
    hasSourceRepo: false,
  };
  const result = await checkPackage("npm", "totallyfakepkg", deps(info, false));
  assert.equal(result.level, "warn");
});
