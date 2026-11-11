import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Camera } from "../../lib/camera";
import type { BuildAction } from "../../lib/buildState";
import type { ParsedTree, TreeNode } from "../../types";
import type { FocusTarget } from "./types";

interface Inputs {
  camera: Camera;
  tree: ParsedTree | null;
  selectedClass: number | null;
  dispatch: Dispatch<BuildAction>;
  setFocusKey: Dispatch<SetStateAction<string | null>>;
}

export function useTreeNavigation({
  camera,
  tree,
  selectedClass,
  dispatch,
  setFocusKey,
}: Inputs) {
  const nonce = useRef(0);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  const goTo = useCallback((x: number, y: number, zoom?: number) => {
    nonce.current++;
    setFocusTarget({ x, y, zoom, nonce: nonce.current });
  }, []);

  const resetView = useCallback(() => {
    const bounds = tree?.bounds;
    if (!bounds) return;
    const fit =
      Math.min(
        camera.vw / (bounds.maxX - bounds.minX),
        camera.vh / (bounds.maxY - bounds.minY),
      ) * 0.92;
    goTo((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, fit);
  }, [camera, tree, goTo]);

  const selectClass = useCallback(
    (index: number | null) => {
      dispatch({ type: "selectClass", idx: index });
      const start = index != null && tree ? tree.classStart.get(index) : null;
      if (start) goTo(start.x, start.y, 0.13);
      else resetView();
    },
    [dispatch, tree, goTo, resetView],
  );

  const selectAsc = useCallback(
    (id: string | null) => {
      dispatch({ type: "selectAsc", id });
      if (!id || !tree) {
        resetView();
        return;
      }

      const box = tree.ascBox.get(id);
      if (!box) {
        goTo(0, 0, 0.4);
        return;
      }
      const width = box.maxX - box.minX;
      const height = box.maxY - box.minY;
      const zoom = Math.min(camera.vw / width, camera.vh / height) * 0.75;
      goTo(0, 0, Math.min(zoom, 0.6));
    },
    [dispatch, tree, camera, goTo, resetView],
  );

  const pickSearch = useCallback(
    (node: TreeNode) => {
      setFocusKey(node.key);
      goTo(node.x, node.y, 0.6);
    },
    [setFocusKey, goTo],
  );

  return { focusTarget, goTo, resetView, selectClass, selectAsc, pickSearch };
}
