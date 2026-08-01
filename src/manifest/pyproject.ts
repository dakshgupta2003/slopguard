import { isRegistrySpec, packageName } from "../spec.js";

const SECTION_HEADER = /^\[([^\]]+)\]/;
const ARRAY_ASSIGNMENT = /([\w-]+)\s*=\s*\[([^\]]*)\]/gs;
const QUOTED = /["']([^"']+)["']/g;
const TABLE_KEY = /^([\w.-]+)\s*=/;

const ARRAY_SECTIONS = [/^project\.optional-dependencies$/, /^dependency-groups$/];
const TABLE_SECTIONS = [/^tool\.poetry\.dependencies$/, /^tool\.poetry\.group\.[\w-]+\.dependencies$/];

const NON_PACKAGE_KEYS = ["python"];

// ponytail: section scanner, not a TOML parser — swap in a real one if nested tables ever matter
export function parsePyproject(content: string): string[] {
  const names: string[] = [];

  for (const [header, body] of sections(content)) {
    if (header === "project") {
      names.push(...arrayValues(body, "dependencies"));
    }
    if (ARRAY_SECTIONS.some((pattern) => pattern.test(header))) {
      names.push(...arrayValues(body));
    }
    if (TABLE_SECTIONS.some((pattern) => pattern.test(header))) {
      names.push(...tableKeys(body));
    }
  }

  return [...new Set(names.filter((name) => name.length > 0 && !NON_PACKAGE_KEYS.includes(name)))];
}

function sections(content: string): Map<string, string> {
  const found = new Map<string, string>();
  let header = "";
  let body: string[] = [];

  for (const line of content.split("\n")) {
    const match = SECTION_HEADER.exec(line.trim());
    if (!match) {
      body.push(line);
      continue;
    }
    if (header) found.set(header, body.join("\n"));
    header = match[1].trim();
    body = [];
  }
  if (header) found.set(header, body.join("\n"));

  return found;
}

function arrayValues(body: string, key?: string): string[] {
  const names: string[] = [];

  for (const [, name, contents] of body.matchAll(ARRAY_ASSIGNMENT)) {
    if (key && name !== key) continue;
    for (const [, spec] of contents.matchAll(QUOTED)) {
      if (isRegistrySpec(spec)) names.push(packageName("pip", spec));
    }
  }

  return names;
}

function tableKeys(body: string): string[] {
  return body
    .split("\n")
    .map((line) => TABLE_KEY.exec(line.trim())?.[1] ?? "")
    .filter(Boolean);
}
