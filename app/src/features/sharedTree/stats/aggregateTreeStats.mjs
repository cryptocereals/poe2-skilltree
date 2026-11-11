const NUMBER_PATTERN = /[+-]?\d+(?:\.\d+)?/g;

function toTemplate(text) {
  return text.replace(NUMBER_PATTERN, "#");
}

function firstNumber(text) {
  const match = text.match(NUMBER_PATTERN);
  return match ? Number.parseFloat(match[0]) : null;
}

/** Sum numeric passive stats for the supplied allocated node keys. */
export function aggregateTreeStats(nodes, keys, overrides = null) {
  const totals = new Map();
  for (const key of keys) {
    const node = nodes.get(key);
    if (!node) continue;
    const stats = overrides?.get(key)?.stats ?? node.stats ?? [];
    for (const raw of stats) {
      const value = firstNumber(raw);
      if (value === null) continue;

      const template = toTemplate(raw);
      const existing = totals.get(template);
      if (existing) {
        existing.total += value;
        existing.count += 1;
      } else {
        totals.set(template, {
          total: value,
          count: 1,
          isPct: raw.includes("%"),
        });
      }
    }
  }

  return [...totals.entries()]
    .map(([template, value]) => ({ template, ...value }))
    .filter((row) => row.total !== 0);
}
