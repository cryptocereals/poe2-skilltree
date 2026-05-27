import { useEffect, useState } from "react";

// Gem/item name lists for the planner's autocomplete. Bundled at build time
// from poe2db (their CDN has no CORS for third-party origins, so the browser
// can't read it directly); we load the same-origin snapshot and session-cache it.

/** A skill or support gem entry. `id` is the metadata leaf (e.g. "SkillGemEarthquake");
 *  null for templated placeholder entries like "Companion: {0}". */
export interface GemEntry {
  name: string;
  id: string | null;
}

export interface PoeDb {
  uniques: string[];
  skillGems: GemEntry[];
  supportGems: GemEntry[];
}

/** Build a name→id lookup map for one gem list. Only entries with non-null ids are included. */
export function gemIdMap(gems: GemEntry[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of gems) if (g.id) m.set(g.name, g.id);
  return m;
}

/** Build an id→name reverse lookup map. */
export function gemNameMap(gems: GemEntry[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of gems) if (g.id) m.set(g.id, g.name);
  return m;
}

const EMPTY: PoeDb = { uniques: [], skillGems: [], supportGems: [] };
let mem: PoeDb | null = null;
let inflight: Promise<PoeDb> | null = null;

/** Normalise a raw entry from the JSON (string legacy or {name,id} object). */
function normaliseGem(entry: unknown): GemEntry {
  if (typeof entry === "string") return { name: entry, id: null };
  const e = entry as { name?: string; id?: string | null };
  return { name: e.name ?? "", id: e.id ?? null };
}

// Loaded from a same-origin static file (browser HTTP-caches it), deduped
// in-memory for the session — no extra localStorage layer needed.
export function loadPoeDb(): Promise<PoeDb> {
  if (mem) return Promise.resolve(mem);
  if (!inflight) {
    inflight = fetch(`${import.meta.env.BASE_URL}data/poe2db.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ uniques?: unknown[]; skillGems?: unknown[]; supportGems?: unknown[] }>) : EMPTY))
      .then((d) => {
        mem = {
          uniques: (d.uniques ?? []).map(String),
          skillGems: (d.skillGems ?? []).map(normaliseGem),
          supportGems: (d.supportGems ?? []).map(normaliseGem),
        };
        return mem;
      })
      .catch(() => EMPTY);
  }
  return inflight;
}

/** React hook: returns the lists (empty until loaded). */
export function usePoeDb(): PoeDb {
  const [db, setDb] = useState<PoeDb>(mem ?? EMPTY);
  useEffect(() => {
    let on = true;
    loadPoeDb().then((d) => on && setDb(d));
    return () => {
      on = false;
    };
  }, []);
  return db;
}
