export interface CanvasBounds {
  readonly left: number;
  readonly top: number;
}

export interface CanvasRect extends CanvasBounds {
  readonly right: number;
  readonly bottom: number;
}

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export function toCanvasPoint(
  clientX: number,
  clientY: number,
  rect: CanvasBounds,
): CanvasPoint;

export function isCanvasPointInside(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
): boolean;
