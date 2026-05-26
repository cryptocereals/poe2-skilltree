import { memo } from "react";
import type { BuildSkill } from "../../lib/buildFile";
import { usePoeDb } from "../../lib/poedb";

interface Props {
  skills: BuildSkill[];
  setSkills: (sk: BuildSkill[]) => void;
  version: string;
}

function SkillsStep({ skills, setSkills }: Props) {
  const db = usePoeDb();

  const patch = (i: number, fn: (s: BuildSkill) => BuildSkill) =>
    setSkills(skills.map((s, idx) => (idx === i ? fn(s) : s)));

  const addSkill = () => setSkills([...skills, { id: "", supports: [] }]);
  const removeSkill = (i: number) => setSkills(skills.filter((_, idx) => idx !== i));
  const addSupport = (i: number) => patch(i, (s) => ({ ...s, supports: [...(s.supports ?? []), ""] }));
  const setSupport = (i: number, j: number, v: string) =>
    patch(i, (s) => ({ ...s, supports: (s.supports ?? []).map((x, k) => (k === j ? v : x)) }));
  const removeSupport = (i: number, j: number) =>
    patch(i, (s) => ({ ...s, supports: (s.supports ?? []).filter((_, k) => k !== j) }));

  return (
    <div className="panel step step--skills">
      <div className="step__title">Skills</div>
      <datalist id="poedb-skills">
        {db.skillGems.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <datalist id="poedb-supports">
        {db.supportGems.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div className="skills-list">
        {skills.map((s, i) => (
          <div className="skill-card" key={i}>
            <div className="skill-card__head">
              <input
                className="skill-card__gem"
                list="poedb-skills"
                placeholder="skill gem…"
                value={s.id}
                onChange={(e) => patch(i, (x) => ({ ...x, id: e.target.value }))}
              />
              <button className="skill-card__rm" onClick={() => removeSkill(i)} title="Remove skill">
                ✕
              </button>
            </div>
            <div className="skill-supports">
              {(s.supports ?? []).map((sup, j) => (
                <div className="skill-support" key={j}>
                  <input
                    list="poedb-supports"
                    placeholder="support gem…"
                    value={sup}
                    onChange={(e) => setSupport(i, j, e.target.value)}
                  />
                  <button onClick={() => removeSupport(i, j)} title="Remove support">
                    –
                  </button>
                </div>
              ))}
              <button className="skill-support__add" onClick={() => addSupport(i)}>
                + support
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="step__add" onClick={addSkill}>
        + Add skill
      </button>
      {db.skillGems.length === 0 && (
        <p className="step__hint">Gem autocomplete unavailable — type names freely.</p>
      )}
    </div>
  );
}

export default memo(SkillsStep);
