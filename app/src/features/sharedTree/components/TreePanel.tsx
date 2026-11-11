import { createElement, type HTMLAttributes } from "react";

type PanelElement = "aside" | "div" | "section";

interface Props extends HTMLAttributes<HTMLElement> {
  as?: PanelElement;
}

export default function TreePanel({
  as = "section",
  className,
  ...props
}: Props) {
  return createElement(as, {
    ...props,
    className: ["panel", "tree-panel", className].filter(Boolean).join(" "),
  });
}
