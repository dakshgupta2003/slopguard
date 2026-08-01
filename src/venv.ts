import {
  chmodSync,
  existsSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// the trailing "t" covers free-threaded builds: python3.13t, pip3.13t
const PIP_BINARY = /^pip[\d.]*t?$/;
const PYTHON_BINARY = /^python[\d.]*t?$/;
const REAL_SUFFIX = ".slopguard-real";
const SHIM_MARKER = "SLOPGUARD_REAL_BIN";
const VENV_DIRECTORY_NAMES = [".venv", "venv", "env"];
const MAX_LINK_HOPS = 10;

// python is shimmed only to catch "python -m pip"; anything else leaves the
// shim after two string comparisons, before Node is ever started
const PYTHON_GUARD = '[ "$1" = "-m" ] && [ "$2" = "pip" ] && ';

interface Managed {
  name: string;
  manager: string;
  guard: string;
}

export function findVenv(explicit?: string): string | null {
  const candidates = explicit
    ? [explicit]
    : [process.env.VIRTUAL_ENV, ...VENV_DIRECTORY_NAMES.map((name) => join(process.cwd(), name))];

  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, "bin"))) return resolve(candidate);
  }
  return null;
}

export function protectVenv(venv: string): string[] {
  const cli = fileURLToPath(new URL("./cli.js", import.meta.url));
  const binDir = join(venv, "bin");
  const managed = managedBinaries(venv);

  // resolved before anything is renamed, while the symlinks still point somewhere
  const realNames = new Map(managed.map(({ name }) => [name, deepestInBin(binDir, name)]));
  const applied: string[] = [];

  for (const { name, manager, guard } of managed) {
    const target = join(binDir, name);
    if (isShim(target)) continue;

    const own = `${target}${REAL_SUFFIX}`;
    if (!existsSync(own)) renameSync(target, own);

    const real = join(binDir, `${realNames.get(name) ?? name}${REAL_SUFFIX}`);
    writeFileSync(target, shimScript(real, cli, manager, guard));
    chmodSync(target, 0o755);
    applied.push(name);
  }

  return applied;
}

export function unprotectVenv(venv: string): string[] {
  const restored: string[] = [];

  for (const { name } of managedBinaries(venv)) {
    const target = join(venv, "bin", name);
    const real = `${target}${REAL_SUFFIX}`;
    if (!existsSync(real)) continue;

    renameSync(real, target);
    restored.push(name);
  }

  return restored;
}

function managedBinaries(venv: string): Managed[] {
  try {
    return readdirSync(join(venv, "bin")).flatMap((entry) => {
      if (PIP_BINARY.test(entry)) return [{ name: entry, manager: "pip", guard: "" }];
      if (PYTHON_BINARY.test(entry)) return [{ name: entry, manager: "python", guard: PYTHON_GUARD }];
      return [];
    });
  } catch {
    return [];
  }
}

// venvs chain python -> python3 -> python3.9. The shim must hand off to the last
// link still inside bin/, because Python only recognises the venv when the
// interpreter it runs sits next to pyvenv.cfg.
function deepestInBin(binDir: string, name: string): string {
  let current = name;

  for (let hop = 0; hop < MAX_LINK_HOPS; hop += 1) {
    let link: string;
    try {
      link = readlinkSync(join(binDir, current));
    } catch {
      break;
    }

    const parent = dirname(link);
    if (parent !== "." && resolve(binDir, parent) !== binDir) break;

    const next = basename(link);
    if (next === current || !existsSync(join(binDir, next))) break;
    current = next;
  }

  return current;
}

function isShim(path: string): boolean {
  try {
    return readFileSync(path, "utf8").includes(SHIM_MARKER);
  } catch {
    return false;
  }
}

function shimScript(real: string, cli: string, manager: string, guard: string): string {
  return [
    "#!/bin/sh",
    `REAL="${real}"`,
    `if ${guard}[ -x "${process.execPath}" ] && [ -f "${cli}" ]; then`,
    `  ${SHIM_MARKER}="$REAL" exec "${process.execPath}" "${cli}" shim ${manager} "$@"`,
    "fi",
    'exec "$REAL" "$@"',
    "",
  ].join("\n");
}
