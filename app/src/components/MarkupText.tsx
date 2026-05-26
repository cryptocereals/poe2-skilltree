import { Fragment, type CSSProperties, type ReactNode } from "react";

// Renders PoE2 build "additional text" markup: <tag>{ content }, where tag is a
// font style (r b i u s m l) or a colour (named or rgb(...)). Tags may nest.

const FONT: Record<string, CSSProperties> = {
  r: {},
  b: { fontWeight: 700 },
  i: { fontStyle: "italic" },
  u: { textDecoration: "underline" },
  s: { fontSize: "0.82em" },
  m: { fontSize: "1em" },
  l: { fontSize: "1.3em" },
};

const COLOR: Record<string, string> = {
  red: "#e5554e",
  orange: "#e08a3c",
  yellow: "#e6c84f",
  green: "#5ec46a",
  blue: "#5b9be0",
  indigo: "#7a74e0",
  violet: "#b573e0",
  black: "#202020",
  white: "#f0ead9",
  grey: "#9e978a",
  bronze: "#cd7f32",
  silver: "#c8c8c8",
  gold: "#e8c87e",
};

function styleFor(tag: string): CSSProperties {
  if (tag in FONT) return FONT[tag];
  if (tag.startsWith("rgb(")) return { color: tag };
  if (tag in COLOR) return { color: COLOR[tag] };
  return {};
}

// matches `<tag>{` at the start of a slice; tag is rgb(...) or a word
const OPEN = /^<(rgb\([^)]*\)|[a-zA-Z]+)>\s*\{/;

function parse(text: string, keyBase = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let literalStart = 0;
  let n = 0;
  const flush = (end: number) => {
    if (end > literalStart) out.push(text.slice(literalStart, end));
  };
  while (i < text.length) {
    if (text[i] !== "<") {
      i++;
      continue;
    }
    const m = OPEN.exec(text.slice(i));
    if (!m) {
      i++;
      continue;
    }
    flush(i);
    const tag = m[1];
    let j = i + m[0].length; // index of first char after the opening brace
    let depth = 1;
    while (j < text.length && depth > 0) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      if (depth === 0) break;
      j++;
    }
    const inner = text.slice(i + m[0].length, j);
    out.push(
      <span key={`${keyBase}-${n++}`} style={styleFor(tag)}>
        {parse(inner, `${keyBase}-${n}`)}
      </span>
    );
    i = j + 1;
    literalStart = i;
  }
  flush(text.length);
  return out;
}

export default function MarkupText({ text }: { text: string }) {
  if (!text) return null;
  return <Fragment>{parse(text)}</Fragment>;
}
