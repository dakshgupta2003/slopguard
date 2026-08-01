import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkPackage } from "../engine.js";
import { ECOSYSTEM_ALIASES, resolveEcosystem } from "../ecosystems.js";
import { isAllowed } from "../allowlist.js";
import type { CheckResult } from "../types.js";

const TOOL_DESCRIPTION = `Verify that a package is real and safe before adding it to a project.

Call this for every dependency you are about to install, add to a manifest, or recommend — AI models routinely invent package names that do not exist, and attackers register those exact names as malware.

A "block" verdict means the package must not be installed: use one of the returned alternatives instead.`;

const ADVICE: Record<CheckResult["level"], string> = {
  allow: "Safe to install.",
  warn: "Do not install without verifying this with the user first.",
  block: "DO NOT install this package.",
};

export async function runMcpServer(): Promise<number> {
  const server = new McpServer({ name: "slopguard", version: packageVersion() });

  server.registerTool(
    "check_package",
    {
      title: "Check package safety",
      description: TOOL_DESCRIPTION,
      inputSchema: {
        ecosystem: z
          .enum(Object.keys(ECOSYSTEM_ALIASES) as [string, ...string[]])
          .describe("Package manager the dependency comes from"),
        name: z.string().min(1).describe("Package name, without any version specifier"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ ecosystem, name }) => ({ content: [{ type: "text", text: await report(ecosystem, name) }] }),
  );

  await server.connect(new StdioServerTransport());
  await new Promise<void>((resolve) => {
    server.server.onclose = resolve;
  });
  return 0;
}

async function report(ecosystemName: string, name: string): Promise<string> {
  const ecosystem = resolveEcosystem(ecosystemName);
  if (!ecosystem) return `Unknown ecosystem "${ecosystemName}".`;

  if (isAllowed(ecosystem, name)) return `${name} (${ecosystem}): allowed by this project's slopguard allowlist.`;

  const result = await checkPackage(ecosystem, name);
  const lines = [
    `${result.level.toUpperCase()} — ${result.name} (${result.ecosystem}), risk ${result.score}`,
    ADVICE[result.level],
  ];
  for (const signal of result.signals) lines.push(`- ${signal.reason}`);
  if (result.alternatives.length > 0) lines.push(`Use instead: ${result.alternatives.join(", ")}`);

  return lines.join("\n");
}

function packageVersion(): string {
  const manifest = new URL("../../package.json", import.meta.url);
  return (JSON.parse(readFileSync(manifest, "utf8")) as { version: string }).version;
}
