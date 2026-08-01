import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cachePath } from "./paths.js";
import type { CheckResult, Ecosystem } from "./types.js";

interface VerdictEntry {
  expiresAt: number;
  result: CheckResult;
}

interface Cache {
  version: number;
  verdicts: Record<string, VerdictEntry>;
  manifests: Record<string, string>;
}

// bump whenever scoring changes, so upgrades never serve verdicts from the old rules
const CACHE_VERSION = 2;

const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOW_TTL_MS = 7 * DAY_MS;
const RISK_TTL_MS = DAY_MS;

export function fingerprint(packages: string[]): string {
  return createHash("sha256").update([...packages].sort().join("\n")).digest("hex");
}

export function cachedVerdict(ecosystem: Ecosystem, name: string): CheckResult | null {
  const entry = read().verdicts[verdictKey(ecosystem, name)];
  return entry && entry.expiresAt > Date.now() ? entry.result : null;
}

export function rememberVerdicts(results: CheckResult[]): void {
  if (results.length === 0) return;

  const cache = read();
  for (const result of results) {
    const ttl = result.level === "allow" ? ALLOW_TTL_MS : RISK_TTL_MS;
    cache.verdicts[verdictKey(result.ecosystem, result.name)] = { expiresAt: Date.now() + ttl, result };
  }
  write(cache);
}

export function isManifestUnchanged(path: string, stamp: string): boolean {
  return read().manifests[path] === stamp;
}

export function rememberManifest(path: string, stamp: string, clean: boolean): void {
  const cache = read();
  if (clean) {
    cache.manifests[path] = stamp;
  } else {
    delete cache.manifests[path];
  }
  write(cache);
}

function verdictKey(ecosystem: Ecosystem, name: string): string {
  return `${ecosystem}:${name.toLowerCase()}`;
}

function read(): Cache {
  const empty: Cache = { version: CACHE_VERSION, verdicts: {}, manifests: {} };

  try {
    const parsed = JSON.parse(readFileSync(cachePath(), "utf8")) as Partial<Cache>;
    if (parsed.version !== CACHE_VERSION) return empty;
    return { version: CACHE_VERSION, verdicts: parsed.verdicts ?? {}, manifests: parsed.manifests ?? {} };
  } catch {
    return empty;
  }
}

function write(cache: Cache): void {
  try {
    mkdirSync(dirname(cachePath()), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify(cache));
  } catch {
    // a cache that cannot be written must never fail an install
  }
}
