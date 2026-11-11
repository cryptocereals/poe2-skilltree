interface Props {
  side: "left" | "right";
  expanded: boolean;
  label: string;
  controlsId: string;
  onClick: () => void;
}

export default function TreeSideToggle({
  side,
  expanded,
  label,
  controlsId,
  onClick,
}: Props) {
  const glyph =
    side === "left"
      ? expanded
        ? "‹"
        : "›"
      : expanded
        ? "›"
        : "‹";

  return (
    <button
      type="button"
      className={`edge-toggle ${side}`}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controlsId}
      onClick={onClick}
    >
      {glyph}
    </button>
  );
}
