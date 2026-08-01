import type { PackageInfo } from "../types.js";

interface NpmResponse {
  time?: { created?: string };
  repository?: string | { url?: string } | null;
}

const TIMEOUT_MS = 5000;
const DAY_MS = 86_400_000;

export async function lookupNpm(name: string): Promise<PackageInfo> {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "slopguard" },
  });
  if (res.status === 404) return absent(name);
  if (!res.ok) throw new Error(`npm lookup failed (${res.status})`);

  const body = (await res.json()) as NpmResponse;
  return {
    name,
    exists: true,
    ageDays: ageFrom(body.time?.created),
    monthlyDownloads: await monthlyDownloads(name),
    hasSourceRepo: hasSource(body.repository),
  };
}

function absent(name: string): PackageInfo {
  return { name, exists: false, ageDays: null, monthlyDownloads: null, hasSourceRepo: false };
}

function ageFrom(created?: string): number | null {
  if (!created) return null;
  const ms = Date.parse(created);
  if (Number.isNaN(ms)) return null;
  return Math.floor((Date.now() - ms) / DAY_MS);
}

function hasSource(repository: NpmResponse["repository"]): boolean {
  if (!repository) return false;
  return typeof repository === "string" ? repository.length > 0 : Boolean(repository.url);
}

async function monthlyDownloads(name: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "slopguard" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { downloads?: number };
    return body.downloads ?? null;
  } catch {
    return null;
  }
}
