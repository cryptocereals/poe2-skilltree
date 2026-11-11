import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { copyAssets } from "./copy-assets.mjs";
import { preparePoe1Tree } from "./prepare-poe1-tree.mjs";

function treeData(name) {
  const sprites = {
    normalActive: {
      "0.5": {
        filename: "https://web.poecdn.com/image/passive-skill/skills-4.jpg?v=1",
        w: 1,
        h: 1,
        coords: {},
      },
    },
    normalInactive: {
      "0.5": {
        filename: "https://web.poecdn.com/image/passive-skill/skills-disabled-4.jpg?v=1",
        w: 1,
        h: 1,
        coords: {},
      },
    },
  };
  sprites.frame = {
    "0.5": {
      filename: "https://web.poecdn.com/image/passive-skill/frame-4.png?v=2",
      w: 1,
      h: 1,
      coords: {},
    },
  };
  return JSON.stringify({
    tree: name,
    classes: [],
    groups: {},
    nodes: {},
    constants: { orbitRadii: [0], skillsPerOrbit: [1] },
    sprites,
  });
}

async function makeWorkspace(t) {
  const root = await mkdtemp(join(tmpdir(), "poe1-tree-prepare-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataDirectory = join(root, "data", "poe1");
  const assetDirectory = join(root, "assets", "poe1");
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(join(dataDirectory, "data.json"), treeData("Default"), "utf8");
  await writeFile(
    join(dataDirectory, "ruthless.json"),
    treeData("Default Ruthless"),
    "utf8",
  );
  await writeFile(join(assetDirectory, "skills-4.jpg"), Buffer.from([1, 2, 3]));
  await writeFile(
    join(assetDirectory, "skills-disabled-4.jpg"),
    Buffer.from([3, 2, 1]),
  );
  await writeFile(join(assetDirectory, "frame-4.png"), Buffer.from([4, 5, 6]));
  return { root, dataDirectory, assetDirectory, publicDirectory: join(root, "public") };
}

test("extracts namespaced Standard/Ruthless data and copies local asset routes", async (t) => {
  const workspace = await makeWorkspace(t);
  const publicAssetsDirectory = join(workspace.publicDirectory, "assets");
  copyAssets(join(workspace.root, "assets"), publicAssetsDirectory, {
    excludeDirectories: ["poe1"],
  });
  await writeFile(
    join(workspace.dataDirectory, "manifest.json"),
    JSON.stringify({ commit: "official-sha" }),
    "utf8",
  );

  const result = preparePoe1Tree({
    root: workspace.root,
    publicDirectory: workspace.publicDirectory,
    logger: { log() {} },
  });
  const output = join(workspace.publicDirectory, "data", "poe1");

  assert.equal(JSON.parse(await readFile(join(output, "data.json"), "utf8")).tree, "Default");
  assert.equal(
    JSON.parse(await readFile(join(output, "ruthless.json"), "utf8")).tree,
    "Default Ruthless",
  );
  const outputManifest = JSON.parse(
    await readFile(join(output, "tree-variants.json"), "utf8"),
  );
  assert.equal(outputManifest.source.commit, "official-sha");
  assert.equal(
    outputManifest.assetPath,
    "assets/poe1/",
  );
  assert.ok(existsSync(join(publicAssetsDirectory, "poe1", "skills-4.jpg")));
  assert.deepEqual(
    await readFile(join(publicAssetsDirectory, "poe1", "frame-4.png")),
    Buffer.from([4, 5, 6]),
  );
  assert.deepEqual(
    (await readdir(join(publicAssetsDirectory, "poe1"))).sort(),
    ["frame-4.png", "skills-4.jpg", "skills-disabled-4.jpg"],
  );
  assert.deepEqual(
    outputManifest.assets,
    ["frame-4.png", "skills-4.jpg", "skills-disabled-4.jpg"],
  );
  const versionManifest = JSON.parse(
    await readFile(join(output, "tree-versions.json"), "utf8"),
  );
  assert.equal(versionManifest.defaultVersion, "current");
  assert.equal(versionManifest.defaultCompareVersion, null);
  assert.equal(versionManifest.defaultDataset, "current:standard");
  assert.equal(versionManifest.defaultCompareDataset, "current:ruthless");
  assert.deepEqual(versionManifest.versions, [
    { id: "current", label: "Current" },
  ]);
  assert.deepEqual(
    versionManifest.datasets.map(({ id, versionId, ruleset, label }) => ({
      id,
      versionId,
      ruleset,
      label,
    })),
    [
      {
        id: "current:standard",
        versionId: "current",
        ruleset: "standard",
        label: "Current · Standard",
      },
      {
        id: "current:ruthless",
        versionId: "current",
        ruleset: "ruthless",
        label: "Current · Ruthless",
      },
    ],
  );
  assert.deepEqual(
    [...result.referencedAssets].sort(),
    ["frame-4.png", "skills-4.jpg", "skills-disabled-4.jpg"],
  );
});

test("prepares a tagged PoE1 archive with isolated tree and sprite routes", async (t) => {
  const workspace = await makeWorkspace(t);
  const release = "3.29.0";
  const archiveData = join(workspace.dataDirectory, "versions", release);
  const archiveAssets = join(workspace.assetDirectory, "versions", release);
  await mkdir(archiveData, { recursive: true });
  await mkdir(archiveAssets, { recursive: true });
  await writeFile(join(archiveData, "data.json"), treeData(release), "utf8");
  await writeFile(
    join(archiveData, "ruthless.json"),
    treeData(`${release} Ruthless`),
    "utf8",
  );
  await writeFile(
    join(archiveData, "manifest.json"),
    JSON.stringify({
      repository: "https://github.com/grindinggear/skilltree-export",
      branch: `refs/tags/${release}`,
      commit: "b".repeat(40),
      release,
    }),
    "utf8",
  );
  await writeFile(join(archiveAssets, "skills-4.jpg"), Buffer.from([8, 8, 8]));
  await writeFile(
    join(archiveAssets, "skills-disabled-4.jpg"),
    Buffer.from([9, 9, 9]),
  );
  await writeFile(join(archiveAssets, "frame-4.png"), Buffer.from([10, 10, 10]));
  await writeFile(
    join(workspace.dataDirectory, "manifest.json"),
    JSON.stringify({
      repository: "https://github.com/grindinggear/skilltree-export",
      branch: "master",
      commit: "a".repeat(40),
      release: "3.29.1",
    }),
    "utf8",
  );

  const result = preparePoe1Tree({
    root: workspace.root,
    publicDirectory: workspace.publicDirectory,
    logger: { log() {} },
  });
  const output = join(workspace.publicDirectory, "data", "poe1");
  const versionManifest = JSON.parse(
    await readFile(join(output, "tree-versions.json"), "utf8"),
  );

  assert.equal(
    JSON.parse(
      await readFile(join(output, "versions", release, "ruthless.json"), "utf8"),
    ).tree,
    `${release} Ruthless`,
  );
  assert.deepEqual(versionManifest.versions, [
    { id: "current", label: "3.29.1 (current)" },
    { id: release, label: release },
  ]);
  assert.equal(versionManifest.defaultCompareVersion, release);
  assert.equal(versionManifest.defaultDataset, "current:standard");
  assert.equal(versionManifest.defaultCompareDataset, `${release}:standard`);
  assert.deepEqual(
    versionManifest.datasets.map(({ id }) => id),
    [
      "current:standard",
      "current:ruthless",
      `${release}:standard`,
      `${release}:ruthless`,
    ],
  );
  assert.deepEqual(
    await readFile(
      join(
        workspace.publicDirectory,
        "assets",
        "poe1",
        "versions",
        release,
        "skills-4.jpg",
      ),
    ),
    Buffer.from([8, 8, 8]),
  );
  assert.deepEqual(
    [...result.versionManifest.archives],
    [
      {
        release,
        commit: "b".repeat(40),
        branch: `refs/tags/${release}`,
        label: release,
      },
    ],
  );
});

test("publishes history snapshots in upstream order with recognizable labels", async (t) => {
  const workspace = await makeWorkspace(t);
  const anchorCommit = "a".repeat(40);
  const snapshots = [
    {
      id: "3.28.0-j",
      title: "3.28.0j",
      label: "3.28.0j",
      commit: "b".repeat(40),
    },
    {
      id: "3.29.0-preview-2",
      title: "3.29.0 preview 2",
      label: "3.29.0 preview 2",
      commit: "c".repeat(40),
    },
    {
      id: "0.0.0-history-deadbeef",
      title: "Curse of the Allflame Passive Tree preview",
      label: "Curse of the Allflame Passive Tree preview (deadbee)",
      commit: "d".repeat(40),
    },
  ];
  await writeFile(
    join(workspace.dataDirectory, "manifest.json"),
    JSON.stringify({
      repository: "https://github.com/grindinggear/skilltree-export",
      branch: "master",
      commit: anchorCommit,
      release: "3.29.1",
    }),
    "utf8",
  );

  for (const [historyOrder, snapshot] of snapshots.entries()) {
    const snapshotDataDirectory = join(
      workspace.dataDirectory,
      "versions",
      snapshot.id,
    );
    const snapshotAssetDirectory = join(
      workspace.assetDirectory,
      "versions",
      snapshot.id,
    );
    await mkdir(snapshotDataDirectory, { recursive: true });
    await mkdir(snapshotAssetDirectory, { recursive: true });
    await writeFile(
      join(snapshotDataDirectory, "data.json"),
      treeData(snapshot.title),
      "utf8",
    );
    await writeFile(
      join(snapshotDataDirectory, "ruthless.json"),
      treeData(`${snapshot.title} Ruthless`),
      "utf8",
    );
    await writeFile(
      join(snapshotDataDirectory, "manifest.json"),
      JSON.stringify({
        repository: "https://github.com/grindinggear/skilltree-export",
        branch: "master",
        commit: snapshot.commit,
        release: snapshot.id,
        label: snapshot.label,
        title: snapshot.title,
        committedAt: `2026-03-0${historyOrder + 1}T00:00:00Z`,
        historyOrder,
        historyAnchorCommit: anchorCommit,
        historyPath: "data.json",
      }),
      "utf8",
    );
    await writeFile(join(snapshotAssetDirectory, "skills-4.jpg"), Buffer.from([8, 8, 8]));
    await writeFile(
      join(snapshotAssetDirectory, "skills-disabled-4.jpg"),
      Buffer.from([9, 9, 9]),
    );
    await writeFile(
      join(snapshotAssetDirectory, "frame-4.png"),
      Buffer.from([10, 10, 10]),
    );
  }

  const result = preparePoe1Tree({
    root: workspace.root,
    publicDirectory: workspace.publicDirectory,
    logger: { log() {} },
  });
  const versionManifest = JSON.parse(
    await readFile(
      join(workspace.publicDirectory, "data", "poe1", "tree-versions.json"),
      "utf8",
    ),
  );

  assert.deepEqual(
    versionManifest.versions,
    [
      { id: "current", label: "3.29.1 (current)" },
      ...snapshots.map(({ id, label }) => ({ id, label })),
    ],
  );
  assert.equal(versionManifest.defaultCompareVersion, snapshots[0].id);
  assert.deepEqual(
    result.versionManifest.archives.map(({ release, label, historyOrder }) => ({
      release,
      label,
      historyOrder,
    })),
    snapshots.map(({ id, label }, historyOrder) => ({
      release: id,
      label,
      historyOrder,
    })),
  );
  assert.equal(
    JSON.parse(
      await readFile(
        join(
          workspace.publicDirectory,
          "data",
          "poe1",
          "versions",
          snapshots[2].id,
          "data.json",
        ),
        "utf8",
      ),
    ).tree,
    snapshots[2].title,
  );
});

test("publishes only available archive datasets and chooses the matching Ruthless comparison", async (t) => {
  const workspace = await makeWorkspace(t);
  const release = "3.29.0";
  const archiveData = join(workspace.dataDirectory, "versions", release);
  const archiveAssets = join(workspace.assetDirectory, "versions", release);
  await mkdir(archiveData, { recursive: true });
  await mkdir(archiveAssets, { recursive: true });
  await writeFile(
    join(archiveData, "ruthless.json"),
    treeData(`${release} Ruthless`),
    "utf8",
  );
  await writeFile(
    join(archiveData, "manifest.json"),
    JSON.stringify({
      repository: "https://github.com/grindinggear/skilltree-export",
      branch: `refs/tags/${release}`,
      commit: "c".repeat(40),
      release,
    }),
    "utf8",
  );
  await writeFile(join(archiveAssets, "skills-4.jpg"), Buffer.from([8, 8, 8]));
  await writeFile(
    join(archiveAssets, "skills-disabled-4.jpg"),
    Buffer.from([9, 9, 9]),
  );
  await writeFile(join(archiveAssets, "frame-4.png"), Buffer.from([10, 10, 10]));
  await writeFile(
    join(workspace.dataDirectory, "manifest.json"),
    JSON.stringify({
      repository: "https://github.com/grindinggear/skilltree-export",
      branch: "master",
      commit: "d".repeat(40),
      release: "3.29.1",
    }),
    "utf8",
  );

  const result = preparePoe1Tree({
    root: workspace.root,
    publicDirectory: workspace.publicDirectory,
    logger: { log() {} },
  });
  const versionManifest = JSON.parse(
    await readFile(
      join(workspace.publicDirectory, "data", "poe1", "tree-versions.json"),
      "utf8",
    ),
  );

  assert.deepEqual(
    versionManifest.datasets.map(({ id }) => id),
    ["current:standard", "current:ruthless", `${release}:ruthless`],
  );
  assert.equal(versionManifest.defaultCompareVersion, release);
  assert.equal(versionManifest.defaultCompareDataset, `${release}:ruthless`);
  assert.equal(result.versionManifest.datasets.length, 3);
});

test("fails extraction when an official sprite referenced by a tree is absent", async (t) => {
  const workspace = await makeWorkspace(t);
  await rm(join(workspace.assetDirectory, "skills-4.jpg"));

  assert.throws(
    () =>
      preparePoe1Tree({
        root: workspace.root,
        publicDirectory: workspace.publicDirectory,
        logger: { log() {} },
      }),
    /Missing or empty PoE1 sprite asset/,
  );
});
