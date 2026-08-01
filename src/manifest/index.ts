import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Ecosystem } from "../types.js";
import { parsePackageJson } from "./packageJson.js";
import { parseRequirements } from "./requirements.js";
import { parsePyproject } from "./pyproject.js";

export interface Manifest {
  path: string;
  ecosystem: Ecosystem;
  packages: string[];
}

interface ManifestFormat {
  ecosystem: Ecosystem;
  parse: (content: string) => string[];
}

const FORMATS: Record<string, ManifestFormat> = {
  "package.json": { ecosystem: "npm", parse: parsePackageJson },
  "requirements.txt": { ecosystem: "pip", parse: parseRequirements },
  "pyproject.toml": { ecosystem: "pip", parse: parsePyproject },
};

const DEFAULTS: Record<Ecosystem, string[]> = {
  npm: ["package.json"],
  pip: ["requirements.txt", "pyproject.toml"],
};

export function readManifest(path: string): Manifest | null {
  const format = formatFor(path);
  if (!format || !existsSync(path)) return null;

  try {
    const packages = format.parse(readFileSync(path, "utf8"));
    return packages.length > 0 ? { path, ecosystem: format.ecosystem, packages } : null;
  } catch {
    return null;
  }
}

export function defaultManifestPaths(ecosystem: Ecosystem, directory: string): string[] {
  return DEFAULTS[ecosystem].map((name) => join(directory, name)).filter((path) => existsSync(path));
}

export function allManifestPaths(directory: string): string[] {
  return Object.keys(FORMATS)
    .map((name) => join(directory, name))
    .filter((path) => existsSync(path));
}

function formatFor(path: string): ManifestFormat | null {
  const name = basename(path).toLowerCase();
  if (FORMATS[name]) return FORMATS[name];
  return name.startsWith("requirements") && name.endsWith(".txt") ? FORMATS["requirements.txt"] : null;
}
