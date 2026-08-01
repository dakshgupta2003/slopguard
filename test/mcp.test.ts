import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

const REQUESTS = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
];

test("advertises check_package over stdio", async () => {
  const child = spawn(process.execPath, ["--import", "tsx", CLI, "mcp"], { stdio: ["pipe", "pipe", "inherit"] });
  child.stdin.write(REQUESTS.map((request) => `${JSON.stringify(request)}\n`).join(""));

  let output = "";
  for await (const chunk of child.stdout) {
    output += chunk;
    if (output.includes('"id":2')) break;
  }
  child.stdin.end();
  child.kill();
  await once(child, "close");

  const listing = output
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .find((message) => message.id === 2);

  const [tool] = listing.result.tools;
  assert.equal(tool.name, "check_package");
  assert.deepEqual(Object.keys(tool.inputSchema.properties), ["ecosystem", "name"]);
});
