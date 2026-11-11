import { useEffect, useRef } from "react";
import {
  canChoosePoe1MasteryEffect,
  canUnlockPoe1Mastery,
  getPoe1MasteryEffect,
} from "../allocation/model.mjs";
import type { Poe1AllocationState } from "../allocation/model.mjs";
import type { ParsedPoe1Tree, Poe1TreeNode } from "../types";

interface Props {
  tree: ParsedPoe1Tree;
  state: Poe1AllocationState;
  node: Poe1TreeNode;
  onChoose: (effectId: number) => void;
  onClearChoice: () => void;
  onRemove: () => void;
  onClose: () => void;
}

function selectedElsewhere(
  tree: ParsedPoe1Tree,
  state: Poe1AllocationState,
  nodeKey: string,
  effectId: number,
) {
  for (const [otherKey, otherEffectId] of state.masteryChoices) {
    if (otherKey === nodeKey || otherEffectId !== effectId) continue;
    return tree.nodes.get(otherKey)?.name || "another mastery";
  }
  return null;
}

export default function Poe1MasteryChoiceDialog({
  tree,
  state,
  node,
  onChoose,
  onClearChoice,
  onRemove,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const allocated = state.mainAlloc.has(node.key);
  const selectedEffectId = allocated
    ? state.masteryChoices.get(node.key)
    : undefined;
  const selectedEffect = getPoe1MasteryEffect(node, selectedEffectId);
  const effects = Array.isArray(node.masteryEffects)
    ? node.masteryEffects
    : [];
  const unlocked = canUnlockPoe1Mastery(tree, state, node.key);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusables = () =>
      [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
    const initialFocus =
      dialog.querySelector<HTMLElement>("[data-autofocus='true']") ??
      focusables()[0];
    initialFocus?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialog.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [node.key]);

  return (
    <div
      className="poe1-mastery-dialog__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="poe1-mastery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="poe1-mastery-dialog-title"
        aria-describedby="poe1-mastery-dialog-description"
        tabIndex={-1}
      >
        <header className="poe1-mastery-dialog__header">
          <div>
            <div className="panel__title">Mastery choice</div>
            <h2
              className="poe1-mastery-dialog__title"
              id="poe1-mastery-dialog-title"
            >
              {node.name || "Unnamed mastery"}
            </h2>
          </div>
          <button
            type="button"
            className="poe1-mastery-dialog__icon-button"
            aria-label="Close mastery choices"
            onClick={onClose}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="poe1-mastery-dialog__body">
          <p
            className="poe1-mastery-dialog__intro"
            id="poe1-mastery-dialog-description"
          >
            Choose one effect for this mastery. It costs one passive point and
            requires an allocated notable in this cluster.
          </p>

          {effects.length === 0 ? (
            <p className="poe1-mastery-dialog__message" role="status">
              No mastery effects are available for this node in the selected
              tree dataset.
            </p>
          ) : (
            <>
              {!unlocked && (
                <p className="poe1-mastery-dialog__message" role="status">
                  Allocate a notable in this cluster before choosing a mastery
                  effect. Closing this dialog will not allocate the mastery.
                </p>
              )}
              {selectedEffect && (
                <div className="poe1-mastery-dialog__selection">
                  <span className="poe1-mastery-dialog__selection-label">
                    Current choice
                  </span>
                  {selectedEffect.stats.length > 0 ? (
                    <ul className="poe1-mastery-dialog__stats">
                      {selectedEffect.stats.map((stat, index) => (
                        <li key={`${selectedEffect.effect}-${index}`}>
                          {stat}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="poe1-mastery-dialog__muted">
                      This effect has no stat text in the selected dataset.
                    </p>
                  )}
                  {selectedEffect.reminderText?.length ? (
                    <ul className="poe1-mastery-dialog__reminders">
                      {selectedEffect.reminderText.map((reminder, index) => (
                        <li key={`selected-reminder-${index}`}>{reminder}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}

              <div className="poe1-mastery-dialog__choices">
                {effects.map((effect, index) => {
                  const takenBy = selectedElsewhere(
                    tree,
                    state,
                    node.key,
                    effect.effect,
                  );
                  const canChoose = canChoosePoe1MasteryEffect(
                    tree,
                    state,
                    node.key,
                    effect.effect,
                  );
                  const selected = selectedEffectId === effect.effect;
                  const unavailableReason = takenBy
                    ? `Already chosen for ${takenBy}.`
                    : !unlocked
                      ? "Allocate a notable in this cluster before choosing this effect."
                      : null;
                  const reasonId = `poe1-mastery-choice-reason-${index}`;
                  return (
                    <div
                      className="poe1-mastery-choice"
                      key={`${effect.effect}-${index}`}
                    >
                      <button
                        type="button"
                        className="poe1-mastery-choice__button"
                        aria-pressed={selected}
                        aria-describedby={
                          unavailableReason ? reasonId : undefined
                        }
                        disabled={!canChoose}
                        onClick={() => onChoose(effect.effect)}
                      >
                        <span className="poe1-mastery-choice__topline">
                          <span className="poe1-mastery-choice__label">
                            {selected ? "Selected effect" : `Effect ${index + 1}`}
                          </span>
                          {selected && (
                            <span className="poe1-mastery-choice__badge">
                              Current
                            </span>
                          )}
                        </span>
                        {effect.stats.length > 0 ? (
                          effect.stats.map((stat, statIndex) => (
                            <span
                              className="poe1-mastery-dialog__stat"
                              key={`${effect.effect}-stat-${statIndex}`}
                            >
                              {stat}
                            </span>
                          ))
                        ) : (
                          <span className="poe1-mastery-dialog__muted">
                            No stat text is available for this effect.
                          </span>
                        )}
                        {effect.reminderText?.length ? (
                          <span className="poe1-mastery-dialog__reminders">
                            {effect.reminderText.map((reminder, reminderIndex) => (
                              <span
                                className="poe1-mastery-dialog__reminder"
                                key={`${effect.effect}-reminder-${reminderIndex}`}
                              >
                                {reminder}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </button>
                      {unavailableReason && (
                        <span
                          className="poe1-mastery-choice__taken"
                          id={reasonId}
                        >
                          {unavailableReason}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <footer className="poe1-mastery-dialog__footer">
          {selectedEffect && (
            <button
              type="button"
              className="poe1-mastery-dialog__secondary"
              onClick={onClearChoice}
            >
              Clear choice
            </button>
          )}
          {allocated && (
            <button
              type="button"
              className="poe1-mastery-dialog__danger"
              onClick={onRemove}
            >
              Remove mastery
            </button>
          )}
          <button
            type="button"
            className="poe1-mastery-dialog__close"
            onClick={onClose}
            data-autofocus="true"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
