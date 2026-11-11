export interface TooltipPositionInput {
  x: number;
  y: number;
  tooltipWidth: number;
  tooltipHeight: number;
  containerWidth: number;
  containerHeight: number;
  padding?: number;
  offset?: number;
}

export function getTooltipPosition(
  input: TooltipPositionInput,
): { left: number; top: number };
