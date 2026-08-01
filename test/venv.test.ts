import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { protectVenv, unprotectVenv } from "../src/venv.js";

function fakeVenv(): string {
  const venv = mkdtempSync(join(tmpdir(), "slopguard-venv-"));
  const bin = join(venv, "bin");
  mkdirSync(bin);

  writeFileSync(join(bin, "python3.9"), "#!/bin/sh\n");
  symlinkSync("python3.9", join(bin, "python3"));
  symlinkSync("python3", join(bin, "python"));
  writeFileSync(join(bin, "pip"), "#!/bin/sh\n");

  return venv;
}

test("hands every python shim to the last interpreter inside bin", () => {
  const venv = fakeVenv();
  try {
    protectVenv(venv);

    const real = join(venv, "bin", "python3.9.slopguard-real");
    for (const name of ["python", "python3", "python3.9"]) {
      const shim = readFileSync(join(venv, "bin", name), "utf8");
      assert.match(shim, /shim python/, `${name} should route to the python shim`);
      assert.ok(shim.includes(`REAL="${real}"`), `${name} should exec ${real}, not a chained shim`);
    }
  } finally {
    rmSync(venv, { recursive: true, force: true });
  }
});

test("only pays for Node when the command is python -m pip", () => {
  const venv = fakeVenv();
  try {
    protectVenv(venv);
    const python = readFileSync(join(venv, "bin", "python"), "utf8");
    const pip = readFileSync(join(venv, "bin", "pip"), "utf8");

    assert.match(python, /\[ "\$1" = "-m" \] && \[ "\$2" = "pip" \] &&/);
    assert.doesNotMatch(pip, /"\$1" = "-m"/);
  } finally {
    rmSync(venv, { recursive: true, force: true });
  }
});

test("covers free-threaded builds and leaves lookalike tools alone", () => {
  const venv = fakeVenv();
  const bin = join(venv, "bin");
  writeFileSync(join(bin, "python3.13t"), "#!/bin/sh\n");
  writeFileSync(join(bin, "pip3.13t"), "#!/bin/sh\n");
  writeFileSync(join(bin, "pipx"), "#!/bin/sh\n");
  writeFileSync(join(bin, "python3-config"), "#!/bin/sh\n");

  try {
    const applied = protectVenv(venv);
    assert.ok(applied.includes("python3.13t"), "free-threaded python must be shimmed");
    assert.ok(applied.includes("pip3.13t"), "free-threaded pip must be shimmed");
    assert.ok(!applied.includes("pipx"), "pipx is not pip");
    assert.ok(!applied.includes("python3-config"), "python3-config is not an interpreter");
  } finally {
    rmSync(venv, { recursive: true, force: true });
  }
});

test("unprotect puts the original binaries and symlinks back", () => {
  const venv = fakeVenv();
  try {
    protectVenv(venv);
    unprotectVenv(venv);

    assert.equal(readlinkSync(join(venv, "bin", "python")), "python3");
    assert.equal(readlinkSync(join(venv, "bin", "python3")), "python3.9");
    assert.equal(readFileSync(join(venv, "bin", "python3.9"), "utf8"), "#!/bin/sh\n");
    assert.equal(readFileSync(join(venv, "bin", "pip"), "utf8"), "#!/bin/sh\n");
  } finally {
    rmSync(venv, { recursive: true, force: true });
  }
});
