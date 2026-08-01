import type { Ecosystem } from "./types.js";

export const ECOSYSTEM_ALIASES: Record<string, Ecosystem> = {
  pip: "pip",
  pip3: "pip",
  pypi: "pip",
  python: "pip",
  npm: "npm",
  yarn: "npm",
  pnpm: "npm",
  bun: "npm",
};

export const SHIMMED_MANAGERS = ["pip", "pip3", "python", "python3", "uv", "uvx", "npm", "yarn", "pnpm", "bun"];

export function resolveEcosystem(name: string): Ecosystem | null {
  return ECOSYSTEM_ALIASES[name.toLowerCase()] ?? null;
}

export function registryName(ecosystem: Ecosystem): string {
  return ecosystem === "pip" ? "PyPI" : "npm";
}
