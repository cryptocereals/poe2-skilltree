/**
 * Convert viewport coordinates from a pointer event into canvas-local pixels.
 * The tree camera uses canvas-local coordinates so it can be embedded in the
 * workspace without assuming the canvas starts at the top-left of the window.
 */
export function toCanvasPoint(clientX, clientY, rect) {
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function isCanvasPointInside(clientX, clientY, rect) {
  return (
    clientX >= rect.left &&
    clientX < rect.right &&
    clientY >= rect.top &&
    clientY < rect.bottom
  );
}
