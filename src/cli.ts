#!/usr/bin/env node
import { checkPackage, MAX_SCORE } from "./engine.js";
import { resolveEcosystem, ECOSYSTEM_ALIASES } from "./ecosystems.js";
import { addAllowed } from "./allowlist.js";
import { runShim } from "./shim/run.js";
import { runMcpServer } from "./mcp/server.js";
import { init, uninstall } from "./shim/setup.js";
import { findVenv, protectVenv, unprotectVenv } from "./venv.js";
import { installGitHook, uninstallGitHook } from "./githook.js";
import { allManifestPaths } from "./manifest/index.js";
import { scanManifests } from "./manifest/scan.js";
import { basename, resolve } from "node:path";
import type { CheckResult, Level } from "./types.js";

const USAGE_EXIT = 64;

const LABEL: Record<Level, string> = {
  allow: "ALLOW",
  warn: "WARN",
  block: "BLOCK",
};

const EXIT: Record<Level, number> = {
  allow: 0,
  warn: 1,
  block: 2,
};

const USAGE = `usage:
  slopguard <pip|npm|yarn|pnpm> <package>   check a package
  slopguard init                            protect every install on this machine
  slopguard uninstall                       remove shims and restore PATH
  slopguard allow <pip|npm> <package>       permanently allow a package
  slopguard scan [dir]                      check every dependency in a project's manifests
  slopguard hook                            refuse commits that add a blocked dependency
  slopguard unhook                          remove the pre-commit hook
  slopguard mcp                             run the MCP server for AI agents
  slopguard protect [venv]                  guard pip inside a virtualenv
  slopguard unprotect [venv]                restore a virtualenv's own pip`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  switch (command) {
    case undefined:
    case "help":
    case "--help":
      console.log(USAGE);
      return command === undefined ? USAGE_EXIT : 0;
    case "init":
      return init();
    case "uninstall":
      return uninstall();
    case "allow":
      return allow(rest);
    case "protect":
      return protect(rest[0]);
    case "unprotect":
      return unprotect(rest[0]);
    case "scan":
      return scan(rest[0]);
    case "hook":
      return installGitHook(rest[0]);
    case "unhook":
      return uninstallGitHook(rest[0]);
    case "mcp":
      return runMcpServer();
    case "shim":
      return runShim(rest[0] ?? "", rest.slice(1));
    case "check":
      return check(rest);
    default:
      return check(argv);
  }
}

async function check(args: string[]): Promise<number> {
  const [ecosystemName, name] = args;
  if (!ecosystemName || !name) {
    console.error(USAGE);
    return USAGE_EXIT;
  }

  const ecosystem = resolveEcosystem(ecosystemName);
  if (!ecosystem) {
    console.error(`unknown ecosystem "${ecosystemName}" (expected: ${Object.keys(ECOSYSTEM_ALIASES).join(", ")})`);
    return USAGE_EXIT;
  }

  const result = await checkPackage(ecosystem, name);
  print(result);
  return EXIT[result.level];
}

function allow(args: string[]): number {
  const [ecosystemName, name] = args;
  if (!ecosystemName || !name) {
    console.error("usage: slopguard allow <pip|npm> <package>");
    return USAGE_EXIT;
  }

  const ecosystem = resolveEcosystem(ecosystemName);
  if (!ecosystem) {
    console.error(`unknown ecosystem "${ecosystemName}"`);
    return USAGE_EXIT;
  }

  addAllowed(ecosystem, name);
  console.log(`Allowed ${name} (${ecosystem}).`);
  return 0;
}

async function scan(directory = process.cwd()): Promise<number> {
  const paths = allManifestPaths(resolve(directory));
  if (paths.length === 0) {
    console.error(`no package.json, requirements.txt or pyproject.toml in ${resolve(directory)}`);
    return USAGE_EXIT;
  }

  const risky = await scanManifests(paths);
  if (risky.length === 0) {
    console.log(`Checked ${paths.map((path) => basename(path)).join(", ")} — nothing suspicious.`);
    return 0;
  }

  for (const result of risky) print(result);
  return risky.some((result) => result.level === "block") ? EXIT.block : EXIT.warn;
}

function protect(target?: string): number {
  const venv = findVenv(target);
  if (!venv) {
    console.error("no virtualenv found (pass its path, or activate one first)");
    return USAGE_EXIT;
  }

  const applied = protectVenv(venv);
  console.log(applied.length > 0 ? `Protected ${applied.join(", ")} inside ${venv}.` : `${venv} is already protected.`);
  return 0;
}

function unprotect(target?: string): number {
  const venv = findVenv(target);
  if (!venv) {
    console.error("no virtualenv found (pass its path, or activate one first)");
    return USAGE_EXIT;
  }

  const restored = unprotectVenv(venv);
  console.log(restored.length > 0 ? `Restored ${restored.join(", ")} inside ${venv}.` : `${venv} was not protected.`);
  return 0;
}

function print(result: CheckResult): void {
  console.log(`${LABEL[result.level]}  ${result.name} (${result.ecosystem})  risk ${result.score}/${MAX_SCORE}`);
  for (const signal of result.signals) {
    console.log(`  - ${signal.reason}`);
  }
  if (result.alternatives.length > 0) {
    console.log(`  Try instead: ${result.alternatives.join(", ")}`);
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`slopguard: ${message}`);
    process.exit(70);
  });
