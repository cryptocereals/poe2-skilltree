/**
 * Derives a metadata-leaf ID for every skill/support gem name in poe2db.json
 * and rewrites the file in-place.
 *
 * Derivation rule (per name N, prefix P):
 *  1. NFKD-normalise and strip diacritics  (Mjölner → Mjolner)
 *  2. Drop possessive 's / 's                (Atziri's Call → Atziri Call)
 *  3. Standalone Roman numerals → English   (III → Three, etc.)
 *  4. Keep [A-Za-z0-9]+ runs, PascalCase, concat
 *  5. id = P + Pascal
 *
 * Templated entries containing { } or : get id = null and are logged.
 * Full game path is NOT stored here; export code prepends Metadata/Items/Gems/.
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dir, "../public/data/poe2db.json");

const ROMAN = [
  ["IV", "Four"],
  ["III", "Three"],
  ["II", "Two"],
  ["I", "One"],
];

function stripDiacritics(s) {
  return s.normalize("NFKD").replace(/\p{Mn}/gu, "");
}

function deriveId(name, prefix) {
  // Templated placeholder — cannot derive a stable ID
  if (/[{}:]/.test(name)) return null;

  let n = stripDiacritics(name);
  // Drop possessive (right single quote or ASCII apostrophe)
  n = n.replace(/[\u2019']s\b/g, "");
  // Standalone Roman numerals (longest first to avoid I matching in III)
  for (const [r, w] of ROMAN) {
    n = n.replace(new RegExp(`(?<![A-Za-z])${r}(?![A-Za-z])`, "g"), w);
  }
  // PascalCase from alnum runs
  const parts = n.match(/[A-Za-z0-9]+/g) ?? [];
  const pascal = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join("");
  return prefix + pascal;
}

function processArray(arr, prefix) {
  const result = [];
  const seenIds = new Map(); // id -> name (for dup detection)
  const flagged = [];

  for (const entry of arr) {
    const name = typeof entry === "string" ? entry : entry.name;
    const id = deriveId(name, prefix);

    if (id === null) {
      flagged.push(name);
    } else if (seenIds.has(id)) {
      console.warn(`  DUPLICATE id "${id}": "${name}" and "${seenIds.get(id)}"`);
    } else {
      seenIds.set(id, name);
    }

    result.push({ name, id });
  }

  if (flagged.length) {
    console.log(`\n  ${flagged.length} templated entries (id=null):`);
    for (const f of flagged) console.log(`    "${f}"`);
  }

  return result;
}

const db = JSON.parse(readFileSync(DB_PATH, "utf-8"));

console.log("--- skillGems ---");
const skillGems = processArray(db.skillGems, "SkillGem");
console.log(`  ${skillGems.length} entries, ${skillGems.filter((g) => g.id).length} with id`);

console.log("\n--- supportGems ---");
const supportGems = processArray(db.supportGems, "SupportGem");
console.log(`  ${supportGems.length} entries, ${supportGems.filter((g) => g.id).length} with id`);

// Sample spot-checks
const checks = [
  ["SkillGem", "Earthquake", "SkillGemEarthquake"],
  ["SkillGem", "Boneshatter", "SkillGemBoneshatter"],
  ["SkillGem", "Shockwave Totem", "SkillGemShockwaveTotem"],
  ["SupportGem", "Aftershock I", "SupportGemAftershockOne"],
  ["SupportGem", "Aftershock II", "SupportGemAftershockTwo"],
  ["SupportGem", "Aftershock III", "SupportGemAftershockThree"],
  ["SupportGem", "Impact Shockwave", "SupportGemImpactShockwave"],
  ["SupportGem", "Brutality III", "SupportGemBrutalityThree"],
  ["SkillGem", "Atziri's Contempt", "SkillGemAtziriContempt"],
];
console.log("\n--- Spot-checks ---");
let ok = true;
for (const [pfx, name, expected] of checks) {
  const got = deriveId(name, pfx);
  const pass = got === expected;
  if (!pass) ok = false;
  console.log(`  ${pass ? "✓" : "✗"} "${name}" → "${got}" (expected "${expected}")`);
}

if (!ok) {
  console.error("\nSome spot-checks failed. Aborting — poe2db.json NOT written.");
  process.exit(1);
}

const out = { ...db, skillGems, supportGems };
writeFileSync(DB_PATH, JSON.stringify(out, null, 2), "utf-8");
console.log(`\nWrote ${DB_PATH}`);
