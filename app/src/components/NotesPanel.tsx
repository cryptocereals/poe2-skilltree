import { memo, useState } from "react";
import MarkupEditor from "./MarkupEditor";

interface NoteNode {
  key: string;
  name: string;
  asc: boolean;
}

interface Props {
  nodes: NoteNode[];
  notes: Record<string, string>;
  setNote: (key: string, text: string) => void;
  focusKey?: string | null;
  focusName?: string | null;
}

function NotesPanel({ nodes, notes, setNote, focusKey, focusName }: Props) {
  // Single-node mode: triggered whenever focusKey prop is explicitly provided
  // (even null = nothing selected → render nothing)
  if (focusKey !== undefined) {
    if (focusKey == null) return null;
    const node = nodes.find((n) => n.key === focusKey);
    const name = node?.name ?? focusName ?? null;
    if (!name) return null;
    return (
      <div className="panel notes-panel notes-panel--focused">
        <div className="panel__title">{name}</div>
        <MarkupEditor value={notes[focusKey] ?? ""} onChange={(v) => setNote(focusKey, v)} />
      </div>
    );
  }

  // Full list mode (used outside planner or when nothing focused)
  const [tab, setTab] = useState<"asc" | "main">("asc");
  const asc = nodes.filter((n) => n.asc);
  const main = nodes.filter((n) => !n.asc);
  const shown = tab === "asc" ? asc : main;

  return (
    <div className="panel notes-panel">
      <div className="panel__title">Passive Notes</div>
      <div className="notes-tabs">
        <button className={tab === "asc" ? "active" : ""} onClick={() => setTab("asc")}>
          Ascendancy <span className="notes-tabs__n">{asc.length}</span>
        </button>
        <button className={tab === "main" ? "active" : ""} onClick={() => setTab("main")}>
          Passives <span className="notes-tabs__n">{main.length}</span>
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="step__hint">
          {tab === "asc"
            ? "Allocate ascendancy notables to annotate them."
            : "Allocate notables or keystones to annotate them."}
        </p>
      ) : (
        <div className="notes-list">
          {shown.map((n) => (
            <div className="note-item" key={n.key}>
              <div className="note-item__name">{n.name}</div>
              <MarkupEditor value={notes[n.key] ?? ""} onChange={(v) => setNote(n.key, v)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(NotesPanel);
