import { resolveEcosystem } from "../ecosystems.js";
import { isRegistrySpec, packageName } from "../spec.js";
import type { Ecosystem } from "../types.js";

export type InstallCommand =
  | { kind: "packages"; ecosystem: Ecosystem; packages: string[] }
  | { kind: "manifest"; ecosystem: Ecosystem; paths: string[] };

const INSTALL_VERBS = new Set(["install", "i", "add", "ci"]);

const REQUIREMENT_FLAGS = ["-r", "--requirement"];
const LOCAL_SOURCE_FLAGS = ["-e", "--editable", "-c", "--constraint"];

export function parseInstall(manager: string, args: string[]): InstallCommand | null {
  if (isPython(manager)) {
    return args[0] === "-m" && args[1] === "pip" ? parseInstall("pip", args.slice(2)) : null;
  }

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

function requirementPaths(args: string[]): string[] {
  const paths: string[] = [];

  args.forEach((token, index) => {
    if (!matchesFlag(token, REQUIREMENT_FLAGS)) return;
    const inline = token.split("=")[1];
    const value = inline || args[index + 1];
    if (value) paths.push(value);
  });

  return paths;
}

function matchesFlag(token: string, flags: string[]): boolean {
  return flags.some((flag) => token === flag || token.startsWith(`${flag}=`));
}
