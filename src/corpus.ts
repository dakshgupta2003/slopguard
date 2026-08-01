import { loadDataset } from "./dataset.js";
import { normalize } from "./suggest/similarity.js";
import type { Ecosystem } from "./types.js";

type Corpus = Record<Ecosystem, string[]>;

const corpus = loadDataset<Corpus>("hallucinations.json");

// pypi treats llama-cpp, llama_cpp and llamacpp as one name, and a model that
// invents a package usually spells it the way the import reads
const index: Record<Ecosystem, Set<string>> = {
  pip: new Set(corpus.pip.map(normalize)),
  npm: new Set(corpus.npm.map(normalize)),
};

export function inCorpus(ecosystem: Ecosystem, name: string): boolean {
  return index[ecosystem].has(normalize(name.trim()));
}
