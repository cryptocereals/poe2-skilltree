function normalizeName(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

function ascendancyNames(ascendancy) {
  return [ascendancy?.id, ascendancy?.name]
    .map(normalizeName)
    .filter(Boolean);
}

export function findPoe1AscendancyStart(tree, classIndex, ascendancyId) {
  const ascendancies = tree?.classes?.[classIndex]?.ascendancies;
  if (!Array.isArray(ascendancies)) return null;

  const selected = ascendancies.find(
    (ascendancy) =>
      String(ascendancy?.id ?? ascendancy?.name ?? "") === String(ascendancyId),
  );
  if (!selected) return null;

  const names = new Set(ascendancyNames(selected));
  return (
    tree.nodeList.find(
      (node) =>
        node.kind === "ascendancyStart" &&
        names.has(normalizeName(node.ascendancyName)),
    ) ?? null
  );
}

export function identifyPoe1Ascendancy(tree, node) {
  const name = normalizeName(node?.ascendancyName);
  if (!name) return null;

  for (let classIndex = 0; classIndex < (tree?.classes?.length ?? 0); classIndex += 1) {
    const ascendancies = tree.classes[classIndex]?.ascendancies;
    if (!Array.isArray(ascendancies)) continue;
    const ascendancy = ascendancies.find((entry) =>
      ascendancyNames(entry).includes(name),
    );
    if (ascendancy) {
      return {
        classIndex,
        ascendancyId: String(ascendancy.id ?? ascendancy.name),
      };
    }
  }
  return null;
}
