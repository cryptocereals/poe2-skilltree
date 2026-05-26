import { memo } from "react";
import type { ClassInfo } from "../../types";

interface Props {
  name: string;
  author: string;
  description: string;
  setField: (field: "name" | "author" | "description", value: string) => void;
  classes: ClassInfo[];
  selectedClass: number | null;
  selectedAsc: string | null;
  newAscIds: Set<string>;
  onSelectClass: (idx: number | null) => void;
  onSelectAsc: (id: string | null) => void;
}

const isPlayable = (c: ClassInfo) => c.ascendancies.some((a) => a && a.name);

function DetailsStep({
  name,
  author,
  description,
  setField,
  classes,
  selectedClass,
  selectedAsc,
  newAscIds,
  onSelectClass,
  onSelectAsc,
}: Props) {
  const cls = selectedClass != null ? classes[selectedClass] : null;
  const ascendancies = cls ? cls.ascendancies.filter((a) => a && a.name) : [];

  return (
    <div className="panel step step--details">
      <div className="step__title">Build Details</div>

      <label className="field">
        <span className="field__label">Name</span>
        <input value={name} onChange={(e) => setField("name", e.target.value)} placeholder="My Build" autoFocus />
      </label>
      <label className="field">
        <span className="field__label">Author</span>
        <input value={author} onChange={(e) => setField("author", e.target.value)} placeholder="optional" />
      </label>
      <label className="field">
        <span className="field__label">Description</span>
        <textarea
          value={description}
          rows={2}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="optional"
        />
      </label>

      <div className="field__label" style={{ marginTop: 4 }}>
        Class
      </div>
      <div className="class-grid">
        {classes.map((c, i) => (
          <button
            key={c.name}
            className={"class-chip" + (selectedClass === i ? " active" : "") + (isPlayable(c) ? "" : " legacy")}
            onClick={() => onSelectClass(selectedClass === i ? null : i)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {ascendancies.length > 0 && (
        <div className="asc-row">
          {ascendancies.map((a) => (
            <div
              key={a.id}
              className={
                "asc-chip" + (selectedAsc === a.id ? " active" : "") + (newAscIds.has(a.id) ? " new" : "")
              }
              onClick={() => onSelectAsc(selectedAsc === a.id ? null : a.id)}
            >
              <span className="asc-chip__name">{a.name}</span>
              <span className="asc-chip__tag">{newAscIds.has(a.id) ? "NEW IN 0.5" : a.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(DetailsStep);
