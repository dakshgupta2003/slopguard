import { loadDataset } from "./dataset.js";
import type { Ecosystem } from "./types.js";

type Corpus = Record<Ecosystem, string[]>;

const SEPARATOR_RUN = /[-_.]+/g;

const corpus = loadDataset<Corpus>("hallucinations.json");

const index: Record<Ecosystem, Set<string>> = {
  pip: new Set(corpus.pip.map(canonical.bind(null, "pip"))),
  npm: new Set(corpus.npm.map(canonical.bind(null, "npm"))),
};

export function inCorpus(ecosystem: Ecosystem, name: string): boolean {
  return index[ecosystem].has(canonical(ecosystem, name));
}

// PEP 503: on PyPI a run of - _ . is one separator, so llama_cpp is llama-cpp.
// It is not deletable — chroma-db and chromadb are two different projects — and
// on npm the separators are distinct outright.
function canonical(ecosystem: Ecosystem, name: string): string {
  const lowered = name.trim().toLowerCase();
  return ecosystem === "pip" ? lowered.replace(SEPARATOR_RUN, "-") : lowered;
}
