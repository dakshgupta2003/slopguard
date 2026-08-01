import { loadDataset } from "../dataset.js";
import { distance, normalize } from "../suggest/similarity.js";

const popular = loadDataset<{ packages: string[] }>("popular-pypi.json").packages;

const LONG_NAME_LENGTH = 10;
const SHORT_NAME_DISTANCE = 1;
const LONG_NAME_DISTANCE = 2;

export async function findPypiImpostorTarget(name: string): Promise<string | null> {
  if (popular.includes(name)) return null;

  const limit = normalize(name).length >= LONG_NAME_LENGTH ? LONG_NAME_DISTANCE : SHORT_NAME_DISTANCE;
  return popular.find((candidate) => distance(name, candidate) <= limit) ?? null;
}
