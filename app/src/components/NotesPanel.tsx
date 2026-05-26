import { memo } from "react";
import MarkupText from "./MarkupText";

interface Props {
  nodes: { key: string; name: string }[];
  notes: Record<string, string>;
  setNote: (key: string, text: string) => void;
}

// Per-passive notes (the .build additional_text) for allocated notables /
// keystones, with a live markup preview.
function NotesPanel({ nodes, notes, setNote }: Props) {
  return (
    <div className="panel notes-panel">
      <div className="panel__title">Passive Notes</div>
      {nodes.length === 0 ? (
        <p className="step__hint">Allocate notables or keystones to annotate them.</p>
      ) : (
        <div className="notes-list">
          {nodes.map((n) => {
            const val = notes[n.key] ?? "";
            return (
              <div className="note-item" key={n.key}>
                <div className="note-item__name">{n.name}</div>
                <input
                  className="note-item__input"
                  value={val}
                  placeholder="<gold>{ note } with <b>{ markup }"
                  onChange={(e) => setNote(n.key, e.target.value)}
                />
                {val && (
                  <div className="note-item__preview">
                    <MarkupText text={val} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(NotesPanel);
