import assert from "node:assert/strict";
import test from "node:test";

import {
  getPoe1DatasetId,
  getPoe1AssetFileName,
  getPoe1AssetUrl,
  getPoe1TreeFile,
  getPoe1TreeDatasetUrl,
  getPoe1TreeUrl,
  isPoe1ReleaseId,
  parsePoe1VersionManifest,
  POE1_RULESETS,
} from "./source.mjs";
import {
  chooseCompareVersion,
  getComparisonOptions,
} from "../../tree/versionSelection.mjs";

test("PoE1 Standard and Ruthless use separate, namespaced source files", () => {
  assert.deepEqual(
    POE1_RULESETS.map(({ id, file }) => ({ id, file })),
    [
      { id: "standard", file: "data.json" },
      { id: "ruthless", file: "ruthless.json" },
    ],
  );
  assert.equal(getPoe1TreeFile("standard"), "data.json");
  assert.equal(getPoe1TreeFile("ruthless"), "ruthless.json");
  assert.equal(getPoe1TreeUrl("/", "standard"), "/data/poe1/data.json");
  assert.equal(getPoe1TreeUrl("/planner/", "ruthless"), "/planner/data/poe1/ruthless.json");
  assert.equal(
    getPoe1TreeUrl("/planner/", "standard", "3.29.0"),
    "/planner/data/poe1/versions/3.29.0/data.json",
  );
  assert.equal(
    getPoe1TreeUrl("/", "ruthless", "3.29.0"),
    "/data/poe1/versions/3.29.0/ruthless.json",
  );
  assert.throws(() => getPoe1TreeFile("current"), /Unsupported PoE1 ruleset/);
  assert.throws(
    () => getPoe1TreeUrl("/", "standard", "../secret"),
    /Unsupported PoE1 tree version/,
  );
});

test("PoE1 sprite URLs resolve to the persisted local asset namespace", () => {
  const official =
    "https://web.poecdn.com/image/passive-skill/skills-4.jpg?f3704";
  assert.equal(getPoe1AssetFileName(official), "skills-4.jpg");
  assert.equal(getPoe1AssetUrl("/", official), "/assets/poe1/skills-4.jpg");
  assert.equal(
    getPoe1AssetUrl("/planner/", official, "3.29.0"),
    "/planner/assets/poe1/versions/3.29.0/skills-4.jpg",
  );
  assert.equal(
    getPoe1AssetUrl("/planner/", "assets/frame-4.png"),
    "/planner/assets/poe1/frame-4.png",
  );
  assert.throws(() => getPoe1AssetUrl("/", "../../secret.png"), /Unsafe/);
  assert.throws(
    () => getPoe1AssetUrl("/", official, "../secret"),
    /Unsupported PoE1 tree version/,
  );
});

test("validates exact version/ruleset datasets and permits cross-ruleset comparison", () => {
  const datasets = [
    {
      id: "current:standard",
      versionId: "current",
      ruleset: "standard",
      label: "3.29.1 (current) · Standard",
    },
    {
      id: "current:ruthless",
      versionId: "current",
      ruleset: "ruthless",
      label: "3.29.1 (current) · Ruthless",
    },
    {
      id: "3.29.0:standard",
      versionId: "3.29.0",
      ruleset: "standard",
      label: "3.29.0 · Standard",
    },
    {
      id: "3.29.0:ruthless",
      versionId: "3.29.0",
      ruleset: "ruthless",
      label: "3.29.0 · Ruthless",
    },
  ];
  const manifest = parsePoe1VersionManifest({
    game: "poe1",
    defaultVersion: "current",
    defaultCompareVersion: "3.29.0",
    defaultDataset: "current:standard",
    defaultCompareDataset: "3.29.0:standard",
    versions: [
      { id: "current", label: "3.29.1 (current)" },
      { id: "3.29.0", label: "3.29.0" },
    ],
    datasets,
  });
  assert.deepEqual(manifest, {
    defaultVersion: "current",
    defaultCompareVersion: "3.29.0",
    defaultDataset: "current:standard",
    defaultCompareDataset: "3.29.0:standard",
    versions: [
      { id: "current", label: "3.29.1 (current)" },
      { id: "3.29.0", label: "3.29.0" },
    ],
    datasets,
  });
  assert.equal(getPoe1DatasetId("current", "ruthless"), "current:ruthless");
  assert.equal(
    getPoe1TreeDatasetUrl("/planner/", manifest.datasets[1]),
    "/planner/data/poe1/ruthless.json",
  );
  assert.equal(
    getPoe1TreeDatasetUrl("/planner/", manifest.datasets[3]),
    "/planner/data/poe1/versions/3.29.0/ruthless.json",
  );
  assert.throws(
    () =>
      getPoe1TreeDatasetUrl("/", {
        ...manifest.datasets[0],
        id: "3.29.0:standard",
      }),
    /identity does not match/,
  );
  assert.deepEqual(
    getComparisonOptions(manifest.datasets, "current:standard").map(
      ({ id }) => id,
    ),
    ["current:ruthless", "3.29.0:standard", "3.29.0:ruthless"],
  );
  assert.equal(
    chooseCompareVersion(
      manifest.datasets,
      "current:standard",
      "current:ruthless",
      manifest.defaultCompareDataset,
    ),
    "current:ruthless",
  );

  assert.deepEqual(
    parsePoe1VersionManifest({
      game: "poe1",
      defaultVersion: "current",
      defaultDataset: "current:standard",
      defaultCompareDataset: null,
      versions: [{ id: "current", label: "Current" }],
      datasets: [
        {
          id: "current:standard",
          versionId: "current",
          ruleset: "standard",
          label: "Current · Standard",
        },
      ],
    }).versions,
    [{ id: "current", label: "Current" }],
  );
  assert.throws(
    () =>
      parsePoe1VersionManifest({
        game: "poe2",
        defaultVersion: "current",
        versions: [{ id: "current", label: "Current" }],
      }),
    /PoE1 tree-version list/,
  );
  assert.throws(
    () =>
      parsePoe1VersionManifest({
        game: "poe1",
        defaultVersion: "current",
        versions: [
          { id: "current", label: "Current" },
          { id: "current", label: "Duplicate" },
        ],
      }),
    /invalid entry/,
  );
});

test("accepts preview, letter-release, and commit-derived PoE1 snapshot IDs", () => {
  const snapshots = [
    { id: "3.29.0-preview-2", label: "3.29.0 preview 2" },
    { id: "3.28.0-j", label: "3.28.0j" },
    {
      id: "0.0.0-history-deadbeef",
      label: "Curse of the Allflame Passive Tree preview (deadbee)",
    },
  ];
  for (const { id } of snapshots) {
    assert.ok(isPoe1ReleaseId(id));
    assert.equal(
      getPoe1TreeUrl("/", "standard", id),
      `/data/poe1/versions/${id}/data.json`,
    );
  }
  const versions = [{ id: "current", label: "Current" }, ...snapshots];
  const datasets = versions.map(({ id, label }) => ({
    id: getPoe1DatasetId(id, "standard"),
    versionId: id,
    ruleset: "standard",
    label: `${label} · Standard`,
  }));
  assert.deepEqual(
    parsePoe1VersionManifest({
      game: "poe1",
      defaultVersion: "current",
      defaultDataset: "current:standard",
      defaultCompareDataset: "3.29.0-preview-2:standard",
      versions,
      datasets,
    }).versions,
    versions,
  );
});
