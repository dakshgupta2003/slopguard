import { accessSync, constants, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter, join, resolve } from "node:path";
import { checkPackages } from "../engine.js";
import { isAllowed } from "../allowlist.js";
import { shimBinDir } from "../paths.js";
import { isPython, parseInstall, type InstallCommand } from "./parse.js";
import { defaultManifestPaths } from "../manifest/index.js";
import { scanManifests } from "../manifest/scan.js";
import { protectVenv } from "../venv.js";
import type { CheckResult } from "../types.js";

const BLOCKED_EXIT = 2;
const MISSING_MANAGER_EXIT = 127;

export async function runShim(manager: string, args: string[]): Promise<number> {
  if (process.env.SLOPGUARD_DISABLE === "1") return passthrough(manager, args);

  if (isPython(manager) && args[0] === "-m" && args[1] === "venv") {
    return createVenv(manager, args);
  }

  const command = parseInstall(manager, args);
  if (!command) return passthrough(manager, args);

  const results = await review(command);

  const blocked = results.filter((result) => result.level === "block");
  const warned = results.filter((result) => result.level === "warn");

  for (const result of warned) report("WARNING", result);

  if (blocked.length > 0) {
    for (const result of blocked) report("BLOCKED", result);
    console.error("\nNothing was installed.");
    console.error(`Override once:   SLOPGUARD_DISABLE=1 ${manager} ${args.join(" ")}`);
    console.error(`Always allow:    slopguard allow ${blocked[0].ecosystem} ${blocked[0].name}`);
    return BLOCKED_EXIT;
  }

  return passthrough(manager, args);
}

async function review(command: InstallCommand): Promise<CheckResult[]> {
  if (command.kind === "packages") {
    const targets = command.packages.filter((name) => !isAllowed(command.ecosystem, name));
    const results = await checkPackages(command.ecosystem, targets);
    return results.filter((result) => result.level !== "allow");
  }

  const paths =
    command.paths.length > 0
      ? command.paths.map((path) => resolve(path))
      : defaultManifestPaths(command.ecosystem, process.cwd());

  return scanManifests(paths);
}

function report(heading: string, result: CheckResult): void {
  console.error(`\n${heading} by slopguard: ${result.name} (${result.ecosystem}) risk ${result.score}`);
  for (const signal of result.signals) {
    console.error(`  - ${signal.reason}`);
  }
  if (result.alternatives.length > 0) {
    console.error(`  Try instead: ${result.alternatives.join(", ")}`);
  }
}

function createVenv(manager: string, args: string[]): number {
  const code = passthrough(manager, args);
  if (code !== 0) return code;

  const target = args.slice(2).find((token) => !token.startsWith("-"));
  if (!target) return code;

  const applied = protectVenv(resolve(target));
  if (applied.length > 0) {
    console.error(`slopguard: protecting ${applied.join(", ")} inside ${target}`);
  }
  return code;
}

function passthrough(manager: string, args: string[]): number {
  const real = findRealManager(manager);
  if (!real) {
    console.error(`slopguard: "${manager}" not found on PATH`);
    return MISSING_MANAGER_EXIT;
  }
  return spawnSync(real, args, { stdio: "inherit" }).status ?? 1;
}

function findRealManager(manager: string): string | null {
  const explicit = process.env.SLOPGUARD_REAL_BIN;
  if (explicit && isExecutable(explicit)) return explicit;

  const shims = resolve(shimBinDir());
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir || resolve(dir) === shims) continue;
    const candidate = join(dir, manager);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
