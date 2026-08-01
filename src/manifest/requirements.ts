import { isRegistrySpec, packageName } from "../spec.js";

export function parseRequirements(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.split("#")[0].trim())
    .filter((line) => line.length > 0 && !line.startsWith("-"))
    .filter(isRegistrySpec)
    .map((line) => packageName("pip", line))
    .filter((name) => name.length > 0);
}
