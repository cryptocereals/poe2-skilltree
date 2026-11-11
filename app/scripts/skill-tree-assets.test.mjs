import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { copyAssets } from "./copy-assets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const assetsDirectory = join(root, "assets");
const skillTreeDirectory = join(assetsDirectory, "skill-tree");
const expectedAtlasNames = [
  "background",
  "background-druid",
  "background-huntress",
  "background-mercenary",
  "background-monk",
  "background-ranger",
  "background-sorceress",
  "background-warrior",
  "background-witch",
  "frame",
  "group-background",
  "jewel-radius",
  "jewel",
  "line",
  "mastery-effect-active",
  "mastery-effect-disabled",
  "skills-disabled",
  "skills",
];

test("skill-tree atlas metadata and image pairs live under assets/skill-tree", async () => {
  const files = await readdir(skillTreeDirectory);
  const jsonFiles = files.filter((file) => extname(file) === ".json");
  assert.deepEqual(
    jsonFiles.map((file) => basename(file, ".json")).sort(),
    [...expectedAtlasNames].sort(),
  );

  const referencedImages = new Set();
  for (const jsonFile of jsonFiles) {
    const atlas = JSON.parse(
      await readFile(join(skillTreeDirectory, jsonFile), "utf8"),
    );
    const image = atlas.meta?.image;

    assert.equal(typeof image, "string", `${jsonFile} must name its image`);
    assert.equal(basename(image), image, `${jsonFile} must use a local filename`);
    assert.ok(
      [".webp", ".png"].includes(extname(image).toLowerCase()),
      `${jsonFile} must reference a WebP or PNG image`,
    );
    assert.ok(
      existsSync(join(skillTreeDirectory, image)),
      `${jsonFile} references missing image ${image}`,
    );
    assert.equal(existsSync(join(assetsDirectory, jsonFile)), false);
    assert.equal(existsSync(join(assetsDirectory, image)), false);
    referencedImages.add(image);
  }

  const imageFiles = files.filter((file) =>
    [".webp", ".png"].includes(extname(file).toLowerCase()),
  );
  assert.deepEqual(imageFiles.sort(), [...referencedImages].sort());
});

test("asset copying nests atlases and removes stale root sprite copies", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "poe2-skill-tree-assets-"));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const publicAssetsDirectory = join(temporaryDirectory, "assets");
  await mkdir(publicAssetsDirectory, { recursive: true });

  const sourceFiles = await readdir(skillTreeDirectory);
  for (const file of sourceFiles) {
    await writeFile(join(publicAssetsDirectory, file), "stale root copy");
  }
  await writeFile(join(publicAssetsDirectory, "keep.json"), "unrelated");

  copyAssets(assetsDirectory, publicAssetsDirectory);

  for (const file of sourceFiles) {
    assert.deepEqual(
      await readFile(join(publicAssetsDirectory, "skill-tree", file)),
      await readFile(join(skillTreeDirectory, file)),
      `${file} should be copied under skill-tree`,
    );
    assert.equal(existsSync(join(publicAssetsDirectory, file)), false);
  }
  assert.equal(
    await readFile(join(publicAssetsDirectory, "keep.json"), "utf8"),
    "unrelated",
  );
});
