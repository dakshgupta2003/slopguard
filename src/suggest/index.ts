import { loadDataset } from "../dataset.js";
import type { Ecosystem } from "../types.js";
import { suggestPypi } from "./pypi.js";
import { suggestNpm } from "./npm.js";

type Alternatives = Record<Ecosystem, Record<string, string[]>>;

const curated = loadDataset<Alternatives>("alternatives.json");

export async function suggest(ecosystem: Ecosystem, name: string): Promise<string[]> {
  const override = curated[ecosystem]?.[name.trim().toLowerCase()];
  if (override?.length) return override;

  return ecosystem === "pip" ? suggestPypi(name) : suggestNpm(name);
}
