import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { allManifestPaths } from "../src/manifest/index.js";
import { parsePackageJson } from "../src/manifest/packageJson.js";
import { parseRequirements } from "../src/manifest/requirements.js";
import { parsePyproject } from "../src/manifest/pyproject.js";
import { fingerprint } from "../src/cache.js";

test("collects every dependency section of a package.json", () => {
  const content = JSON.stringify({
    name: "demo",
    dependencies: { express: "^4.0.0", "@scope/pkg": "1.0.0" },
    devDependencies: { typescript: "^5.0.0" },
    scripts: { build: "tsc" },
  });
  assert.deepEqual(parsePackageJson(content), ["express", "@scope/pkg", "typescript"]);
});

test("survives a package.json with no dependencies", () => {
  assert.deepEqual(parsePackageJson('{"name":"demo"}'), []);
});

test("strips versions, comments, flags and blank lines from requirements.txt", () => {
  const content = [
    "# project deps",
    "requests==2.31.0",
    "uvicorn[standard]>=0.20  # server",
    "",
    "-r other.txt",
    "--index-url https://example.com/simple",
    "./local-package",
    "django ; python_version >= '3.9'",
  ].join("\n");
  assert.deepEqual(parseRequirements(content), ["requests", "uvicorn", "django"]);
});

test("reads pep 621 and poetry dependency tables", () => {
  const content = `
[project]
name = "demo"
dependencies = [
  "httpx>=0.27",
  "pydantic==2.*",
]

[project.optional-dependencies]
dev = ["pytest", "ruff"]

[tool.poetry.dependencies]
python = "^3.11"
flask = "^3.0"
`;
  assert.deepEqual(parsePyproject(content), ["httpx", "pydantic", "pytest", "ruff", "flask"]);
});

test("fingerprints a dependency set regardless of ordering", () => {
  assert.equal(fingerprint(["a", "b"]), fingerprint(["b", "a"]));
  assert.notEqual(fingerprint(["a", "b"]), fingerprint(["a", "c"]));
});

test("scan picks up every requirements file, not just the plain one", () => {
  const dir = mkdtempSync(join(tmpdir(), "slopguard-"));
  for (const name of ["requirements-dev.txt", "requirements.txt", "pyproject.toml", "package.json", "README.md"]) {
    writeFileSync(join(dir, name), "");
  }

  const found = allManifestPaths(dir).map((path) => basename(path));
  assert.deepEqual(found, ["package.json", "pyproject.toml", "requirements-dev.txt", "requirements.txt"]);

  rmSync(dir, { recursive: true, force: true });
});

test("an unreadable directory yields no manifests instead of throwing", () => {
  assert.deepEqual(allManifestPaths(join(tmpdir(), "slopguard-does-not-exist")), []);
});
