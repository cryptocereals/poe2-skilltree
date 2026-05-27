import json, sys

inp, out_path = sys.argv[1], sys.argv[2]
d = json.load(open(inp))
names = lambda descs: {e["label"] for e in d if e.get("desc") in descs}
out = {
    "uniques": sorted(names({"Unique"})),
    "skillGems": sorted(names({"Skill Gems", "Meta Skill Gem"})),
    "supportGems": sorted(names({"Support Gems"})),
}
json.dump(out, open(out_path, "w"))
print("poe2db: %d uniques, %d skills, %d supports" % (len(out["uniques"]), len(out["skillGems"]), len(out["supportGems"])))
