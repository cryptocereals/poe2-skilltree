import { memo } from "react";
import type { BuildSkill } from "../../lib/buildFile";

interface Props {
  skills: BuildSkill[];
  setSkills: (sk: BuildSkill[]) => void;
  version: string;
}

// Phase 1 placeholder — filled in Phase 3 (gem autocomplete from poe2db).
function SkillsStep(_props: Props) {
  return (
    <div className="panel step">
      <div className="step__title">Skills</div>
      <p className="step__hint">Skill gems with autocomplete — coming up.</p>
    </div>
  );
}

export default memo(SkillsStep);
