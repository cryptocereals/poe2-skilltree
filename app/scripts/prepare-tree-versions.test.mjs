import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { copyAssets } from "./copy-assets.mjs";
import {
  compareTreeVersions,
  parseArchivedVersion,
  prepareTreeVersions,
} from "./prepare-tree-versions.mjs";

function treeData(label) {
  return JSON.stringify({
    tree: label,
    classes: [],
    groups: {},
    nodes: {},
    edges: [],
    jewelSlots: [],
    min_x: 0,
    min_y: 0,
    max_x: 0,
    max_y: 0,
  });
}

async function makeWorkspace(t) {
  const root = await mkdtemp(join(tmpdir(), "poe2-tree-versions-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "data", "skill-tree"), { recursive: true });
  return {
    root,
    publicDirectory: join(root, "public"),
    archiveDirectory: join(root, "data", "skill-tree"),
  };
}

function makeLogger() {
  const messages = { log: [], warn: [], error: [] };
  return {
    messages,
    log: (message) => messages.log.push(message),
    warn: (message) => messages.warn.push(message),
    error: (message) => messages.error.push(message),
  };
}

test("copies nested asset directories into the public output", async (t) => {
  const workspace = await makeWorkspace(t);
  const sourceDirectory = join(workspace.root, "assets");
  const nestedDirectory = join(sourceDirectory, "atlas-tree");
  const destinationDirectory = join(workspace.publicDirectory, "assets");
  await mkdir(nestedDirectory, { recursive: true });
  await writeFile(join(nestedDirectory, "frames.json"), '{"frames":[]}', "utf8");

  copyAssets(sourceDirectory, destinationDirectory);

  assert.equal(
    await readFile(join(destinationDirectory, "atlas-tree", "frames.json"), "utf8"),
    '{"frames":[]}',
  );
});

test("parses safe archive names and orders releases by semantic version", () => {
  assert.equal(parseArchivedVersion("0.5.5.json"), "0.5.5");
  assert.equal(parseArchivedVersion("0.5.0-rc.2.json"), "0.5.0-rc.2");
  assert.equal(parseArchivedVersion("../0.5.5.json"), null);
  assert.equal(parseArchivedVersion("latest.json"), null);
  assert.ok(compareTreeVersions("0.5.10", "0.5.5") > 0);
  assert.ok(compareTreeVersions("0.5.0", "0.5.0-rc.2") > 0);
});

test("prepares current and archived trees with a default comparison baseline", async (t) => {
  const workspace = await makeWorkspace(t);
  const logger = makeLogger();
  await writeFile(join(workspace.root, "data.json"), treeData("current"), "utf8");

  for (const version of ["0.4.0", "0.5.0", "0.5.1", "0.5.2", "0.5.4", "0.5.5"]) {
    await writeFile(
      join(workspace.archiveDirectory, `${version}.json`),
      treeData(version),
      "utf8",
    );
  }
  await writeFile(join(workspace.archiveDirectory, "0.5.3.json"), '{"broken":', "utf8");
  await writeFile(join(workspace.archiveDirectory, "0.5.6.json"), '{"nodes":[]}', "utf8");

  const manifest = prepareTreeVersions({
    ...workspace,
    execFileSyncImpl: () => Buffer.from(treeData("legacy")),
    logger,
  });
  const outputDirectory = join(workspace.publicDirectory, "data");

  assert.equal(manifest.defaultVersion, "current");
  assert.equal(manifest.defaultCompareVersion, "0.4.0");
  assert.deepEqual(
    manifest.versions.map(({ id }) => id),
    ["current", "0.5.5", "0.5.4", "0.5.2", "0.5.1", "0.5.0", "0.4.0"],
  );
  for (const { id } of manifest.versions) {
    const tree = JSON.parse(
      await readFile(join(outputDirectory, `data-${id}.json`), "utf8"),
    );
    assert.equal(tree.tree, id === "current" ? "current" : id);
    assert.ok(tree.nodes && !Array.isArray(tree.nodes));
  }
  assert.equal(
    JSON.parse(await readFile(join(outputDirectory, "tree-versions.json"), "utf8"))
      .defaultCompareVersion,
    "0.4.0",
  );
  assert.ok(logger.messages.warn.some((message) => message.includes("0.5.3.json")));
  assert.ok(logger.messages.warn.some((message) => message.includes("0.5.6.json")));
});

test("falls back to the legacy 0.4 tree when no archived 0.4.0 exists", async (t) => {
  const workspace = await makeWorkspace(t);
  await writeFile(join(workspace.root, "data.json"), treeData("current"), "utf8");
  await writeFile(join(workspace.archiveDirectory, "0.5.5.json"), treeData("0.5.5"), "utf8");

  const manifest = prepareTreeVersions({
    ...workspace,
    execFileSyncImpl: () => Buffer.from(treeData("legacy")),
    logger: makeLogger(),
  });

  assert.equal(manifest.defaultCompareVersion, "0.4");
  assert.deepEqual(
    manifest.versions.map(({ id }) => id),
    ["current", "0.5.5", "0.4"],
  );
  assert.equal(
    JSON.parse(
      await readFile(join(workspace.publicDirectory, "data", "data-0.4.json"), "utf8"),
    ).tree,
    "legacy",
  );
});

test("keeps a usable current tree when legacy git history is unavailable", async (t) => {
  const workspace = await makeWorkspace(t);
  await writeFile(join(workspace.root, "data.json"), treeData("current"), "utf8");

  const manifest = prepareTreeVersions({
    ...workspace,
    execFileSyncImpl: () => {
      throw new Error("history unavailable");
    },
    logger: makeLogger(),
  });

  assert.equal(manifest.defaultCompareVersion, null);
  assert.deepEqual(manifest.versions, [{ id: "current", label: "Current" }]);
});
