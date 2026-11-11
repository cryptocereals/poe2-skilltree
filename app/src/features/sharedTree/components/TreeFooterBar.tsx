import type { HTMLAttributes } from "react";
import TreePanel from "./TreePanel";

interface Props extends HTMLAttributes<HTMLDivElement> {}

export default function TreeFooterBar({ className, ...props }: Props) {
  return (
    <TreePanel
      as="div"
      className={["tree-footer-bar", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
