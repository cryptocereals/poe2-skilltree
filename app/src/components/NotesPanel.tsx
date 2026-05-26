import { memo, useRef, useState } from "react";
import MarkupText from "./MarkupText";

interface NoteNode {
  key: string;
  name: string;
  asc: boolean;
}

interface Props {
  nodes: NoteNode[];
  notes: Record<string, string>;
  setNote: (key: string, text: string) => void;
}

const FONTS: { tag: string; label: string; style: React.CSSProperties }[] = [
  { tag: "b", label: "B", style: { fontWeight: 700 } },
  { tag: "i", label: "I", style: { fontStyle: "italic" } },
  { tag: "u", label: "U", style: { textDecoration: "underline" } },
  { tag: "s", label: "S", style: { fontSize: "0.8em" } },
  { tag: "l", label: "L", style: { fontSize: "1.15em" } },
];

const SWATCHES: [string, string][] = [
  ["red", "#e5554e"],
  ["orange", "#e08a3c"],
  ["yellow", "#e6c84f"],
  ["green", "#5ec46a"],
  ["blue", "#5b9be0"],
  ["indigo", "#7a74e0"],
  ["violet", "#b573e0"],
  ["gold", "#e8c87e"],
  ["bronze", "#cd7f32"],
  ["silver", "#c8c8c8"],
  ["grey", "#9e978a"],
  ["white", "#f0ead9"],
];

function NotesPanel({ nodes, notes, setNote }: Props) {
  const [tab, setTab] = useState<"asc" | "main">("asc");
  const activeRef = useRef<HTMLTextAreaElement | null>(null);
  const asc = nodes.filter((n) => n.asc);
  const main = nodes.filter((n) => !n.asc);
  const shown = tab === "asc" ? asc : main;

  // Wrap the active textarea's selection (or insert) with <tag>{ … }.
  const apply = (tag: string) => {
    const ta = activeRef.current;
    if (!ta) return;
    const key = ta.dataset.key!;
    const v = notes[key] ?? "";
    const s = ta.selectionStart ?? v.length;
    const e = ta.selectionEnd ?? v.length;
    const sel = v.slice(s, e) || "text";
    const ins = `<${tag}>{ ${sel} }`;
    setNote(key, v.slice(0, s) + ins + v.slice(e));
    const caret = s + ins.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  };

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

      {/* formatting toolbar — select text in a note, then click to wrap it */}
      <div className="note-tools" onMouseDown={(e) => e.preventDefault()}>
        {FONTS.map((f) => (
          <button key={f.tag} style={f.style} title={f.tag} onClick={() => apply(f.tag)}>
            {f.label}
          </button>
        ))}
        <span className="note-tools__sep" />
        {SWATCHES.map(([name, hex]) => (
          <button
            key={name}
            className="note-swatch"
            style={{ background: hex }}
            title={name}
            onClick={() => apply(name)}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="step__hint">
          {tab === "asc"
            ? "Allocate ascendancy notables to annotate them."
            : "Allocate notables or keystones to annotate them."}
        </p>
      ) : (
        <div className="notes-list">
          {shown.map((n) => {
            const val = notes[n.key] ?? "";
            return (
              <div className="note-item" key={n.key}>
                <div className="note-item__name">{n.name}</div>
                <textarea
                  className="note-item__input"
                  data-key={n.key}
                  rows={2}
                  value={val}
                  placeholder="select text and use the toolbar, or type markup"
                  onFocus={(e) => (activeRef.current = e.currentTarget)}
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
