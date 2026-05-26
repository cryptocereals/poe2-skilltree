# Build Planner — design

Date: 2026-05-26

## Goal
A separate **Planner Mode** (linear wizard) that authors a PoE2 `.build` JSON
file and exports it as `<name>.build` (drop into `Preferences/BuildPlanner`),
plus Import of an existing `.build`.

## `.build` format (pathofexile.com/developer/docs/game)
JSON root `Build`: `name` (req), `author?`, `description?`, `ascendancy?`
(e.g. `"Huntress2"`), `passives?` (string ids or `{id, weapon_set, level_interval?, additional_text?}`),
`skills?` (`{id, …}`), `inventory_slots?` (`{inventory_id, unique?, hint?, …}`).

## Mapping from our data
| `.build` | source | valid? |
|---|---|---|
| name/author/description | Details form | ✅ |
| ascendancy | `build.selectedAsc` | ✅ exact |
| passives[].id | allocated node `id` (PassiveSkills id) | ✅ |
| passives[].weapon_set | our tag 0=shared/1=Set I/2=Set II | ✅ |
| inventory_slots[] | Inventory form (unique **name** + hint) | ✅ names are display strings |
| skills[].id | gem BaseItemTypes id | ⚠️ verify vs real export |

## Decisions
- Transfer: **download/upload real `.build` files**.
- Shape: **separate mode, linear wizard**: Details → Passives → Skills → Inventory (inventory last).
- poe2db gem/item data: **runtime browser fetch + localStorage cache** (TTL ~14d),
  graceful fallback to cache then free-text if the hashed CDN URL 404s.
  Source: `https://cdn.poe2db.tw/json/autocompletecb_us.*.json` (CORS open),
  filter by `desc` (item bases/uniques → inventory; gems → skills).

## Phases
1. Planner shell + wizard nav + Details step + reuse passives step +
   Export/Import (`name/author/description/ascendancy/passives`). Fully game-valid.
2. Inventory step with cached poe2db autocomplete.
3. Skills step with gem autocomplete (flagged id-validity risk).

## Risk
Passives/ascendancy export is game-valid. `skills[].id` may need the internal
gem id; verify against a real exported `.build` before relying on Phase 3.
