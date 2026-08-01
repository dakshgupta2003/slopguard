import { loadDataset } from "../dataset.js";
import { MAX_SUGGESTIONS, MIN_SIMILARITY, rankBySimilarity } from "./similarity.js";

const popular = loadDataset<{ packages: string[] }>("popular-pypi.json").packages;

export async function suggestPypi(name: string): Promise<string[]> {
  return rankBySimilarity(name, popular, MIN_SIMILARITY, MAX_SUGGESTIONS);
}
