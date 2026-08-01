import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInstall, type InstallCommand } from "../src/shim/parse.js";

function packagesOf(command: InstallCommand | null): string[] | undefined {
  return command?.kind === "packages" ? command.packages : undefined;
}

function pathsOf(command: InstallCommand | null): string[] | undefined {
  return command?.kind === "manifest" ? command.paths : undefined;
}

test("extracts a pip package and strips the version specifier", () => {
  assert.deepEqual(parseInstall("pip", ["install", "requests==2.31.0"]), {
    kind: "packages",
    ecosystem: "pip",
    packages: ["requests"],
  });
});

test("strips pip extras", () => {
  assert.deepEqual(packagesOf(parseInstall("pip", ["install", "uvicorn[standard]"])), ["uvicorn"]);
});

test("skips npm flags and keeps the package", () => {
  assert.deepEqual(packagesOf(parseInstall("npm", ["install", "--save-dev", "express"])), ["express"]);
});

test("keeps npm scoped names intact while dropping the version", () => {
  assert.deepEqual(packagesOf(parseInstall("npm", ["i", "@scope/pkg@1.2.3"])), ["@scope/pkg"]);
});

test("maps yarn add onto the npm registry", () => {
  assert.deepEqual(parseInstall("yarn", ["add", "lodash"]), {
    kind: "packages",
    ecosystem: "npm",
    packages: ["lodash"],
  });
});

test("passes through non-install commands", () => {
  assert.equal(parseInstall("pip", ["list"]), null);
  assert.equal(parseInstall("npm", ["run", "build"]), null);
});

test("routes pip requirement files to the manifest scanner", () => {
  assert.deepEqual(parseInstall("pip", ["install", "-r", "requirements.txt"]), {
    kind: "manifest",
    ecosystem: "pip",
    paths: ["requirements.txt"],
  });
  assert.deepEqual(pathsOf(parseInstall("pip", ["install", "--requirement=dev.txt"])), ["dev.txt"]);
});

test("routes bare npm installs to the manifest scanner", () => {
  assert.deepEqual(parseInstall("npm", ["install"]), { kind: "manifest", ecosystem: "npm", paths: [] });
  assert.deepEqual(parseInstall("npm", ["ci"]), { kind: "manifest", ecosystem: "npm", paths: [] });
});

test("passes through local paths and urls", () => {
  assert.equal(parseInstall("npm", ["install", "./local-package"]), null);
  assert.equal(parseInstall("pip", ["install", "https://example.com/pkg.whl"]), null);
});
