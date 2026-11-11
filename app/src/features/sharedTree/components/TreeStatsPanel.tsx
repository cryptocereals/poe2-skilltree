import { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TreeStatRow } from "../stats/aggregateTreeStats.mjs";

interface Props {
  rows: TreeStatRow[];
  totalNodes: number;
  verbatimGroups?: VerbatimStatGroup[];
  title?: string;
  description?: string;
  className?: string;
}

export interface VerbatimStatGroup {
  key: string;
  name: string;
  stats: string[];
  reminderText?: string[];
}

interface Category {
  label: string;
  color: string;
  match: RegExp;
}

const CATEGORIES: Category[] = [
  { label: "Attributes", color: "#a8d8a8", match: /strength|dexterity|intelligence|attribute/i },
  { label: "Life", color: "#e06060", match: /life|health/i },
  { label: "Mana", color: "#5588cc", match: /\bmana\b/i },
  { label: "Energy Shield", color: "#6ab0e0", match: /energy shield/i },
  { label: "Armour", color: "#c8a05a", match: /\barmour\b/i },
  { label: "Evasion", color: "#88cc88", match: /evasion/i },
  { label: "Ward", color: "#c0a0e0", match: /\bward\b/i },
  { label: "Resistances", color: "#e09050", match: /resist|resistances/i },
  { label: "Fire Damage", color: "#e05830", match: /fire damage|fire spell/i },
  { label: "Cold Damage", color: "#60b0e0", match: /cold damage|cold spell/i },
  { label: "Lightning", color: "#e0d030", match: /lightning damage|lightning spell/i },
  { label: "Chaos Damage", color: "#c060c0", match: /chaos damage/i },
  { label: "Physical", color: "#b8a070", match: /physical damage/i },
  { label: "Attack", color: "#d0a050", match: /attack damage|attack speed|attacks/i },
  { label: "Spell", color: "#9090e0", match: /spell damage|spell speed|spells/i },
  { label: "Critical", color: "#ffe080", match: /critical/i },
  { label: "Speed", color: "#80e0c0", match: /speed/i },
];

function categorise(template: string): Category | null {
  for (const category of CATEGORIES) {
    if (category.match.test(template)) return category;
  }
  return null;
}

function TreeStatsPanel({
  rows,
  totalNodes,
  verbatimGroups = [],
  title = "Stats Summary",
  description,
  className,
}: Props) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const groups = useMemo(() => {
    const buckets = new Map<
      string,
      { category: Category | null; rows: TreeStatRow[] }
    >();
    for (const row of rows) {
      const category = categorise(row.template);
      const key = category?.label ?? "Other";
      if (!buckets.has(key)) buckets.set(key, { category, rows: [] });
      buckets.get(key)!.rows.push(row);
    }

    for (const bucket of buckets.values()) {
      bucket.rows.sort((left, right) => Math.abs(right.total) - Math.abs(left.total));
    }

    const result: Array<{ label: string; color: string; rows: TreeStatRow[] }> =
      [];
    for (const category of CATEGORIES) {
      const bucket = buckets.get(category.label);
      if (bucket?.rows.length) {
        result.push({
          label: category.label,
          color: category.color,
          rows: bucket.rows,
        });
      }
    }
    const other = buckets.get("Other");
    if (other?.rows.length) {
      result.push({
        label: "Other",
        color: "var(--ink-dim)",
        rows: other.rows,
      });
    }
    return result;
  }, [rows]);

  const visibleGroups = filter
    ? groups.filter((group) => group.label === filter)
    : groups;

  return (
    <motion.div
      className={["panel", "stats-panel", className].filter(Boolean).join(" ")}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div
        className="stats-panel__header"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="panel__title">{title}</span>
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
            {description && (
              <div className="stats-panel__description" role="note">
                {description}
              </div>
            )}
            {totalNodes === 0 ? (
              <div className="stats-panel__empty">
                Allocate nodes to see stat totals.
              </div>
            ) : (
              <>
                <div className="stats-panel__pills">
                  <button
                    className={"stats-panel__pill" + (!filter ? " active" : "")}
                    onClick={() => setFilter(null)}
                  >
                    All
                  </button>
                  {groups.map((group) => (
                    <button
                      key={group.label}
                      className={
                        "stats-panel__pill" +
                        (filter === group.label ? " active" : "")
                      }
                      style={{ "--pill-color": group.color } as React.CSSProperties}
                      onClick={() =>
                        setFilter((current) =>
                          current === group.label ? null : group.label,
                        )
                      }
                    >
                      {group.label}
                    </button>
                  ))}
                </div>

                <div className="stats-panel__groups">
                  {visibleGroups.map((group) => (
                    <div key={group.label} className="stats-panel__group">
                      <div
                        className="stats-panel__group-label"
                        style={{ color: group.color }}
                      >
                        {group.label}
                      </div>
                      {group.rows.map((row) => (
                        <div key={row.template} className="stats-panel__row">
                          <span
                            className={
                              "stats-panel__value" +
                              (row.total > 0 ? " pos" : " neg")
                            }
                          >
                            {row.total > 0 ? "+" : ""}
                            {Number.isInteger(row.total)
                              ? row.total
                              : row.total.toFixed(1)}
                            {row.isPct ? "%" : ""}
                          </span>
                          <span className="stats-panel__label">
                            {row.template.replace(/^#%?\s*/, "").replace(/^#\s*/, "")}
                          </span>
                          {row.count > 1 && (
                            <span className="stats-panel__count">
                              ×{row.count}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                  {verbatimGroups.length > 0 && (
                    <div className="stats-panel__verbatim">
                      <div className="stats-panel__group-label">
                        Chosen mastery effects (verbatim)
                      </div>
                      {verbatimGroups.map((group) => (
                        <div
                          key={group.key}
                          className="stats-panel__verbatim-effect"
                        >
                          <div className="stats-panel__verbatim-name">
                            {group.name}
                          </div>
                          {group.stats.length > 0 ? (
                            <ul className="stats-panel__verbatim-list">
                              {group.stats.map((stat, index) => (
                                <li key={`${group.key}-stat-${index}`}>
                                  {stat}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {group.reminderText?.length ? (
                            <ul className="stats-panel__verbatim-reminders">
                              {group.reminderText.map((reminder, index) => (
                                <li key={`${group.key}-reminder-${index}`}>
                                  {reminder}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {group.stats.length === 0 &&
                            !group.reminderText?.length && (
                              <div className="stats-panel__verbatim-empty">
                                No stat or reminder text is available.
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(TreeStatsPanel);
