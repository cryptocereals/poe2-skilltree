import assert from "node:assert/strict";
import test from "node:test";

import { getSkillTreeAssetUrl } from "./atlasAssetUrl.mjs";

test("loads atlas files from assets/skill-tree in development", () => {
  assert.equal(
    getSkillTreeAssetUrl("/", "skills.json"),
    "/assets/skill-tree/skills.json",
  );
  assert.equal(
    getSkillTreeAssetUrl("/", "skills.webp"),
    "/assets/skill-tree/skills.webp",
  );
});

test("preserves the GitHub Pages base path for atlas files", () => {
  const baseUrl = "/poe2-skilltree/";
  const atlasUrl = getSkillTreeAssetUrl(baseUrl, "skills.json");

  assert.equal(
    atlasUrl,
    "/poe2-skilltree/assets/skill-tree/skills.json",
  );
  assert.equal(
    new URL(atlasUrl, "https://cryptocereals.github.io").pathname,
    "/poe2-skilltree/assets/skill-tree/skills.json",
  );
});
