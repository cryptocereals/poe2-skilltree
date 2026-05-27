#!/usr/bin/env node
// Cross-platform replacement for prepare-data.sh
import { existsSync, mkdirSync, copyFileSync, readdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const pub = join(__dirname, "..", "public");
const V04_COMMIT = process.env.V04_COMMIT || "859f2b1";
const AC_URL =
    process.env.AC_URL ||
    "https://cdn.poe2db.tw/json/autocompletecb_us.00e8df2683036f13.json";

mkdirSync(join(pub, "data"), { recursive: true });
mkdirSync(join(pub, "assets"), { recursive: true });

// Copy assets
for (const f of readdirSync(join(root, "assets"))) {
    copyFileSync(join(root, "assets", f), join(pub, "assets", f));
}

// Copy current data
copyFileSync(join(root, "data.json"), join(pub, "data", "data-0.5.json"));

// Extract v0.4 data from git history
const v04Path = join(pub, "data", "data-0.4.json");
try {
    const out = execSync(`git -C "${root}" show ${V04_COMMIT}:data.json`, { maxBuffer: 64 * 1024 * 1024 });
    writeFileSync(v04Path, out);
} catch (e) {
    console.error("Could not extract v0.4 data from git history:", e.message);
}

// Fetch poe2db autocomplete if not already present
const podbPath = join(pub, "data", "poe2db.json");
if (!existsSync(podbPath)) {
    console.log("Fetching poe2db autocomplete...");
    await new Promise((resolve) => {
        const req = https.get(
            AC_URL,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
                    Referer: "https://poe2db.tw/",
                },
            },
            (res) => {
                const chunks = [];
                res.on("data", (c) => chunks.push(c));
                res.on("end", () => {
                    try {
                        const d = JSON.parse(Buffer.concat(chunks).toString());
                        const names = (descs) =>
                            [...new Set(d.filter((e) => descs.includes(e.desc)).map((e) => e.label))].sort();
                        const out = {
                            uniques: names(["Unique"]),
                            skillGems: names(["Skill Gems", "Meta Skill Gem"]),
                            supportGems: names(["Support Gems"]),
                        };
                        writeFileSync(podbPath, JSON.stringify(out));
                        console.log(
                            `poe2db: ${out.uniques.length} uniques, ${out.skillGems.length} skills, ${out.supportGems.length} supports`
                        );
                    } catch (e) {
                        console.error("poe2db parse failed – writing empty stub:", e.message);
                        writeFileSync(podbPath, '{"uniques":[],"skillGems":[],"supportGems":[]}');
                    }
                    resolve();
                });
            }
        );
        req.on("error", (e) => {
            console.error("poe2db fetch failed – writing empty stub:", e.message);
            writeFileSync(podbPath, '{"uniques":[],"skillGems":[],"supportGems":[]}');
            resolve();
        });
    });
} else {
    console.log("poe2db already cached, skipping fetch");
}

console.log("prepare-data done");
