const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

export function parsePackageJson(content: string): string[] {
  const manifest = JSON.parse(content) as Record<string, unknown>;

  return DEPENDENCY_FIELDS.flatMap((field) => {
    const section = manifest[field];
    return isNameMap(section) ? Object.keys(section) : [];
  });
}

function isNameMap(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
