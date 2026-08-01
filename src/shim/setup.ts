import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { SHIMMED_MANAGERS } from "../ecosystems.js";
import { shimBinDir, slopguardHome } from "../paths.js";

const BLOCK_START = "# >>> slopguard >>>";
const BLOCK_END = "# <<< slopguard <<<";
const PATH_LINE = 'export PATH="$HOME/.slopguard/bin:$PATH"';
const MANAGED_CONFIGS = [".zshenv", ".zshrc", ".bashrc", ".bash_profile"];

export function init(): number {
  writeShims();
  console.log(`Installed shims for: ${SHIMMED_MANAGERS.join(", ")}`);
  console.log(`Location: ${shimBinDir()}`);

  clearManagedConfigs();

  const target = shellConfigPath();
  const content = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (existsSync(target)) copyFileSync(target, `${target}.slopguard-backup`);
  writeFileSync(target, `${content}\n${BLOCK_START}\n${PATH_LINE}\n${BLOCK_END}\n`);

  console.log(`\nAdded to ${target} (backup at ${target}.slopguard-backup):`);
  console.log(`  ${PATH_LINE}`);
  console.log("\nOpen a new terminal, then verify with:  which npm");
  return 0;
}

export function uninstall(): number {
  rmSync(slopguardHome(), { recursive: true, force: true });
  clearManagedConfigs();
  console.log("Removed shims and PATH entry. Open a new terminal to finish.");
  return 0;
}

function clearManagedConfigs(): void {
  for (const name of MANAGED_CONFIGS) {
    const path = join(homedir(), name);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    if (!content.includes(BLOCK_START)) continue;
    writeFileSync(path, stripBlock(content));
  }
}

function writeShims(): void {
  const dir = shimBinDir();
  mkdirSync(dir, { recursive: true });

  const cli = fileURLToPath(new URL("../cli.js", import.meta.url));
  for (const manager of SHIMMED_MANAGERS) {
    const target = join(dir, manager);
    writeFileSync(target, shimScript(dir, cli, manager));
    chmodSync(target, 0o755);
  }
}

// If node or the CLI has moved — an nvm upgrade, a relocated clone — the shim must
// still run the real manager, or every install on the machine stops working. Dropping
// our own directory from PATH first is what stops the fallback re-entering this shim.
function shimScript(dir: string, cli: string, manager: string): string {
  return [
    "#!/bin/sh",
    `if [ -x "${process.execPath}" ] && [ -f "${cli}" ]; then`,
    `  exec "${process.execPath}" "${cli}" shim ${manager} "$@"`,
    "fi",
    `PATH=$(printf %s "$PATH" | tr : '\\n' | grep -vxF "${dir}" | paste -sd: -)`,
    "export PATH",
    `exec ${manager} "$@"`,
    "",
  ].join("\n");
}

function shellConfigPath(): string {
  const shell = process.env.SHELL ?? "";
  return join(homedir(), shell.includes("bash") ? ".bashrc" : ".zshenv");
}

function stripBlock(content: string): string {
  const start = content.indexOf(BLOCK_START);
  const end = content.indexOf(BLOCK_END);
  if (start === -1 || end === -1) return content;
  return `${content.slice(0, start)}${content.slice(end + BLOCK_END.length)}`.replace(/\n{3,}/g, "\n\n");
}
