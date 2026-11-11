import { useEffect, useRef, useState } from "react";
import type { Camera } from "../../../lib/camera";
import { getHoverTransition } from "../../sharedTree/hoverState.mjs";
import type { TreeVersionDiff } from "../../sharedTree/nodeDiff.mjs";
import {
  isCanvasPointInside,
  toCanvasPoint,
} from "../../tree/canvas/canvasCoordinates.mjs";
import {
  previewPoe1Allocation,
} from "../allocation/model.mjs";
import type { Poe1AllocationState } from "../allocation/model.mjs";
import type { ParsedPoe1Tree, Poe1NodeKind, Poe1TreeNode } from "../types";
import { pickPoe1Node, renderPoe1Tree } from "./renderTree";
import {
  loadPoe1Atlases,
  type LoadedPoe1Atlases,
} from "./spriteAtlases";

interface Props {
  tree: ParsedPoe1Tree;
  camera: Camera;
  allocation: Poe1AllocationState;
  activeNodeKeys: Set<string>;
  selectedNodeKey: string | null;
  focusNodeKey: string | null;
  assetRetry: number;
  onAssetError: (message: string | null) => void;
  onSelectNode: (key: string | null) => void;
  onPickNode: (node: Poe1TreeNode | null) => void;
  diff: TreeVersionDiff<Poe1NodeKind> | null;
  diffOn: boolean;
  onHover: (node: Poe1TreeNode | null, x: number, y: number) => void;
}

interface PointerPosition {
  x: number;
  y: number;
}

function distance(a: PointerPosition, b: PointerPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function pickNodeAt(
  props: Props,
  canvas: HTMLCanvasElement,
  atlases: LoadedPoe1Atlases | null,
  clientX: number,
  clientY: number,
): { node: Poe1TreeNode | null; x: number; y: number } {
  const point = toCanvasPoint(
    clientX,
    clientY,
    canvas.getBoundingClientRect(),
  );
  const node = pickPoe1Node(
    props.tree,
    props.camera.screenToWorldX(point.x),
    props.camera.screenToWorldY(point.y),
    atlases,
  );
  return { node, x: point.x, y: point.y };
}

export default function Poe1TreeCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  const atlasesRef = useRef<LoadedPoe1Atlases | null>(null);
  const [atlases, setAtlases] = useState<LoadedPoe1Atlases | null>(null);
  const hoverKey = useRef<string | null>(null);
  const previewKeys = useRef<Set<string>>(new Set());
  const tapSelection = useRef<string | null>(null);
  const pointers = useRef(new Map<number, PointerPosition>());
  const downPosition = useRef<PointerPosition | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const pinchDistance = useRef(0);

  propsRef.current = props;
  atlasesRef.current = atlases;
  props.camera.dirty = true;

  const setHoverTarget = (node: Poe1TreeNode | null, x: number, y: number) => {
    const transition = getHoverTransition(hoverKey.current, node);
    if (transition.changed) {
      hoverKey.current = transition.key;
      const preview =
        node &&
        previewPoe1Allocation(
          propsRef.current.tree,
          propsRef.current.allocation,
          node,
        );
      previewKeys.current = new Set(preview?.keys ?? []);
      propsRef.current.camera.dirty = true;
    }
    propsRef.current.onHover(node, x, y);
  };
  const refreshHoverAt = (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
  ) => {
    const current = propsRef.current;
    const hit = pickNodeAt(
      current,
      canvas,
      atlasesRef.current,
      clientX,
      clientY,
    );
    setHoverTarget(hit.node, hit.x, hit.y);
  };
  const clearHover = () => {
    tapSelection.current = null;
    previewKeys.current.clear();
    setHoverTarget(null, 0, 0);
  };

  useEffect(() => {
    hoverKey.current = null;
    pointers.current.clear();
    dragging.current = false;
    moved.current = false;
    pinchDistance.current = 0;
    previewKeys.current.clear();
    tapSelection.current = null;
    props.onHover(null, 0, 0);
    props.camera.dirty = true;
  }, [props.tree, props.camera, props.onHover]);

  useEffect(() => {
    const node = hoverKey.current
      ? props.tree.nodes.get(hoverKey.current) ?? null
      : null;
    const preview = node
      ? previewPoe1Allocation(props.tree, props.allocation, node)
      : null;
    previewKeys.current = new Set(preview?.keys ?? []);
    props.camera.dirty = true;
  }, [props.tree, props.allocation, props.camera]);

  useEffect(() => {
    let active = true;
    setAtlases(null);
    atlasesRef.current = null;
    props.onAssetError(null);
    void loadPoe1Atlases(
      props.tree.sprites,
      import.meta.env.BASE_URL,
      props.tree.versionId,
    )
      .then((loaded) => {
        if (!active) return;
        setAtlases(loaded);
        atlasesRef.current = loaded;
        props.camera.dirty = true;
      })
      .catch((error: unknown) => {
        if (!active) return;
        props.onAssetError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [props.tree, props.assetRetry, props.camera, props.onAssetError]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;
    const camera = props.camera;
    let raf = 0;
    let stopped = false;
    let firstFit = true;
    const viewport = { width: 0, height: 0 };
    const dpr = { value: 1 };

    const targetDpr = () => {
      const full = Math.min(window.devicePixelRatio || 1, 2);
      return camera.zoom < 0.1 ? Math.min(full, 1) : full;
    };
    const applyDpr = () => {
      canvas.width = Math.floor(viewport.width * dpr.value);
      canvas.height = Math.floor(viewport.height * dpr.value);
    };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const sizeChanged =
        Math.abs(viewport.width - bounds.width) > 0.1 ||
        Math.abs(viewport.height - bounds.height) > 0.1;
      const nextDpr = targetDpr();
      const densityChanged = Math.abs(dpr.value - nextDpr) > 0.01;
      viewport.width = bounds.width;
      viewport.height = bounds.height;
      dpr.value = nextDpr;
      if (sizeChanged || densityChanged) applyDpr();
      if (
        Math.abs(camera.vw - bounds.width) > 0.1 ||
        Math.abs(camera.vh - bounds.height) > 0.1
      ) {
        camera.setViewport(bounds.width, bounds.height);
      }
      if (firstFit) {
        firstFit = false;
        camera.fit(propsRef.current.tree.bounds);
        const selectedClass = propsRef.current.allocation.selectedClass;
        const start =
          selectedClass == null
            ? null
            : propsRef.current.tree.classStart.get(selectedClass);
        if (start) camera.centerOn(start.x, start.y, 0.42);
      }
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", resize);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toCanvasPoint(
        event.clientX,
        event.clientY,
        canvas.getBoundingClientRect(),
      );
      camera.zoomAt(
        Math.pow(1.0015, -event.deltaY * (event.ctrlKey ? 2.2 : 1)),
        point.x,
        point.y,
      );
      refreshHoverAt(canvas, event.clientX, event.clientY);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const loop = () => {
      if (stopped) return;
      const current = propsRef.current;
      const nextDpr = targetDpr();
      if (Math.abs(nextDpr - dpr.value) > 0.01) {
        dpr.value = nextDpr;
        applyDpr();
        camera.dirty = true;
      }
      if (camera.dirty) {
        camera.dirty = false;
        renderPoe1Tree(ctx, camera, current.tree, atlasesRef.current, {
          dpr: dpr.value,
          selectedNodeKey: current.selectedNodeKey,
          selectedClass: current.allocation.selectedClass,
          allocatedKeys: current.activeNodeKeys,
          previewKeys: previewKeys.current,
          hoverKey: hoverKey.current,
          diff: current.diff,
          diffOn: current.diffOn,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [props.camera, props.tree]);

  useEffect(() => {
    const current = propsRef.current;
    if (current.allocation.selectedClass == null) {
      current.camera.fit(current.tree.bounds);
      return;
    }
    const start = current.tree.classStart.get(
      current.allocation.selectedClass,
    );
    if (start) current.camera.centerOn(start.x, start.y, 0.42);
  }, [props.camera, props.tree, props.allocation.selectedClass]);

  useEffect(() => {
    if (!props.focusNodeKey) return;
    const node = props.tree.nodes.get(props.focusNodeKey);
    if (node) props.camera.centerOn(node.x, node.y, 0.46);
  }, [props.camera, props.focusNodeKey, props.tree]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events may not have an active pointer.
    }
    if (event.pointerType === "touch" || pointers.current.size > 0) {
      clearHover();
    }
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      dragging.current = true;
      moved.current = false;
      downPosition.current = point;
    } else if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      pinchDistance.current = distance(first, second);
      moved.current = true;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (previous) {
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }
    if (pointers.current.size >= 2) {
      const [first, second] = [...pointers.current.values()];
      const currentDistance = distance(first, second);
      if (pinchDistance.current > 0 && currentDistance > 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        const point = toCanvasPoint(
          (first.x + second.x) / 2,
          (first.y + second.y) / 2,
          rect,
        );
        props.camera.zoomAt(currentDistance / pinchDistance.current, point.x, point.y);
      }
      pinchDistance.current = currentDistance;
      moved.current = true;
      clearHover();
      return;
    }

    if (dragging.current && previous) {
      const start = downPosition.current;
      if (
        !moved.current &&
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
      ) {
        moved.current = true;
      }
      if (moved.current) {
        props.camera.panByScreen(
          event.clientX - previous.x,
          event.clientY - previous.y,
        );
        clearHover();
        event.currentTarget.classList.add("is-dragging");
      }
      return;
    }

    if (event.pointerType !== "touch") {
      refreshHoverAt(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
    }
  };

  const finishPointer = (
    event: React.PointerEvent<HTMLCanvasElement>,
    cancelled = false,
  ) => {
    if (cancelled) clearHover();
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchDistance.current = 0;
    if (pointers.current.size === 0) {
      event.currentTarget.classList.remove("is-dragging");
      const rect = event.currentTarget.getBoundingClientRect();
      const insideCanvas = isCanvasPointInside(
        event.clientX,
        event.clientY,
        rect,
      );
      let keepTouchInspection = false;
      if (!cancelled && dragging.current && !moved.current) {
        const point = toCanvasPoint(
          event.clientX,
          event.clientY,
          rect,
        );
        const node = pickPoe1Node(
          propsRef.current.tree,
          props.camera.screenToWorldX(point.x),
          props.camera.screenToWorldY(point.y),
          atlasesRef.current,
        );
        if (event.pointerType === "mouse") {
          props.onSelectNode(node?.key ?? null);
          props.onPickNode(node);
        } else if (!node) {
          props.onSelectNode(null);
          tapSelection.current = null;
        } else if (tapSelection.current === node.key) {
          tapSelection.current = null;
          props.onSelectNode(node.key);
          props.onPickNode(node);
          keepTouchInspection = true;
        } else {
          tapSelection.current = node.key;
          props.onSelectNode(node.key);
          keepTouchInspection = true;
        }
      }
      if (
        cancelled ||
        !insideCanvas ||
        (event.pointerType !== "mouse" && !keepTouchInspection)
      ) {
        clearHover();
      } else {
        refreshHoverAt(event.currentTarget, event.clientX, event.clientY);
      }
      dragging.current = false;
      moved.current = false;
      downPosition.current = null;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const centerX = props.camera.vw / 2;
    const centerY = props.camera.vh / 2;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      props.camera.zoomAt(1.3, centerX, centerY);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      props.camera.zoomAt(1 / 1.3, centerX, centerY);
    } else if (event.key === "0") {
      event.preventDefault();
      props.camera.fit(props.tree.bounds);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="poe1-tree__canvas"
      role="img"
      aria-label="Path of Exile 1 passive skill tree. Hover to preview a path, click to allocate or remove passives, drag to pan, and scroll or pinch to zoom. Touch: tap to inspect and tap again to allocate."
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={(event) => finishPointer(event, true)}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch" && pointers.current.size === 0) {
          refreshHoverAt(
            event.currentTarget,
            event.clientX,
            event.clientY,
          );
        }
      }}
      onPointerLeave={() => {
        if (pointers.current.size === 0) clearHover();
      }}
      onKeyDown={onKeyDown}
    />
  );
}
