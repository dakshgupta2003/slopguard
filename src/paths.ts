import { homedir } from "node:os";
import { join } from "node:path";

export function slopguardHome(): string {
  return join(homedir(), ".slopguard");
}

export function shimBinDir(): string {
  return join(slopguardHome(), "bin");
}

export function allowlistPath(): string {
  return join(slopguardHome(), "allowlist.json");
}

export function cachePath(): string {
  return join(slopguardHome(), "cache.json");
}
