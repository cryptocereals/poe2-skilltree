/**
 * A small shared gate for async version loads. Only the newest request is
 * allowed to publish state after a selection changes or a load is retried.
 */
export function createVersionRequestGate() {
  let current = 0;
  return Object.freeze({
    begin() {
      current += 1;
      return current;
    },
    isCurrent(requestId) {
      return requestId === current;
    },
    cancel(requestId) {
      if (requestId === current) current += 1;
    },
  });
}
