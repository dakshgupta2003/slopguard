const SEPARATORS = ["-", "_", ".", ""];

const HOMOGLYPHS: Record<string, string[]> = {
  o: ["0"],
  "0": ["o"],
  l: ["1", "i"],
  i: ["1", "l"],
  "1": ["l", "i"],
  s: ["5", "z"],
  "5": ["s"],
  z: ["s"],
  m: ["rn"],
};

export function typoVariants(name: string): string[] {
  const variants = new Set<string>();

  for (let i = 0; i < name.length; i += 1) {
    variants.add(name.slice(0, i) + name.slice(i + 1));
    variants.add(name.slice(0, i) + name[i] + name.slice(i));

    for (const swap of HOMOGLYPHS[name[i]] ?? []) {
      variants.add(name.slice(0, i) + swap + name.slice(i + 1));
    }
    if (i + 1 < name.length) {
      variants.add(name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2));
    }
    for (const separator of SEPARATORS) {
      if (SEPARATORS.includes(name[i])) {
        variants.add(name.slice(0, i) + separator + name.slice(i + 1));
      } else if (i > 0) {
        variants.add(name.slice(0, i) + separator + name.slice(i));
      }
    }
  }

  variants.delete(name);
  variants.delete("");
  return [...variants];
}
