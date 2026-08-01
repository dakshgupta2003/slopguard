import type { Ecosystem } from "../types.js";
import { findNpmImpostorTarget } from "./npm.js";
import { findPypiImpostorTarget } from "./pypi.js";

export async function findImpostorTarget(
  ecosystem: Ecosystem,
  name: string,
  monthlyDownloads: number | null,
): Promise<string | null> {
  return ecosystem === "pip" ? findPypiImpostorTarget(name) : findNpmImpostorTarget(name, monthlyDownloads);
}
