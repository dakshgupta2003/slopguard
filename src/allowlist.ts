import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { allowlistPath } from "./paths.js";
import type { Ecosystem } from "./types.js";

type Allowlist = Record<Ecosystem, string[]>;

const EMPTY: Allowlist = { pip: [], npm: [] };

function read(): Allowlist {
  try {
    const parsed = JSON.parse(readFileSync(allowlistPath(), "utf8")) as Partial<Allowlist>;
    return { pip: parsed.pip ?? [], npm: parsed.npm ?? [] };
  } catch {
    return { ...EMPTY };
  }
}

export function isAllowed(ecosystem: Ecosystem, name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return read()[ecosystem].some((entry) => entry.toLowerCase() === normalized);
}

export function addAllowed(ecosystem: Ecosystem, name: string): void {
  const allowlist = read();
  const normalized = name.trim();
  if (!allowlist[ecosystem].includes(normalized)) {
    allowlist[ecosystem].push(normalized);
  }
  mkdirSync(dirname(allowlistPath()), { recursive: true });
  writeFileSync(allowlistPath(), `${JSON.stringify(allowlist, null, 2)}\n`);
}
