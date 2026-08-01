import { checkPackages } from "../engine.js";
import { isAllowed } from "../allowlist.js";
import { fingerprint, isManifestUnchanged, rememberManifest } from "../cache.js";
import { readManifest } from "./index.js";
import type { CheckResult } from "../types.js";

export async function scanManifests(paths: string[]): Promise<CheckResult[]> {
  const risky: CheckResult[] = [];

  for (const path of paths) {
    const manifest = readManifest(path);
    if (!manifest) continue;

    const stamp = fingerprint(manifest.packages);
    if (isManifestUnchanged(path, stamp)) continue;

    const targets = manifest.packages.filter((name) => !isAllowed(manifest.ecosystem, name));
    const results = await checkPackages(manifest.ecosystem, targets);
    const flagged = results.filter((result) => result.level !== "allow");

    rememberManifest(path, stamp, flagged.length === 0);
    risky.push(...flagged);
  }

  return risky;
}
