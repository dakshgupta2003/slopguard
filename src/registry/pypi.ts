import type { PackageInfo } from "../types.js";

interface PypiRelease {
  upload_time_iso_8601?: string;
}

interface PypiResponse {
  info: {
    home_page?: string | null;
    project_urls?: Record<string, string> | null;
  };
  releases: Record<string, PypiRelease[]>;
}

const SOURCE_HOST = /(github|gitlab|bitbucket|codeberg|sourceforge)\./i;
const TIMEOUT_MS = 5000;
const DAY_MS = 86_400_000;

export async function lookupPypi(name: string): Promise<PackageInfo> {
  const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "slopguard" },
  });
  if (res.status === 404) return absent(name);
  if (!res.ok) throw new Error(`PyPI lookup failed (${res.status})`);

  const body = (await res.json()) as PypiResponse;
  return {
    name,
    exists: true,
    ageDays: earliestReleaseAgeDays(body.releases),
    monthlyDownloads: await monthlyDownloads(name),
    hasSourceRepo: hasSource(body.info),
  };
}

function absent(name: string): PackageInfo {
  return { name, exists: false, ageDays: null, monthlyDownloads: null, hasSourceRepo: false };
}

function earliestReleaseAgeDays(releases: Record<string, PypiRelease[]>): number | null {
  let earliest = Number.POSITIVE_INFINITY;
  for (const files of Object.values(releases)) {
    for (const file of files) {
      if (!file.upload_time_iso_8601) continue;
      earliest = Math.min(earliest, Date.parse(file.upload_time_iso_8601));
    }
  }
  if (!Number.isFinite(earliest)) return null;
  return Math.floor((Date.now() - earliest) / DAY_MS);
}

function hasSource(info: PypiResponse["info"]): boolean {
  const urls = [info.home_page ?? "", ...Object.values(info.project_urls ?? {})];
  return urls.some((url) => SOURCE_HOST.test(url));
}

async function monthlyDownloads(name: string): Promise<number | null> {
  try {
    const res = await fetch(`https://pypistats.org/api/packages/${encodeURIComponent(name)}/recent`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "slopguard" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { last_month?: number } };
    return body.data?.last_month ?? null;
  } catch {
    return null;
  }
}
