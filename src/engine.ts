import type { CheckResult, Ecosystem, Level, PackageInfo, Signal } from "./types.js";
import { lookup as defaultLookup } from "./registry/index.js";
import { inCorpus as defaultInCorpus } from "./corpus.js";
import { suggest as defaultSuggest } from "./suggest/index.js";
import { registryName } from "./ecosystems.js";
import { findImpostorTarget as defaultFindImpostorTarget } from "./typosquat/index.js";
import { cachedVerdict, rememberVerdicts } from "./cache.js";

export interface EngineDeps {
  lookup: (ecosystem: Ecosystem, name: string) => Promise<PackageInfo>;
  inCorpus: (ecosystem: Ecosystem, name: string) => boolean;
  suggest: (ecosystem: Ecosystem, name: string) => Promise<string[]>;
  findImpostorTarget: (
    ecosystem: Ecosystem,
    name: string,
    monthlyDownloads: number | null,
  ) => Promise<string | null>;
}

const defaultDeps: EngineDeps = {
  lookup: defaultLookup,
  inCorpus: defaultInCorpus,
  suggest: defaultSuggest,
  findImpostorTarget: defaultFindImpostorTarget,
};

const NEWBORN_DAYS = 30;
const LOW_DOWNLOADS = 100;
const BLOCK_SCORE = 70;
const WARN_SCORE = 35;
const CONCURRENCY = 8;

const WEIGHT = {
  impostor: 70,
  corpus: 40,
  newborn: 25,
  lowDownloads: 20,
  noRepo: 10,
};

export const MAX_SCORE = Object.values(WEIGHT).reduce((total, weight) => total + weight, 0);

export async function checkPackage(
  ecosystem: Ecosystem,
  name: string,
  deps: EngineDeps = defaultDeps,
): Promise<CheckResult> {
  const info = await deps.lookup(ecosystem, name);
  const known = deps.inCorpus(ecosystem, name);

  const impostorTarget = info.exists ? await impostorFor(deps, ecosystem, name, info.monthlyDownloads) : null;

  const signals = info.exists ? riskSignals(info, known, impostorTarget) : absenceSignals(ecosystem, known);
  const score = signals.reduce((total, signal) => total + signal.weight, 0);
  const level = info.exists ? decide(score, known, isNewborn(info)) : "warn";
  const alternatives = level === "allow" ? [] : await alternativesFor(deps, ecosystem, name, impostorTarget);

  return { ecosystem, name, level, score, signals, alternatives };
}

export async function checkPackages(ecosystem: Ecosystem, names: string[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const fresh: CheckResult[] = [];
  const queue = [...names];

  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      const cached = cachedVerdict(ecosystem, name);
      if (cached) {
        results.push(cached);
        continue;
      }
      try {
        const result = await checkPackage(ecosystem, name);
        results.push(result);
        fresh.push(result);
      } catch {
        console.error(`slopguard: could not verify "${name}", allowing it through`);
      }
    }
  });

  await Promise.all(workers);
  rememberVerdicts(fresh);
  return results;
}

function riskSignals(info: PackageInfo, known: boolean, impostorTarget: string | null): Signal[] {
  const signals: Signal[] = [];

  if (impostorTarget) {
    signals.push({
      id: "impostor",
      reason: `name is nearly identical to "${impostorTarget}", a far more popular package`,
      weight: WEIGHT.impostor,
    });
  }
  if (known) {
    signals.push({ id: "corpus", reason: "matches known AI-hallucination list", weight: WEIGHT.corpus });
  }
  if (isNewborn(info)) {
    signals.push({ id: "newborn", reason: `registered ${info.ageDays} days ago`, weight: WEIGHT.newborn });
  }
  if (info.monthlyDownloads !== null && info.monthlyDownloads < LOW_DOWNLOADS) {
    signals.push({
      id: "low-downloads",
      reason: `only ${info.monthlyDownloads} downloads last month`,
      weight: WEIGHT.lowDownloads,
    });
  }
  if (!info.hasSourceRepo) {
    signals.push({ id: "no-repo", reason: "no source repository linked", weight: WEIGHT.noRepo });
  }

  return signals;
}


function absenceSignals(ecosystem: Ecosystem, known: boolean): Signal[] {
  const signals: Signal[] = [
    {
      id: "absent",
      reason: `not found on ${registryName(ecosystem)} — likely an AI hallucination`,
      weight: 0,
    },
  ];
  if (known) {
    signals.push({ id: "corpus", reason: "matches known AI-hallucination list", weight: 0 });
  }
  return signals;
}

async function alternativesFor(
  deps: EngineDeps,
  ecosystem: Ecosystem,
  name: string,
  impostorTarget: string | null,
): Promise<string[]> {
  try {
    const suggestions = await deps.suggest(ecosystem, name);
    return impostorTarget ? [...new Set([impostorTarget, ...suggestions])] : suggestions;
  } catch {
    return impostorTarget ? [impostorTarget] : [];
  }
}

async function impostorFor(
  deps: EngineDeps,
  ecosystem: Ecosystem,
  name: string,
  monthlyDownloads: number | null,
): Promise<string | null> {
  try {
    return await deps.findImpostorTarget(ecosystem, name, monthlyDownloads);
  } catch {
    return null;
  }
}

function isNewborn(info: PackageInfo): boolean {
  return info.ageDays !== null && info.ageDays < NEWBORN_DAYS;
}

function decide(score: number, known: boolean, newborn: boolean): Level {
  if (known && newborn) return "block";
  if (score >= BLOCK_SCORE) return "block";
  if (score >= WARN_SCORE) return "warn";
  return "allow";
}
