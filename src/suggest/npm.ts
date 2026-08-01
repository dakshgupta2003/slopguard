import { MAX_SUGGESTIONS, MIN_SIMILARITY, rankBySimilarity } from "./similarity.js";

interface SearchResponse {
  objects?: {
    downloads?: { monthly?: number };
    package?: { name?: string };
  }[];
}

const MIN_MONTHLY_DOWNLOADS = 10_000;
const SEARCH_SIZE = 25;
const TIMEOUT_MS = 5000;

export async function suggestNpm(name: string): Promise<string[]> {
  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(name)}&size=${SEARCH_SIZE}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "slopguard" },
    });
    if (!res.ok) return [];

    const body = (await res.json()) as SearchResponse;
    const established = (body.objects ?? [])
      .filter((entry) => (entry.downloads?.monthly ?? 0) >= MIN_MONTHLY_DOWNLOADS)
      .map((entry) => entry.package?.name)
      .filter((candidate): candidate is string => Boolean(candidate));

    return rankBySimilarity(name, established, MIN_SIMILARITY, MAX_SUGGESTIONS);
  } catch {
    return [];
  }
}
