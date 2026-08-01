import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HOOK_NAME = "pre-commit";
const MARKER = "slopguard scan";
const BLOCK_EXIT = "2";

const HOOK_SCRIPT = `#!/bin/sh
# installed by slopguard — remove with: slopguard unhook
command -v slopguard >/dev/null 2>&1 || exit 0

slopguard scan
[ $? = ${BLOCK_EXIT} ] && exit 1
exit 0
`;

export function installGitHook(directory: string = process.cwd()): number {
  const path = hookPath(directory);
  if (!path) {
    console.error("not a git repository");
    return 1;
  }

  if (existsSync(path) && !isOurs(path)) {
    console.error(`a pre-commit hook already exists at ${path}`);
    console.error(`Add this line to it instead:  ${MARKER} || [ $? != ${BLOCK_EXIT} ]`);
    return 1;
  }

  writeFileSync(path, HOOK_SCRIPT);
  chmodSync(path, 0o755);
  console.log(`Installed pre-commit hook at ${path}.`);
  console.log("Commits are refused when a dependency is blocked; warnings are printed but allowed.");
  return 0;
}

export function uninstallGitHook(directory: string = process.cwd()): number {
  const path = hookPath(directory);
  if (!path || !existsSync(path)) {
    console.log("No slopguard pre-commit hook installed.");
    return 0;
  }

  if (!isOurs(path)) {
    console.error(`${path} was not installed by slopguard — leaving it alone`);
    return 1;
  }

  rmSync(path);
  console.log(`Removed ${path}.`);
  return 0;
}

function hookPath(directory: string): string | null {
  const found = spawnSync("git", ["rev-parse", "--git-path", "hooks"], {
    cwd: resolve(directory),
    encoding: "utf8",
  });
  if (found.status !== 0) return null;

  return join(resolve(directory), found.stdout.trim(), HOOK_NAME);
}

function isOurs(path: string): boolean {
  try {
    return readFileSync(path, "utf8").includes(MARKER);
  } catch {
    return false;
  }
}
