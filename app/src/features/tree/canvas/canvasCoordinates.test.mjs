import assert from "node:assert/strict";
import test from "node:test";
import {
  isCanvasPointInside,
  toCanvasPoint,
} from "./canvasCoordinates.mjs";

test("translates window pointer coordinates into an offset canvas", () => {
  assert.deepEqual(
    toCanvasPoint(340, 198, { left: 240, top: 68 }),
    { x: 100, y: 130 },
  );
});

test("preserves fractional coordinates and a full-window canvas origin", () => {
  assert.deepEqual(
    toCanvasPoint(18.5, 42.25, { left: 0, top: 0 }),
    { x: 18.5, y: 42.25 },
  );
  assert.deepEqual(
    toCanvasPoint(242.5, 96.25, { left: 224, top: 64 }),
    { x: 18.5, y: 32.25 },
  );
});

test("detects when a captured pointer is released outside the canvas", () => {
  const rect = { left: 120, top: 48, right: 520, bottom: 348 };
  assert.equal(isCanvasPointInside(120, 48, rect), true);
  assert.equal(isCanvasPointInside(519.5, 347.5, rect), true);
  assert.equal(isCanvasPointInside(520, 200, rect), false);
  assert.equal(isCanvasPointInside(40, 48, rect), false);
});
