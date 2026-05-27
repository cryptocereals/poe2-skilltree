import { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ParsedTree } from "../types";
import type { Tag } from "../lib/buildState";

interface Props {
  tree: ParsedTree;
  alloc: Map<string, Tag>;
  ascAlloc: Set<string>;
  selectedClass: number | null;
}

// ── stat parsing ─────────────────────────────────────────────────────────────

const NUM_RE = /[+-]?\d+(?:\.\d+)?/g;

/** Replace every number in `s` with "#" to produce a grouping key. */
function toTemplate(s: string): string {
  return s.replace(NUM_RE, "#");
}

/** Return the first number found in `s`, or null. */
function firstNumber(s: string): number | null {
  const m = s.match(NUM_RE);
  return m ? parseFloat(m[0]) : null;
}

// ── categories ───────────────────────────────────────────────────────────────

interface Category {
  label: string;
  color: string;
  match: RegExp;
}

const CATEGORIES: Category[] = [
  { label: "Attributes",    color: "#a8d8a8", match: /strength|dexterity|intelligence|attribute/i },
  { label: "Life",          color: "#e06060", match: /life|health/i },
  { label: "Mana",          color: "#5588cc", match: /\bmana\b/i },
  { label: "Energy Shield", color: "#6ab0e0", match: /energy shield/i },
  { label: "Armour",        color: "#c8a05a", match: /\barmour\b/i },
  { label: "Evasion",       color: "#88cc88", match: /evasion/i },
  { label: "Ward",          color: "#c0a0e0", match: /\bward\b/i },
  { label: "Resistances",   color: "#e09050", match: /resist|resistances/i },
  { label: "Fire Damage",   color: "#e05830", match: /fire damage|fire spell/i },
  { label: "Cold Damage",   color: "#60b0e0", match: /cold damage|cold spell/i },
  { label: "Lightning",     color: "#e0d030", match: /lightning damage|lightning spell/i },
  { label: "Chaos Damage",  color: "#c060c0", match: /chaos damage/i },
  { label: "Physical",      color: "#b8a070", match: /physical damage/i },
  { label: "Attack",        color: "#d0a050", match: /attack damage|attack speed|attacks/i },
  { label: "Spell",         color: "#9090e0", match: /spell damage|spell speed|spells/i },
  { label: "Critical",      color: "#ffe080", match: /critical/i },
  { label: "Speed",         color: "#80e0c0", match: /speed/i },
];

function categorise(template: string): Category | null {
  for (const cat of CATEGORIES) if (cat.match.test(template)) return cat;
  return null;
}

// ── aggregation ──────────────────────────────────────────────────────────────

interface StatRow {
  template: string;
  total: number;
  count: number;
  /** True when the number appears to be a % gain (template contains "%" before "#" or after) */
  isPct: boolean;
}

function aggregateStats(
  tree: ParsedTree,
  alloc: Map<string, Tag>,
  ascAlloc: Set<string>,
  selectedClass: number | null,
): StatRow[] {
  const classOv = selectedClass != null ? tree.classOverrides.get(selectedClass) ?? null : null;
  const totals = new Map<string, { total: number; count: number; isPct: boolean }>();

  const processKey = (key: string) => {
    const node = tree.nodes.get(key);
    if (!node) return;
    const stats = classOv?.get(key)?.stats ?? node.stats;
    for (const raw of stats) {
      const val = firstNumber(raw);
      if (val === null) continue; // purely descriptive, no number
      const tmpl = toTemplate(raw);
      const isPct = /%/.test(raw);
      const existing = totals.get(tmpl);
      if (existing) {
        existing.total += val;
        existing.count += 1;
      } else {
        totals.set(tmpl, { total: val, count: 1, isPct });
      }
    }
  };

  for (const [key] of alloc) processKey(key);
  for (const key of ascAlloc) processKey(key);

  return Array.from(totals.entries())
    .map(([template, { total, count, isPct }]) => ({ template, total, count, isPct }))
    .filter((r) => r.total !== 0);
}

// ── component ────────────────────────────────────────────────────────────────

function StatsPanelInner({ tree, alloc, ascAlloc, selectedClass }: Props) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const rows = useMemo(
    () => aggregateStats(tree, alloc, ascAlloc, selectedClass),
    [tree, alloc, ascAlloc, selectedClass],
  );

  // Group rows into categories + "Other"
  const groups = useMemo(() => {
    const buckets = new Map<string, { cat: Category | null; rows: StatRow[] }>();
    for (const row of rows) {
      const cat = categorise(row.template);
      const key = cat ? cat.label : "Other";
      if (!buckets.has(key)) buckets.set(key, { cat, rows: [] });
      buckets.get(key)!.rows.push(row);
    }
    // Sort within each bucket by |total| desc
    for (const b of buckets.values()) b.rows.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    // Return ordered: categories in CATEGORIES order, then Other
    const result: Array<{ label: string; color: string; rows: StatRow[] }> = [];
    for (const cat of CATEGORIES) {
      const b = buckets.get(cat.label);
      if (b && b.rows.length) result.push({ label: cat.label, color: cat.color, rows: b.rows });
    }
    const other = buckets.get("Other");
    if (other && other.rows.length)
      result.push({ label: "Other", color: "var(--ink-dim)", rows: other.rows });
    return result;
  }, [rows]);

  const totalNodes = alloc.size + ascAlloc.size;
  const visibleGroups = filter ? groups.filter((g) => g.label === filter) : groups;

  return (
    <motion.div
      className="panel stats-panel"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="stats-panel__header" onClick={() => setOpen((v) => !v)}>
        <span className="panel__title">Stats Summary</span>
        <span className="stats-panel__meta">{totalNodes} nodes</span>
        <span className={"stats-panel__chevron" + (open ? " open" : "")}>›</span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            {totalNodes === 0 ? (
              <div className="stats-panel__empty">Allocate nodes to see stat totals.</div>
            ) : (
              <>
                {/* category filter pills */}
                <div className="stats-panel__pills">
                  <button
                    className={"stats-panel__pill" + (!filter ? " active" : "")}
                    onClick={() => setFilter(null)}
                  >
                    All
                  </button>
                  {groups.map((g) => (
                    <button
                      key={g.label}
                      className={"stats-panel__pill" + (filter === g.label ? " active" : "")}
                      style={{ "--pill-color": g.color } as React.CSSProperties}
                      onClick={() => setFilter((f) => (f === g.label ? null : g.label))}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>

                <div className="stats-panel__groups">
                  {visibleGroups.map((g) => (
                    <div key={g.label} className="stats-panel__group">
                      <div className="stats-panel__group-label" style={{ color: g.color }}>
                        {g.label}
                      </div>
                      {g.rows.map((row) => (
                        <div key={row.template} className="stats-panel__row">
                          <span
                            className={"stats-panel__value" + (row.total > 0 ? " pos" : " neg")}
                          >
                            {row.total > 0 ? "+" : ""}
                            {Number.isInteger(row.total) ? row.total : row.total.toFixed(1)}
                            {row.isPct ? "%" : ""}
                          </span>
                          <span className="stats-panel__label">
                            {/* Show the template without the leading # value */}
                            {row.template.replace(/^#%?\s*/, "").replace(/^#\s*/, "")}
                          </span>
                          {row.count > 1 && (
                            <span className="stats-panel__count">×{row.count}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(StatsPanelInner);
