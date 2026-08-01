import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveEcosystem, SHIMMED_MANAGERS } from "../src/ecosystems.js";

test("maps every manager spelling to its registry", () => {
  for (const name of ["pip", "pip3", "pypi", "python", "python3", "uv", "uvx", "PIP"]) {
    assert.equal(resolveEcosystem(name), "pip");
  }
  for (const name of ["npm", "yarn", "pnpm", "bun"]) {
    assert.equal(resolveEcosystem(name), "npm");
  }
});

test("every shimmed manager can also be checked by hand", () => {
  for (const manager of SHIMMED_MANAGERS) {
    assert.notEqual(resolveEcosystem(manager), null, `slopguard ${manager} <package> must work`);
  }
});

test("a name borrowed from Object.prototype is not an ecosystem", () => {
  for (const name of ["constructor", "hasOwnProperty", "toString", "__proto__", "valueOf"]) {
    assert.equal(resolveEcosystem(name), null, `${name} must not resolve to an ecosystem`);
  }
});
