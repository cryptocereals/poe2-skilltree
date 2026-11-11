export function getTooltipPosition({
  x,
  y,
  tooltipWidth,
  tooltipHeight,
  containerWidth,
  containerHeight,
  padding = 8,
  offset = 20,
}) {
  const maxLeft = Math.max(padding, containerWidth - tooltipWidth - padding);
  const maxTop = Math.max(padding, containerHeight - tooltipHeight - padding);
  return {
    left: Math.max(padding, Math.min(x + offset, maxLeft)),
    top: Math.max(padding, Math.min(y + offset, maxTop)),
  };
}
