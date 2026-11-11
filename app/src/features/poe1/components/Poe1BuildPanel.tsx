import TreeFooterBar from "../../sharedTree/components/TreeFooterBar";

interface Props {
  mainPoints: number;
  ascendancyPoints: number;
  onClear: () => void;
}

export default function Poe1BuildPanel({
  mainPoints,
  ascendancyPoints,
  onClear,
}: Props) {
  return (
    <TreeFooterBar className="build poe1-build-panel">
      <div className="build__stat">
        <span className="build__label">Passives</span>
        <span className="build__val">{mainPoints}</span>
      </div>
      <div className="build__sep" />
      <div className="build__stat">
        <span className="build__label">Ascendancy</span>
        <span className="build__val">{ascendancyPoints}</span>
      </div>
      <div className="build__sep" />
      <span
        className="build__hint poe1-build__notice"
        title="Chosen mastery effects are shown as written; conditional values and enemy effects are not simulated. Quest rewards and build validity are not modeled."
      >
        Passive totals · no build validation
      </span>
      <button
        type="button"
        className="build__clear"
        onClick={onClear}
        title="Reset PoE1 allocation"
        aria-label="Reset PoE1 allocation"
        disabled={mainPoints + ascendancyPoints === 0}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>
    </TreeFooterBar>
  );
}
