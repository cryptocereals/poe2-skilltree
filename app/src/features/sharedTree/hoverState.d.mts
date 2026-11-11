export function getHoverTransition(
  previousKey: string | null,
  node: { key: string } | null,
): { key: string | null; changed: boolean };
