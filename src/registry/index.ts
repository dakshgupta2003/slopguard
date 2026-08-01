import type { Ecosystem, PackageInfo } from "../types.js";
import { lookupPypi } from "./pypi.js";
import { lookupNpm } from "./npm.js";

export async function lookup(ecosystem: Ecosystem, name: string): Promise<PackageInfo> {
  return ecosystem === "pip" ? lookupPypi(name) : lookupNpm(name);
}
