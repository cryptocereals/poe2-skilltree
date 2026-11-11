export function getHoverTransition(previousKey, node) {
  const nextKey = node?.key ?? null;
  return {
    key: nextKey,
    changed: previousKey !== nextKey,
  };
}
