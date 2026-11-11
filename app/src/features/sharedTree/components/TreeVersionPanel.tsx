import { memo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DIFF_COLORS } from "../nodeDiff.mjs";

export interface TreeVersionOption {
  id: string;
  label: string;
}

export interface TreeVersionCounts {
  added: number;
  removed: number;
  stats: number;
  renamed: number;
  moved: number;
}

interface Props {
  versions: TreeVersionOption[];
  version: string;
  setVersion: (version: string) => void;
  compareOn: boolean;
  setCompareOn: (enabled: boolean) => void;
  compareVersion: string;
  setCompareVersion: (version: string) => void;
  compareOptions: TreeVersionOption[];
  selectedLabel: string;
  compareLabel: string;
  comparisonLoading: boolean;
  comparisonError: string | null;
  onRetryComparison: () => void;
  diffCounts: TreeVersionCounts | null;
  className?: string;
  title?: string;
  versionFieldLabel?: string;
  comparisonToggleLabel?: string;
  comparisonHint?: string;
  comparisonFieldLabel?: string;
  noComparisonLabel?: string;
  primaryLoading?: boolean;
  primaryError?: string | null;
  onRetryPrimary?: () => void;
  statusContent?: ReactNode;
}

function TreeVersionPanel({
  versions,
  version,
  setVersion,
  compareOn,
  setCompareOn,
  compareVersion,
  setCompareVersion,
  compareOptions,
  selectedLabel,
  compareLabel,
  comparisonLoading,
  comparisonError,
  onRetryComparison,
  diffCounts,
  className,
  title = "Tree version",
  versionFieldLabel = "Tree version",
  comparisonToggleLabel = "Compare with another version",
  comparisonHint = "Highlight what changed in this tree.",
  comparisonFieldLabel = "Compare with",
  noComparisonLabel = "No other tree versions are available.",
  primaryLoading = false,
  primaryError = null,
  onRetryPrimary,
  statusContent,
}: Props) {
  const [open, setOpen] = useState(true);
  const c = diffCounts;
  return (
    <motion.div
      className={["panel", "version", className].filter(Boolean).join(" ")}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <button
        type="button"
        className="panel__title panel__title--toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
        <span className={"panel__chevron" + (open ? " open" : "")}>›</span>
      </button>

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
            <label className="version__field">
              <span>{versionFieldLabel}</span>
              <select
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                disabled={versions.length === 0}
              >
                {versions.length === 0 ? (
                  <option value="">
                    {primaryLoading ? "Loading datasets…" : "No datasets available"}
                  </option>
                ) : (
                  versions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
            </label>

            {primaryLoading && (
              <div className="version__status" role="status" aria-live="polite">
                Loading {selectedLabel || "tree data"}…
              </div>
            )}

            {primaryError && (
              <div className="version__error" role="alert">
                <span>
                  Could not load {selectedLabel || "tree data"}: {primaryError}
                </span>
                <button type="button" onClick={onRetryPrimary}>
                  Retry
                </button>
              </div>
            )}

            {statusContent}

            <label className="toggle version__toggle">
              <span className="version__toggle-copy">
                <span className="toggle__label">
                  {comparisonToggleLabel}
                </span>
                <span className="toggle__hint">
                  {comparisonHint}
                </span>
              </span>
              <input
                type="checkbox"
                checked={compareOn}
                onChange={(event) => setCompareOn(event.target.checked)}
                disabled={compareOptions.length === 0}
              />
              <span
                className={"switch" + (compareOn ? " on" : "")}
                aria-hidden="true"
              />
            </label>

            {compareOptions.length === 0 && (
              <div className="version__status" role="status">
                {noComparisonLabel}
              </div>
            )}

            {compareOn && (
              <>
                <label className="version__field">
                <span>{comparisonFieldLabel}</span>
                  <select
                    value={compareVersion}
                    onChange={(event) => setCompareVersion(event.target.value)}
                  >
                    {compareOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {comparisonLoading && (
                  <div className="version__status" role="status" aria-live="polite">
                    Loading {compareLabel}…
                  </div>
                )}

                {comparisonError && (
                  <div className="version__error" role="alert">
                    <span>
                      Could not load {compareLabel}: {comparisonError}
                    </span>
                    <button type="button" onClick={onRetryComparison}>
                      Retry
                    </button>
                  </div>
                )}

                {!comparisonLoading && !comparisonError && !c && (
                  <div className="version__status" role="status">
                    Waiting for both tree versions to load.
                  </div>
                )}

                {c && (
                  <>
                    <div className="version__summary">
                      Changes in {selectedLabel} compared with {compareLabel}
                    </div>
                    {Object.values(c).some((count) => count > 0) ? (
                      <motion.div
                        className="legend"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="legend__row">
                          <span
                            className="legend__swatch"
                            style={{
                              background: DIFF_COLORS.added,
                              color: DIFF_COLORS.added,
                            }}
                          />
                          Added
                          <span className="legend__count">{c.added}</span>
                        </div>
                        <div className="legend__row">
                          <span
                            className="legend__swatch"
                            style={{
                              background: DIFF_COLORS.removed,
                              color: DIFF_COLORS.removed,
                            }}
                          />
                          Removed (ghosted)
                          <span className="legend__count">{c.removed}</span>
                        </div>
                        <div className="legend__row">
                          <span
                            className="legend__swatch"
                            style={{
                              background: DIFF_COLORS.stats,
                              color: DIFF_COLORS.stats,
                            }}
                          />
                          Stats changed
                          <span className="legend__count">{c.stats}</span>
                        </div>
                        <div className="legend__row">
                          <span
                            className="legend__swatch"
                            style={{
                              background: DIFF_COLORS.renamed,
                              color: DIFF_COLORS.renamed,
                            }}
                          />
                          Renamed
                          <span className="legend__count">{c.renamed}</span>
                        </div>
                        <div className="legend__row">
                          <span
                            className="legend__swatch"
                            style={{
                              background: DIFF_COLORS.moved,
                              color: DIFF_COLORS.moved,
                            }}
                          />
                          Moved
                          <span className="legend__count">{c.moved}</span>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="version__status">No differences found.</div>
                    )}
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(TreeVersionPanel);
