import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ForwardedRef,
} from "react";
import { cleanStat } from "../../../lib/text";
import TreeTooltipFrame from "../../sharedTree/components/TreeTooltipFrame";
import { DIFF_COLORS } from "../../sharedTree/nodeDiff.mjs";
import type { TreeDiffEntry, TreeVersionDiff } from "../../sharedTree/nodeDiff.mjs";
import type { Poe1NodeKind, Poe1TreeNode } from "../types";
import { getPoe1MasteryEffect } from "../allocation/model.mjs";
import { nodeKindLabel } from "./nodeKindLabel";

export interface Poe1HoverHandle {
  setHover: (node: Poe1TreeNode | null, x: number, y: number) => void;
}

interface Props {
  diff: TreeVersionDiff<Poe1NodeKind> | null;
  diffOn: boolean;
  selectedLabel: string;
  compareLabel: string;
  masteryChoices: Map<string, number>;
}

const DIFF_LABEL: Record<TreeDiffEntry<Poe1NodeKind>["status"], string> = {
  added: "Added in selected tree",
  removed: "Removed from selected tree",
  stats: "Stats changed",
  renamed: "Renamed",
  moved: "Moved",
};

const Poe1HoverLayer = forwardRef<Poe1HoverHandle, Props>(function Poe1HoverLayer(
  { diff, diffOn, selectedLabel, compareLabel, masteryChoices }: Props,
  ref: ForwardedRef<Poe1HoverHandle>,
) {
  const [hover, setHover] = useState<{
    node: Poe1TreeNode;
    x: number;
    y: number;
  } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      setHover: (node, x, y) =>
        setHover((previous) => {
          const previousKey = previous?.node.key ?? null;
          const nextKey = node?.key ?? null;
          if (previousKey === nextKey) return previous;
          return node ? { node, x, y } : null;
        }),
    }),
    [],
  );

  if (!hover) return null;

  const { node, x, y } = hover;
  const entry = diffOn ? diff?.byKey.get(node.key) : undefined;
  const moved = diffOn
    ? diff?.moved.find((candidate) => candidate.key === node.key)
    : undefined;
  const kindClass =
    node.kind === "keystone"
      ? "k-keystone"
      : node.kind === "notable"
        ? "k-notable"
        : "";
  const selectedMasteryEffect =
    node.kind === "mastery"
      ? getPoe1MasteryEffect(node, masteryChoices.get(node.key))
      : null;

  return (
    <TreeTooltipFrame x={x} y={y} className={kindClass}>
      <div className="tooltip__name">{node.name || "Unnamed passive"}</div>
      <div className="tooltip__kind">
        {nodeKindLabel(node)}
        {node.ascendancyName ? ` · ${node.ascendancyName}` : ""}
      </div>

      {node.stats.map((stat, index) => (
        <div className="tooltip__stat" key={`${node.key}-${index}`}>
          {cleanStat(stat)}
        </div>
      ))}
      {node.kind === "mastery" && (
        <div className="poe1-tooltip__mastery">
          <div className="poe1-tooltip__mastery-heading">
            {selectedMasteryEffect
              ? "Chosen mastery effect"
              : node.masteryEffects.length > 0
                ? "Choose a mastery effect"
                : "No mastery effects available"}
          </div>
          {selectedMasteryEffect ? (
            <>
              {selectedMasteryEffect.stats.map((stat, index) => (
                <div
                  className="tooltip__stat"
                  key={`${selectedMasteryEffect.effect}-${index}`}
                >
                  {cleanStat(stat)}
                </div>
              ))}
              {selectedMasteryEffect.reminderText?.map((reminder, index) => (
                <div
                  className="tooltip__stat poe1-tooltip__reminder"
                  key={`reminder-${index}`}
                >
                  {cleanStat(reminder)}
                </div>
              ))}
              {selectedMasteryEffect.stats.length === 0 &&
                !selectedMasteryEffect.reminderText?.length && (
                  <div className="tooltip__stat">
                    No stat or reminder text is available for this effect.
                  </div>
                )}
            </>
          ) : (
            <div className="tooltip__stat">
              {node.masteryEffects.length > 0
                ? "Click the mastery to open its choice picker."
                : "This tree dataset provides no selectable effects for this node."}
            </div>
          )}
        </div>
      )}
      {node.flavourText.length > 0 && (
        <div className="tooltip__flavour">{node.flavourText.join(" ")}</div>
      )}

      {(entry || moved) && (
        <div className="tooltip__diff">
          <div className="tooltip__kind">
            {selectedLabel} compared with {compareLabel}
          </div>
          {entry && (
            <>
              <span
                className="tooltip__diff-tag"
                style={{
                  background: `${DIFF_COLORS[entry.status]}22`,
                  color: DIFF_COLORS[entry.status],
                  border: `1px solid ${DIFF_COLORS[entry.status]}55`,
                }}
              >
                {DIFF_LABEL[entry.status]}
              </span>
              {entry.status === "renamed" && entry.oldName && (
                <div className="tooltip__old">{entry.oldName}</div>
              )}
              {entry.status === "stats" && (
                <>
                  {entry.oldStats?.map((stat, index) => (
                    <div className="tooltip__old" key={`old-${index}`}>
                      {cleanStat(stat)}
                    </div>
                  ))}
                  {entry.newStats?.map((stat, index) => (
                    <div className="tooltip__new" key={`new-${index}`}>
                      {cleanStat(stat)}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
          {moved && (
            <>
              <span
                className="tooltip__diff-tag"
                style={{
                  background: `${DIFF_COLORS.moved}22`,
                  color: DIFF_COLORS.moved,
                  border: `1px solid ${DIFF_COLORS.moved}55`,
                }}
              >
                {DIFF_LABEL.moved}
              </span>
              <div className="tooltip__stat">
                This passive changed position between tree versions.
              </div>
            </>
          )}
        </div>
      )}
    </TreeTooltipFrame>
  );
});

export default Poe1HoverLayer;
