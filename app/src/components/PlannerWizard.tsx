import { memo } from "react";

interface Props {
  steps: string[];
  step: number;
  setStep: (s: number) => void;
  onExport: () => void;
  onExit: () => void;
}

function PlannerWizard({ steps, step, setStep, onExport, onExit }: Props) {
  return (
    <div className="panel wizard">
      <button className="wizard__exit" onClick={onExit} title="Exit planner">
        ✕
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
