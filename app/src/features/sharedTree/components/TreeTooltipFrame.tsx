import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getTooltipPosition } from "../tooltipPosition.mjs";

interface Props {
  x: number;
  y: number;
  className?: string;
  children: ReactNode;
}

export default function TreeTooltipFrame({
  x,
  y,
  className = "",
  children,
}: Props) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x + 20, top: y + 20 });

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const updatePosition = () => {
      const container = tooltip.offsetParent as HTMLElement | null;
      const next = getTooltipPosition({
        x,
        y,
        tooltipWidth: tooltip.offsetWidth,
        tooltipHeight: tooltip.offsetHeight,
        containerWidth: container?.clientWidth ?? window.innerWidth,
        containerHeight: container?.clientHeight ?? window.innerHeight,
      });
      setPosition((previous) =>
        previous.left === next.left && previous.top === next.top
          ? previous
          : next,
      );
    };

    updatePosition();
    const container = tooltip.offsetParent;
    if (!container) return;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(container);
    observer.observe(tooltip);
    return () => observer.disconnect();
  }, [children, className, x, y]);

  return (
    <div
      ref={tooltipRef}
      className={`tooltip ${className}`.trim()}
      style={{ left: position.left, top: position.top }}
      role="tooltip"
    >
      {children}
    </div>
  );
}
