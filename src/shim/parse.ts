import { resolveEcosystem } from "../ecosystems.js";
import { isRegistrySpec, packageName } from "../spec.js";
import type { Ecosystem } from "../types.js";

export type InstallCommand =
  | { kind: "packages"; ecosystem: Ecosystem; packages: string[] }
  | { kind: "manifest"; ecosystem: Ecosystem; paths: string[] };

const INSTALL_VERBS = new Set(["install", "i", "add", "ci"]);

const REQUIREMENT_FLAGS = ["-r", "--requirement"];
const LOCAL_SOURCE_FLAGS = ["-e", "--editable", "-c", "--constraint"];
const WITH_FLAGS = ["--with"];
const FROM_FLAGS = ["--from"];

export function parseInstall(manager: string, args: string[]): InstallCommand | null {
  if (isPython(manager)) {
    return args[0] === "-m" && args[1] === "pip" ? parseInstall("pip", args.slice(2)) : null;
  }

  if (manager === "uv") return parseUv(args);
  if (manager === "uvx") return pipPackages(ephemeralTarget(args));

  const ecosystem = resolveEcosystem(manager);
  if (!ecosystem) return null;

  const [verb, ...rest] = args;
  if (!verb || !INSTALL_VERBS.has(verb)) return null;
  if (rest.some((token) => matchesFlag(token, LOCAL_SOURCE_FLAGS))) return null;

  const requirements = requirementPaths(rest);
  if (requirements.length > 0) return { kind: "manifest", ecosystem, paths: requirements };

  const operands = rest.filter((token) => !token.startsWith("-"));
  if (operands.length === 0) {
    return ecosystem === "npm" ? { kind: "manifest", ecosystem, paths: [] } : null;
  }

  const packages = operands.filter(isRegistrySpec).map((spec) => packageName(ecosystem, spec));
  return packages.length > 0 ? { kind: "packages", ecosystem, packages } : null;
}

export function isPython(manager: string): boolean {
  return manager === "python" || manager === "python3";
}

// uv keeps the real verb one level down: "uv pip install x", "uv tool install x".
// Anything not listed is passed through, so "uv python install 3.12" is never
// mistaken for a package install.
function parseUv(args: string[]): InstallCommand | null {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case "pip":
      return rest[0] === "sync" ? pipManifest(operands(rest.slice(1))) : parseInstall("pip", rest);
    case "tool":
      return rest[0] === "run" ? pipPackages(ephemeralTarget(rest.slice(1))) : parseInstall("pip", rest);
    case "add":
      return parseInstall("pip", args);
    case "sync":
      return pipManifest([]);
    case "run":
      return pipPackages(flagValues(rest, WITH_FLAGS));
    default:
      return null;
  }
}

// uvx httpx, but uvx --from httpx python names the package in the flag instead
function ephemeralTarget(args: string[]): string[] {
  const from = flagValues(args, FROM_FLAGS);
  return from.length > 0 ? from : operands(args).slice(0, 1);
}

function pipPackages(specs: string[]): InstallCommand | null {
  const packages = specs.filter(isRegistrySpec).map((spec) => packageName("pip", spec));
  return packages.length > 0 ? { kind: "packages", ecosystem: "pip", packages } : null;
}

function pipManifest(paths: string[]): InstallCommand {
  return { kind: "manifest", ecosystem: "pip", paths };
}

function operands(args: string[]): string[] {
  return args.filter((token) => !token.startsWith("-"));
}

function requirementPaths(args: string[]): string[] {
  return flagValues(args, REQUIREMENT_FLAGS);
}

function flagValues(args: string[], flags: string[]): string[] {
  const values: string[] = [];

  args.forEach((token, index) => {
    if (!matchesFlag(token, flags)) return;
    const inline = token.split("=")[1];
    const value = inline || args[index + 1];
    if (value) values.push(value);
  });

  return values;
}

function matchesFlag(token: string, flags: string[]): boolean {
  return flags.some((flag) => token === flag || token.startsWith(`${flag}=`));
}
