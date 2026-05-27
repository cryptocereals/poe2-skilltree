import { memo } from "react";

interface Props {
  steps: string[];
  step: number;
  setStep: (s: number) => void;
  onExport: () => void;
  onExit: () => void;
  minimized: boolean;
  onToggleMinimize: () => void;
}

function PlannerWizard({ steps, step, setStep, onExport, onExit, minimized, onToggleMinimize }: Props) {
  return (
    <div className="panel wizard">
      <button className="wizard__exit" onClick={onExit} title="Exit planner">
        ✕
      </button>

      <button
        className="wizard__minimize"
        onClick={onToggleMinimize}
        title={minimized ? "Expand panels" : "Collapse panels"}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {minimized
            ? <polyline points="6 9 12 15 18 9" />
            : <polyline points="6 15 12 9 18 15" />}
        </svg>
      </button>

      <div className="wizard__steps">
        {steps.map((label, i) => (
          <button
            key={label}
            className={"wizard__step" + (i === step ? " active" : i < step ? " done" : "")}
            onClick={() => setStep(i)}
          >
            <span className="wizard__num">{i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="wizard__nav">
        <button className="wizard__btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </button>
        {step < steps.length - 1 ? (
          <button className="wizard__btn primary" onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button className="wizard__btn primary" onClick={onExport}>
            Export .build
          </button>
        )}
      </div>

      <div className="wizard__io">
        <button className="wizard__btn ghost" onClick={onExport}>
          Export
        </button>
      </div>
    </div>
  );
}

export default memo(PlannerWizard);
