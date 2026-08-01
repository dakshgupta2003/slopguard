import { loadDataset } from "./dataset.js";
import type { Ecosystem } from "./types.js";

type Corpus = Record<Ecosystem, string[]>;

const corpus = loadDataset<Corpus>("hallucinations.json");

export function inCorpus(ecosystem: Ecosystem, name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return corpus[ecosystem].some((entry) => entry.toLowerCase() === normalized);
}
