import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseInstall } from "../src/shim/parse.js";

function packages(manager: string, args: string[]): string[] {
  const command = parseInstall(manager, args);
  return command?.kind === "packages" ? command.packages : [];
}

test("finds the package behind every uv install verb", () => {
  assert.deepEqual(packages("uv", ["pip", "install", "requests"]), ["requests"]);
  assert.deepEqual(packages("uv", ["add", "requests"]), ["requests"]);
  assert.deepEqual(packages("uv", ["tool", "install", "ruff"]), ["ruff"]);
  assert.deepEqual(packages("uv", ["pip", "install", "requests==2.31.0", "flask"]), ["requests", "flask"]);
});

test("catches packages that are installed only to run once", () => {
  assert.deepEqual(packages("uvx", ["ruff", "check", "."]), ["ruff"]);
  assert.deepEqual(packages("uvx", ["--from", "httpx", "python"]), ["httpx"]);
  assert.deepEqual(packages("uv", ["tool", "run", "ruff"]), ["ruff"]);
  assert.deepEqual(packages("uv", ["run", "--with", "requests", "script.py"]), ["requests"]);
});

test("reads the project manifest when uv installs from a lockfile", () => {
  assert.deepEqual(parseInstall("uv", ["sync"]), { kind: "manifest", ecosystem: "pip", paths: [] });
  assert.deepEqual(parseInstall("uv", ["pip", "sync", "requirements.txt"]), {
    kind: "manifest",
    ecosystem: "pip",
    paths: ["requirements.txt"],
  });
  assert.deepEqual(parseInstall("uv", ["pip", "install", "-r", "requirements.txt"]), {
    kind: "manifest",
    ecosystem: "pip",
    paths: ["requirements.txt"],
  });
});

test("leaves alone the uv commands that install nothing from an index", () => {
  for (const args of [
    ["python", "install", "3.12"],
    ["venv", ".venv"],
    ["init", "myproject"],
    ["lock"],
    ["build"],
    ["run", "script.py"],
    ["pip", "install", "-e", "."],
  ]) {
    assert.equal(parseInstall("uv", args), null, `uv ${args.join(" ")} should pass through`);
  }
});
