import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE = "https://hugovk.github.io/top-pypi-packages/top-pypi-packages.min.json";
const LIMIT = 5000;

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`source returned ${res.status}`);

const body = (await res.json()) as { rows: { project: string }[] };
const packages = body.rows.slice(0, LIMIT).map((row) => row.project);
const target = fileURLToPath(new URL("../src/data/popular-pypi.json", import.meta.url));

writeFileSync(target, `${JSON.stringify({ packages })}\n`);
console.log(`wrote ${packages.length} packages to ${target}`);
