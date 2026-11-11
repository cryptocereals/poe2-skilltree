import type { Camera } from "../../../lib/camera";
import { DIFF_COLORS } from "../../sharedTree/nodeDiff.mjs";
import type { TreeVersionDiff } from "../../sharedTree/nodeDiff.mjs";
import type { ParsedPoe1Tree, Poe1NodeKind, Poe1TreeNode } from "../types";
import type { LoadedPoe1Atlas, LoadedPoe1Atlases } from "./spriteAtlases";

const FALLBACK_RADIUS: Record<Poe1NodeKind, number> = {
  small: 50,
  notable: 76,
  keystone: 108,
  mastery: 48,
  jewel: 58,
  ascendancyStart: 62,
};

function frameKey(node: Poe1TreeNode, active: boolean): string {
  if (node.kind === "keystone") {
    return active ? "KeystoneFrameAllocated" : "KeystoneFrameUnallocated";
  }
  if (node.kind === "notable") {
    return active ? "NotableFrameAllocated" : "NotableFrameUnallocated";
  }
  if (node.kind === "jewel") {
    return active ? "JewelSocketAltActive" : "JewelSocketAltNormal";
  }
  if (node.kind === "ascendancyStart") {
    return active ? "PSSkillFrameHighlighted" : "PSSkillFrame";
  }
  return active ? "PSSkillFrameActive" : "PSSkillFrame";
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  atlas: LoadedPoe1Atlas | undefined,
  key: string | undefined,
  x: number,
  y: number,
  width?: number,
  height?: number,
): boolean {
  if (!atlas || !key) return false;
  const frame = atlas.frames[key];
  if (!frame || atlas.scale <= 0) return false;
  const worldWidth = width ?? frame.w / atlas.scale;
  const worldHeight = height ?? frame.h / atlas.scale;
  ctx.drawImage(
    atlas.image,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    x - worldWidth / 2,
    y - worldHeight / 2,
    worldWidth,
    worldHeight,
  );
  return true;
}

function iconAtlasNames(node: Poe1TreeNode, active: boolean): string[] {
  if (node.kind === "keystone") {
    return active
      ? ["keystoneActive", "notableActive", "normalActive"]
      : ["keystoneInactive", "notableInactive", "normalInactive"];
  }
  if (node.kind === "notable") {
    return active
      ? ["notableActive", "normalActive", "keystoneActive"]
      : ["notableInactive", "normalInactive", "keystoneInactive"];
  }
  if (node.kind === "mastery") {
    return active
      ? ["masteryActiveSelected", "mastery", "normalActive"]
      : ["masteryInactive", "mastery", "normalInactive"];
  }
  return active
    ? ["normalActive", "notableActive", "keystoneActive"]
    : ["normalInactive", "notableInactive", "keystoneInactive"];
}

function getIcon(
  node: Poe1TreeNode,
  active: boolean,
  atlases: LoadedPoe1Atlases | null,
): { atlas: LoadedPoe1Atlas; frame: string } | null {
  if (!atlases) return null;
  const icon = active
    ? node.activeIcon ?? node.icon ?? node.inactiveIcon
    : node.inactiveIcon ?? node.icon ?? node.activeIcon;
  if (!icon) return null;

  for (const atlasName of iconAtlasNames(node, active)) {
    const atlas = atlases[atlasName];
    if (atlas?.frames[icon]) return { atlas, frame: icon };
  }
  return null;
}

function drawFallbackNode(
  ctx: CanvasRenderingContext2D,
  node: Poe1TreeNode,
  x: number,
  y: number,
  active: boolean,
) {
  const radius = FALLBACK_RADIUS[node.kind] * 0.62;
  const color =
    node.kind === "keystone"
      ? "#d28d45"
      : node.kind === "notable"
        ? "#d7c18d"
        : node.kind === "jewel"
          ? "#52c5bd"
          : node.kind === "mastery"
            ? "#c8a35a"
            : "#aaa28e";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = active ? "#f5d894" : "#161820";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function frameRadius(node: Poe1TreeNode, atlases: LoadedPoe1Atlases | null): number {
  const atlas = atlases?.frame;
  const frame = atlas?.frames[frameKey(node, false)];
  return frame && atlas && atlas.scale > 0
    ? Math.max(FALLBACK_RADIUS[node.kind] * 0.45, frame.w / atlas.scale / 2)
    : FALLBACK_RADIUS[node.kind] * 0.62;
}

export interface Poe1RenderOptions {
  dpr: number;
  selectedNodeKey: string | null;
  selectedClass: number | null;
  allocatedKeys: Set<string>;
  previewKeys: Set<string>;
  hoverKey: string | null;
  diff: TreeVersionDiff<Poe1NodeKind> | null;
  diffOn: boolean;
}

export function renderPoe1Tree(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  tree: ParsedPoe1Tree,
  atlases: LoadedPoe1Atlases | null,
  options: Poe1RenderOptions,
) {
  const { dpr } = options;
  const width = camera.vw;
  const height = camera.vh;
  const zoom = Math.max(camera.zoom, 0.001);
  const cssPixels = (pixels: number) => pixels / zoom;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(
    dpr * zoom,
    0,
    0,
    dpr * zoom,
    dpr * (width / 2 - camera.x * zoom),
    dpr * (height / 2 - camera.y * zoom),
  );

  const margin = 260 / zoom;
  const minX = camera.x - width / (2 * zoom) - margin;
  const maxX = camera.x + width / (2 * zoom) + margin;
  const minY = camera.y - height / (2 * zoom) - margin;
  const maxY = camera.y + height / (2 * zoom) + margin;
  const inView = (x: number, y: number) =>
    x >= minX && x <= maxX && y >= minY && y <= maxY;

  const orbits = new Path2D();
  for (const group of tree.renderGroups) {
    if (!inView(group.x, group.y)) continue;
    for (const orbit of group.orbits) {
      const radius = tree.orbitRadii[orbit];
      if (!Number.isFinite(radius) || radius <= 0) continue;
      orbits.moveTo(group.x + radius, group.y);
      orbits.arc(group.x, group.y, radius, 0, Math.PI * 2);
    }
  }
  ctx.strokeStyle = "rgba(147, 131, 98, 0.17)";
  ctx.lineWidth = cssPixels(1);
  ctx.stroke(orbits);

  const connections = new Path2D();
  const allocatedConnections = new Path2D();
  const previewConnections = new Path2D();
  for (const edge of tree.renderEdges) {
    const from = tree.nodes.get(edge.fromKey);
    const to = tree.nodes.get(edge.toKey);
    if (!from || !to || (!inView(from.x, from.y) && !inView(to.x, to.y))) continue;

    if (
      options.allocatedKeys.has(edge.fromKey) &&
      options.allocatedKeys.has(edge.toKey)
    ) {
      allocatedConnections.moveTo(from.x, from.y);
      allocatedConnections.lineTo(to.x, to.y);
      continue;
    }

    const fromPreview = options.previewKeys.has(edge.fromKey);
    const toPreview = options.previewKeys.has(edge.toKey);
    if (
      (fromPreview || toPreview) &&
      (fromPreview || options.allocatedKeys.has(edge.fromKey)) &&
      (toPreview || options.allocatedKeys.has(edge.toKey))
    ) {
      previewConnections.moveTo(from.x, from.y);
      previewConnections.lineTo(to.x, to.y);
      continue;
    }

    connections.moveTo(from.x, from.y);
    connections.lineTo(to.x, to.y);
  }
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(167, 146, 104, 0.57)";
  ctx.lineWidth = cssPixels(1.7);
  ctx.stroke(connections);
  if (options.allocatedKeys.size > 0) {
    ctx.strokeStyle = "#f1d6a0";
    ctx.lineWidth = cssPixels(3.2);
    ctx.stroke(allocatedConnections);
  }
  if (options.previewKeys.size > 0) {
    ctx.save();
    ctx.strokeStyle = "#5fd6cd";
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = cssPixels(2.6);
    ctx.setLineDash([cssPixels(7), cssPixels(6)]);
    ctx.stroke(previewConnections);
    ctx.restore();
  }

  const diff = options.diffOn ? options.diff : null;
  if (diff) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = cssPixels(2);
    ctx.strokeStyle = DIFF_COLORS.removed;
    ctx.fillStyle = "rgba(239, 93, 93, 0.08)";
    ctx.setLineDash([cssPixels(9), cssPixels(6)]);
    for (const entry of diff.removed) {
      const ghost = entry.ghost;
      if (!ghost || !inView(ghost.x, ghost.y)) continue;
      const radius = FALLBACK_RADIUS[ghost.kind] * 0.72;
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ghost.x - radius * 0.42, ghost.y - radius * 0.42);
      ctx.lineTo(ghost.x + radius * 0.42, ghost.y + radius * 0.42);
      ctx.moveTo(ghost.x + radius * 0.42, ghost.y - radius * 0.42);
      ctx.lineTo(ghost.x - radius * 0.42, ghost.y + radius * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  }

  const classStart =
    options.selectedClass == null ? null : tree.classStart.get(options.selectedClass);
  const movedKeys = diff ? new Set(diff.moved.map((entry) => entry.key)) : null;
  const diffRings = new Map<string, Path2D>();
  const addDiffRing = (node: Poe1TreeNode, color: string, radius: number) => {
    let path = diffRings.get(color);
    if (!path) {
      path = new Path2D();
      diffRings.set(color, path);
    }
    path.moveTo(node.x + radius, node.y);
    path.arc(node.x, node.y, radius, 0, Math.PI * 2);
  };

  for (const node of tree.nodeList) {
    if (!inView(node.x, node.y)) continue;
    const active = options.allocatedKeys.has(node.key);
    const selected = options.selectedNodeKey === node.key;
    const preview = options.previewKeys.has(node.key);
    const icon = getIcon(node, active, atlases);
    if (icon) drawSprite(ctx, icon.atlas, icon.frame, node.x, node.y);
    else drawFallbackNode(ctx, node, node.x, node.y, active);

    const preferredFrame = frameKey(node, active);
    const drawnFrame = drawSprite(
      ctx,
      atlases?.frame,
      preferredFrame,
      node.x,
      node.y,
    );
    if (!drawnFrame && icon) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, frameRadius(node, atlases), 0, Math.PI * 2);
      ctx.strokeStyle = active ? "#f2d594" : "rgba(196, 171, 120, 0.65)";
      ctx.lineWidth = cssPixels(active ? 2.5 : 1);
      ctx.stroke();
    }

    if (classStart?.key === node.key) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, frameRadius(node, atlases) * 1.18, 0, Math.PI * 2);
      ctx.strokeStyle = "#e9c97d";
      ctx.lineWidth = cssPixels(2);
      ctx.stroke();
    }

    if (selected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, frameRadius(node, atlases) * 1.34, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(245, 239, 222, 0.95)";
      ctx.lineWidth = cssPixels(1.8);
      ctx.stroke();
    }

    if (preview) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, frameRadius(node, atlases) * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = "#5fd6cd";
      ctx.lineWidth = cssPixels(2);
      ctx.setLineDash([cssPixels(5), cssPixels(4)]);
      ctx.stroke();
      ctx.restore();
    }

    if (options.hoverKey === node.key && !active && !selected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, frameRadius(node, atlases) * 1.24, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(245, 239, 222, 0.88)";
      ctx.lineWidth = cssPixels(1.5);
      ctx.stroke();
    }

    const change = diff?.byKey.get(node.key);
    if (change && change.status !== "removed") {
      addDiffRing(node, DIFF_COLORS[change.status], frameRadius(node, atlases) * 1.55);
    }
    if (movedKeys?.has(node.key)) {
      addDiffRing(node, DIFF_COLORS.moved, frameRadius(node, atlases) * 1.9);
    }
  }

  for (const [color, path] of diffRings) {
    ctx.strokeStyle = color;
    ctx.lineWidth = cssPixels(2);
    ctx.stroke(path);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function pickPoe1Node(
  tree: ParsedPoe1Tree,
  worldX: number,
  worldY: number,
  atlases: LoadedPoe1Atlases | null,
): Poe1TreeNode | null {
  let best: Poe1TreeNode | null = null;
  let bestDistance = Infinity;
  for (const node of tree.nodeList) {
    const distance = (node.x - worldX) ** 2 + (node.y - worldY) ** 2;
    const radius = frameRadius(node, atlases);
    if (distance < radius * radius && distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}
