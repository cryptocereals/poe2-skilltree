import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { VersionDiff } from "../types";
import { DIFF_COLORS } from "../lib/diff";

interface Props {
  version: "0.5" | "0.4";
  setVersion: (v: "0.5" | "0.4") => void;
  diffOn: boolean;
  setDiffOn: (b: boolean) => void;
  diff: VersionDiff | null;
}

function VersionPanel({ version, setVersion, diffOn, setDiffOn, diff }: Props) {
  const [open, setOpen] = useState(false);
  const c = diff?.counts;
  return (
    <motion.div
      className="panel version"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <div className="panel__title panel__title--toggle" onClick={() => setOpen((v) => !v)}>
        Tree Version
        <span className={"panel__chevron" + (open ? " open" : "")}>›</span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="version-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div className="seg">
              <button className={version === "0.4" ? "active" : ""} onClick={() => setVersion("0.4")}>
                0.4.0
              </button>
              <button className={version === "0.5" ? "active" : ""} onClick={() => setVersion("0.5")}>
                0.5.0
              </button>
            </div>

            <div className="toggle" onClick={() => setDiffOn(!diffOn)}>
              <div>
                <div className="toggle__label">Highlight 0.5 changes</div>
                <div className="toggle__hint">Overlay what changed since 0.4</div>
              </div>
              <div className={"switch" + (diffOn ? " on" : "")} />
            </div>

            {diffOn && c && (
              <motion.div className="legend" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="legend__row">
                  <span className="legend__swatch" style={{ background: DIFF_COLORS.added, color: DIFF_COLORS.added }} />
                  New passive / notable
                  <span className="legend__count">{c.added}</span>
                </div>
                <div className="legend__row">
                  <span className="legend__swatch" style={{ background: DIFF_COLORS.stats, color: DIFF_COLORS.stats }} />
                  Reworked stats
                  <span className="legend__count">{c.stats}</span>
                </div>
                <div className="legend__row">
                  <span className="legend__swatch" style={{ background: DIFF_COLORS.renamed, color: DIFF_COLORS.renamed }} />
                  Renamed
                  <span className="legend__count">{c.renamed}</span>
                </div>
                <div className="legend__row">
                  <span className="legend__swatch" style={{ background: DIFF_COLORS.removed, color: DIFF_COLORS.removed }} />
                  Removed (ghosted)
                  <span className="legend__count">{c.removed}</span>
                </div>
                <div className="legend__row">
                  <span className="legend__swatch" style={{ background: DIFF_COLORS.moved, color: DIFF_COLORS.moved }} />
                  Moved
                  <span className="legend__count">{c.moved}</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(VersionPanel);
