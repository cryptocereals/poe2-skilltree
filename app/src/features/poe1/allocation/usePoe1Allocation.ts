import { useCallback, useEffect, useMemo, useState } from "react";
import type { Poe1TreeNode, ParsedPoe1Tree } from "../types";
import {
  clearPoe1Allocation,
  clearPoe1MasteryChoice,
  choosePoe1MasteryEffect,
  clickPoe1Node,
  createPoe1AllocationState,
  getPoe1ActiveNodeKeys,
  reconcilePoe1Allocation,
  removePoe1Mastery,
  selectPoe1Ascendancy,
  selectPoe1Class,
} from "./model.mjs";
import type { Poe1AllocationState } from "./model.mjs";

type StateUpdate = (state: Poe1AllocationState) => Poe1AllocationState;

export function usePoe1Allocation(
  datasetId: string,
  tree: ParsedPoe1Tree | null,
) {
  const [storedState, setStoredState] = useState(() =>
    createPoe1AllocationState(datasetId),
  );
  const state = useMemo(
    () =>
      storedState.datasetId === datasetId
        ? storedState
        : createPoe1AllocationState(datasetId),
    [storedState, datasetId],
  );

  useEffect(() => {
    setStoredState((current) => {
      if (current.datasetId !== datasetId) {
        return createPoe1AllocationState(datasetId);
      }
      return tree ? reconcilePoe1Allocation(tree, current) : current;
    });
  }, [datasetId, tree]);

  const update = useCallback(
    (updateState: StateUpdate) => {
      setStoredState((current) => {
        const base =
          current.datasetId === datasetId
            ? current
            : createPoe1AllocationState(datasetId);
        return updateState(base);
      });
    },
    [datasetId],
  );

  const selectClass = useCallback(
    (classIndex: number | null) => {
      if (classIndex != null && !tree?.classStart.has(classIndex)) return;
      update((current) => selectPoe1Class(current, classIndex));
    },
    [tree, update],
  );

  const selectAscendancy = useCallback(
    (ascendancyId: string | null) => {
      if (!tree) return;
      update((current) =>
        selectPoe1Ascendancy(current, ascendancyId, tree),
      );
    },
    [tree, update],
  );

  const pickNode = useCallback(
    (node: Poe1TreeNode | null) => {
      if (!tree) return;
      update((current) => clickPoe1Node(tree, current, node));
    },
    [tree, update],
  );

  const chooseMasteryEffect = useCallback(
    (nodeKey: string, effectId: number) => {
      if (!tree) return;
      update((current) =>
        choosePoe1MasteryEffect(tree, current, nodeKey, effectId),
      );
    },
    [tree, update],
  );

  const clearMasteryChoice = useCallback(
    (nodeKey: string) => {
      if (!tree) return;
      update((current) => clearPoe1MasteryChoice(tree, current, nodeKey));
    },
    [tree, update],
  );

  const removeMastery = useCallback(
    (nodeKey: string) => {
      if (!tree) return;
      update((current) => removePoe1Mastery(tree, current, nodeKey));
    },
    [tree, update],
  );

  const clear = useCallback(() => {
    update(clearPoe1Allocation);
  }, [update]);

  const activeNodeKeys = useMemo(
    () => getPoe1ActiveNodeKeys(tree, state),
    [tree, state],
  );

  return {
    state,
    activeNodeKeys,
    selectClass,
    selectAscendancy,
    pickNode,
    chooseMasteryEffect,
    clearMasteryChoice,
    removeMastery,
    clear,
  };
}
