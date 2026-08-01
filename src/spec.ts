import type { Ecosystem } from "./types.js";

const ARCHIVE_SUFFIX = /\.(tgz|whl|zip|tar\.gz)$/i;
const PIP_VERSION_BOUNDARY = /[[=<>!~;@\s]/;

export function isRegistrySpec(spec: string): boolean {
  if (spec.includes("://")) return false;
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("~")) return false;
  if (ARCHIVE_SUFFIX.test(spec)) return false;
  return true;
}

export function packageName(ecosystem: Ecosystem, spec: string): string {
  if (ecosystem === "pip") {
    return spec.split(PIP_VERSION_BOUNDARY)[0].trim();
  }
  const versionAt = spec.lastIndexOf("@");
  return versionAt > 0 ? spec.slice(0, versionAt) : spec;
}
