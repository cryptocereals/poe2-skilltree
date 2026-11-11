import TreePanel from "../../sharedTree/components/TreePanel";
import type { Poe1TreeNode } from "../types";
import { getPoe1MasteryEffect } from "../allocation/model.mjs";
import { nodeKindLabel } from "./nodeKindLabel";

interface Props {
  node: Poe1TreeNode | null;
  masteryEffectId?: number | null;
  masteryAllocated?: boolean;
  onOpenMastery: (nodeKey: string) => void;
}

export default function Poe1NodeDetails({
  node,
  masteryEffectId,
  masteryAllocated = false,
  onOpenMastery,
}: Props) {
  const selectedMasteryEffect =
    node?.kind === "mastery"
      ? getPoe1MasteryEffect(node, masteryEffectId)
      : null;

  return (
    <TreePanel
      as="aside"
      className="poe1-details-panel"
      aria-label="Selected node details"
      aria-live="polite"
      aria-atomic="true"
    >
      {node ? (
        <>
          <div className="panel__title">
            {nodeKindLabel(node)}
            {node.ascendancyName ? ` · ${node.ascendancyName}` : ""}
          </div>
          <h2 className="poe1-details__name">
            {node.name || "Unnamed passive"}
          </h2>
          {node.stats.length > 0 ? (
            <ul className="poe1-details__stats">
              {node.stats.map((stat, index) => (
                <li key={`${node.key}-${index}`}>{stat}</li>
              ))}
            </ul>
          ) : node.kind !== "mastery" ? (
            <p className="poe1-details__empty">
              No passive description is available.
            </p>
          ) : null}
          {node.kind === "mastery" && selectedMasteryEffect ? (
            <section
              className="poe1-details__mastery"
              aria-label="Chosen mastery effect"
            >
              <div className="poe1-details__mastery-label">
                Chosen mastery effect
              </div>
              {selectedMasteryEffect.stats.length > 0 ? (
                <ul className="poe1-details__mastery-stats">
                  {selectedMasteryEffect.stats.map((stat, index) => (
                    <li key={`${selectedMasteryEffect.effect}-${index}`}>
                      {stat}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="poe1-details__empty">
                  This effect has no stat text in the selected dataset.
                </p>
              )}
              {selectedMasteryEffect.reminderText?.length ? (
                <ul className="poe1-details__mastery-reminders">
                  {selectedMasteryEffect.reminderText.map((reminder, index) => (
                    <li key={`reminder-${index}`}>{reminder}</li>
                  ))}
                </ul>
              ) : null}
              <div className="poe1-details__mastery-actions">
                <button
                  type="button"
                  className="poe1-details__mastery-action"
                  onClick={() => onOpenMastery(node.key)}
                >
                  Change mastery effect
                </button>
              </div>
            </section>
          ) : node.kind === "mastery" ? (
            <section
              className="poe1-details__mastery"
              aria-label="Mastery effect selection"
            >
              <p className="poe1-details__empty" role="note">
                {node.masteryEffects.length === 0
                  ? "No mastery effects are available in this tree dataset."
                  : masteryAllocated
                    ? "This mastery is allocated without a selected effect."
                    : "Choose a mastery effect to allocate this one-point mastery."}
              </p>
              <div className="poe1-details__mastery-actions">
                <button
                  type="button"
                  className="poe1-details__mastery-action"
                  onClick={() => onOpenMastery(node.key)}
                >
                  {node.masteryEffects.length > 0
                    ? masteryAllocated
                      ? "Choose an effect"
                      : "Choose a mastery effect"
                    : "View mastery details"}
                </button>
              </div>
            </section>
          ) : null}
          {node.flavourText.length > 0 && (
            <p className="poe1-details__flavour">
              {node.flavourText.join(" ")}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="panel__title">Node details</div>
          <h2 className="poe1-details__name">Select a passive</h2>
          <p className="poe1-details__empty">
            Choose a node on the tree or search for a passive to read its official
            stats.
          </p>
        </>
      )}
    </TreePanel>
  );
}
