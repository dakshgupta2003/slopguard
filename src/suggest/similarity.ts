const SEPARATORS = /[-_.]/g;

export const MIN_SIMILARITY = 0.7;
export const MAX_SUGGESTIONS = 3;

export function normalize(name: string): string {
  return name.toLowerCase().replace(SEPARATORS, "");
}

export function similarity(left: string, right: string): number {
  const a = normalize(left);
  const b = normalize(right);
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 0;
  return 1 - editDistance(a, b) / longest;
}

export function distance(left: string, right: string): number {
  return editDistance(normalize(left), normalize(right));
}

export function rankBySimilarity(
  name: string,
  candidates: string[],
  minScore: number,
  limit: number,
): string[] {
  const targetLength = normalize(name).length;
  const maxLengthGap = Math.ceil(targetLength * 0.4);

  return candidates
    .filter((candidate) => candidate !== name)
    .filter((candidate) => Math.abs(normalize(candidate).length - targetLength) <= maxLengthGap)
    .map((candidate) => ({ candidate, score: similarity(name, candidate) }))
    .filter((entry) => entry.score >= minScore)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

function editDistance(a: string, b: string): number {
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, index) => index)];

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      let best = Math.min(rows[i - 1][j] + 1, current[j - 1] + 1, substitution);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2][j - 2] + 1);
      }
      current[j] = best;
    }
    rows.push(current);
  }

  return rows[a.length][b.length];
}
