import { typoVariants } from "./variants.js";

type DownloadPoint = { downloads: number; package: string } | null;

const POPULAR_DOWNLOADS = 100_000;
const PROBE_CEILING = 1_000_000;
const DOMINANCE = 100;
const BULK_LIMIT = 128;
const TIMEOUT_MS = 5000;

export async function findNpmImpostorTarget(name: string, monthlyDownloads: number | null): Promise<string | null> {
  if (name.startsWith("@")) return null;
  if (monthlyDownloads !== null && monthlyDownloads >= PROBE_CEILING) return null;

  const floor = Math.max(POPULAR_DOWNLOADS, (monthlyDownloads ?? 0) * DOMINANCE);

  const candidates = typoVariants(name).slice(0, BULK_LIMIT);
  if (candidates.length === 0) return null;

  try {
    const url = `https://api.npmjs.org/downloads/point/last-month/${candidates.map(encodeURIComponent).join(",")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "slopguard" } });
    if (!res.ok) return null;

    const body = (await res.json()) as Record<string, DownloadPoint>;
    const popular = Object.values(body)
      .filter((entry): entry is NonNullable<DownloadPoint> => (entry?.downloads ?? 0) >= floor)
      .sort((first, second) => second.downloads - first.downloads);

    return popular[0]?.package ?? null;
  } catch {
    return null;
  }
}
