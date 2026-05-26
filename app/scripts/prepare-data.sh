#!/usr/bin/env bash
# Populates app/public with the tree data + sprite atlases the viewer fetches
# at runtime. Kept out of git (see app/.gitignore) and regenerated on dev/build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)" # repo root
PUB="$SCRIPT_DIR/../public"

# Commit holding the 0.4.0 export (for the version-diff feature).
V04_COMMIT="${V04_COMMIT:-859f2b1}"

mkdir -p "$PUB/data" "$PUB/assets"

cp "$ROOT"/assets/* "$PUB/assets/"
cp "$ROOT/data.json" "$PUB/data/data-0.5.json"
git -C "$ROOT" show "$V04_COMMIT:data.json" > "$PUB/data/data-0.4.json"

# poe2db gem/item names for the planner's Skills/Inventory autocomplete.
# Fetched server-side (poe2db's CDN has no CORS for third-party origins, so the
# browser can't read it at runtime). Bundled once; the app loads it same-origin.
# Hashed URL changes on poe2db updates — bump AC_URL if the fetch 404s.
PODB="$PUB/data/poe2db.json"
AC_URL="${AC_URL:-https://cdn.poe2db.tw/json/autocompletecb_us.00e8df2683036f13.json}"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
if [ ! -f "$PODB" ]; then
  TMP="$(mktemp)"
  SG="$(mktemp)"
  # The autocomplete feed files some support gems under "Keywords" (e.g.
  # Knockback, Impale, Maim), so the desc filter alone misses them. Also pull
  # the Support_Gems index page and union it in. Best-effort: if the page or its
  # markup changes, the union just adds nothing and we keep the feed list.
  curl -sfL --max-time 40 -A "$UA" -H "Referer: https://poe2db.tw/" \
      "https://poe2db.tw/us/Support_Gems" -o "$SG" || :
  if curl -sfL --max-time 30 -A "$UA" \
      -H "Referer: https://poe2db.tw/" "$AC_URL" -o "$TMP" \
      && python3 - "$TMP" "$SG" "$PODB" <<'PY'
import json, sys, re, html
d = json.load(open(sys.argv[1]))
names = lambda descs: {e["label"] for e in d if e.get("desc") in descs}
support = names({"Support Gems"})
# Each support gem on the index page is a `<tr data-filters="Support ...">` row;
# the gem name is the text of its coloured gem link (gem_red/green/blue/white).
try:
    page = open(sys.argv[2], encoding="utf-8", errors="ignore").read()
    for row in re.split(r'(?=<tr data-filters="Support )', page)[1:]:
        row = row.split("</tr>", 1)[0]
        txts = [html.unescape(re.sub(r"<[^>]+>", "", t)).strip()
                for t in re.findall(r'<a class="gem_\w+"[^>]*>(.*?)</a>', row, re.S)]
        txts = [t for t in txts if t]
        if txts:
            support.add(txts[0])
except Exception:
    pass
out = {
    "uniques": sorted(names({"Unique"})),
    "skillGems": sorted(names({"Skill Gems", "Meta Skill Gem"})),
    "supportGems": sorted(support),
}
json.dump(out, open(sys.argv[3], "w"))
print("poe2db: %d uniques, %d skills, %d supports"
      % (len(out["uniques"]), len(out["skillGems"]), len(out["supportGems"])))
PY
  then :; else
    echo "poe2db fetch failed — writing empty stub (planner autocomplete disabled)"
    echo '{"uniques":[],"skillGems":[],"supportGems":[]}' > "$PODB"
  fi
  rm -f "$TMP" "$SG"
fi

echo "prepared: $(du -sh "$PUB" | cut -f1) in app/public"
