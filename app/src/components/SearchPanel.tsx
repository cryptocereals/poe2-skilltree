import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TreeNode, VersionDiff, NodeOverride } from "../types";
import { KIND_LABEL, cleanStat } from "../lib/text";
import { DIFF_COLORS } from "../lib/diff";

interface Props {
  query: string;
  setQuery: (q: string) => void;
  results: TreeNode[];
  total: number;
  diff: VersionDiff | null;
  diffOn: boolean;
  onPick: (n: TreeNode) => void;
  // class-specific overrides → show the name actually displayed on the tree
  overrides?: Map<string, NodeOverride> | null;
}

const KIND_COLOR: Record<string, string> = {
  keystone: "#e0913f",
  notable: "#d9c184",
  ascNotable: "#c9a9e0",
  jewel: "#5fd6cd",
  mastery: "#c8a35a",
};

function SearchPanel({ query, setQuery, results, total, diff, diffOn, onPick, overrides }: Props) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  // Collapse when query is cleared externally (e.g. Escape key)
  useEffect(() => {
    if (!query) setExpanded(false);
  }, [query]);

  const handleMouseLeave = () => {
    if (!query) setExpanded(false);
  };

  return (
    <motion.div
      layout
      className={"panel search" + (expanded ? "" : " search--compact")}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, layout: { duration: 0.2, ease: "easeInOut" } }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!expanded ? (
          <motion.button
            key="icon"
            className="search__icon-btn"
            title="Search passives, notables, keystones…"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </motion.button>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <div className="search__field">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search passives, notables, keystones…"
                autoComplete="off"
                spellCheck={false}
              />
              {query && <span className="search__count">{total}</span>}
            </div>

            {query && results.length > 0 && (
              <div className="search__results">
                {results.map((n) => {
                  const d = diffOn ? diff?.byKey.get(n.key) : undefined;
                  const dot = d ? DIFF_COLORS[d.status] : KIND_COLOR[n.kind] || "var(--ink-faint)";
                  const ov = overrides?.get(n.key);
                  const name = ov?.name ?? n.name;
                  const stats = ov?.stats ?? n.stats;
                  const q = query.trim().toLowerCase();
                  const hit = stats.find((s) => s.toLowerCase().includes(q)) ?? stats[0];
                  const desc = hit ? cleanStat(hit).split("\n")[0] : "";
                  return (
                    <div className="search__row" key={n.key} onClick={() => onPick(n)}>
                      <span className="search__dot" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
                      <span className="search__row-body">
                        <span className="search__row-head">
                          <span className="search__row-name">{name}</span>
                          <span className="search__row-kind">{KIND_LABEL[n.kind]}</span>
                        </span>
                        {desc && <span className="search__row-desc">{desc}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {query && results.length === 0 && (
              <div className="search__results" style={{ color: "var(--ink-faint)", padding: "8px" }}>
                No matches.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(SearchPanel);
