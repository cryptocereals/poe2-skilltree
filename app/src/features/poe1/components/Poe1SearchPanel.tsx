import TreePanel from "../../sharedTree/components/TreePanel";
import TreeSearchField from "../../sharedTree/components/TreeSearchField";
import type { Poe1TreeNode } from "../types";
import { nodeKindLabel } from "./nodeKindLabel";

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  results: Poe1TreeNode[];
  total: number;
  onSelectNode: (key: string) => void;
}

export default function Poe1SearchPanel({
  query,
  onQueryChange,
  results,
  total,
  onSelectNode,
}: Props) {
  const needle = query.trim().toLocaleLowerCase();
  const dotColor = (node: Poe1TreeNode) =>
    node.kind === "keystone"
      ? "#e0913f"
      : node.kind === "notable"
        ? "#d9c184"
        : node.kind === "jewel"
          ? "#5fd6cd"
          : node.kind === "mastery"
            ? "#c8a35a"
            : "#b7a982";

  return (
    <TreePanel
      as="section"
      className="search poe1-search-panel"
      aria-label="Search PoE1 passives"
    >
      <div className="panel__title">Search passives</div>
      <TreeSearchField
        value={query}
        onChange={onQueryChange}
        placeholder="Name or stat"
        ariaLabel="Search Path of Exile 1 passives"
        resultCount={needle ? total : undefined}
      />
      {needle && (
        <div className="poe1-search__results" aria-live="polite">
          {results.length === 0 ? (
            <p className="poe1-search__empty">No passives match this search.</p>
          ) : (
            results.map((node) => {
              const matchedStat = node.stats.find((stat) =>
                stat.toLocaleLowerCase().includes(needle),
              );
              return (
                <button
                  key={node.key}
                  type="button"
                  className="search__row poe1-search__row"
                  onClick={() => onSelectNode(node.key)}
                >
                  <span
                    className="search__dot poe1-search__dot"
                    style={{
                      background: dotColor(node),
                      boxShadow: `0 0 6px ${dotColor(node)}`,
                    }}
                    aria-hidden="true"
                  />
                  <span className="search__row-body">
                    <span className="search__row-head">
                      <span className="search__row-name">
                        {node.name || "Unnamed passive"}
                      </span>
                      <span className="search__row-kind">
                        {nodeKindLabel(node)}
                      </span>
                    </span>
                    {matchedStat && (
                      <span className="search__row-desc">{matchedStat}</span>
                    )}
                    {node.ascendancyName && (
                      <span className="poe1-search__ascendancy">
                        {node.ascendancyName}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
          {total > results.length && (
            <p className="poe1-search__more">
              Showing {results.length} of {total.toLocaleString()} matches. Refine
              the search to narrow the results.
            </p>
          )}
        </div>
      )}
    </TreePanel>
  );
}
