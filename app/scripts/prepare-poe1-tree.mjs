#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  getPoe1DatasetId,
  isPoe1ReleaseId,
  POE1_RULESETS,
  POE1_RUNTIME_ATLAS_NAMES,
} from "../src/features/poe1/data/source.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(SCRIPT_DIR, "..", "..");
const DEFAULT_PUBLIC = join(SCRIPT_DIR, "..", "public");

function compareReleases(left, right) {
  const parse = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(value);
    return match
      ? {
          core: match.slice(1, 4).map(Number),
          prerelease: match[4] ?? "",
        }
      : null;
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return right.localeCompare(left);
  for (let index = 0; index < a.core.length; index += 1) {
    if (a.core[index] !== b.core[index]) return b.core[index] - a.core[index];
  }
  if (!a.prerelease && b.prerelease) return -1;
  if (a.prerelease && !b.prerelease) return 1;
  return b.prerelease.localeCompare(a.prerelease);
}

function compareArchiveHistory(left, right) {
  const leftOrder = Number.isInteger(left.historyOrder)
    ? left.historyOrder
    : null;
  const rightOrder = Number.isInteger(right.historyOrder)
    ? right.historyOrder
    : null;
  if (leftOrder !== rightOrder) {
    if (leftOrder === null) return 1;
    if (rightOrder === null) return -1;
    return leftOrder - rightOrder;
  }

  const leftDate = Date.parse(left.committedAt ?? "");
  const rightDate = Date.parse(right.committedAt ?? "");
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
    return rightDate - leftDate;
  }
  return compareReleases(left.release, right.release);
}

function validateTreeData(contents, source) {
  let data;
  try {
    data = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Invalid JSON in ${source}: ${error.message}`, { cause: error });
  }
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray(data.classes) ||
    !data.groups ||
    typeof data.groups !== "object" ||
    Array.isArray(data.groups) ||
    !data.nodes ||
    typeof data.nodes !== "object" ||
    Array.isArray(data.nodes) ||
    !Array.isArray(data.constants?.orbitRadii) ||
    !Array.isArray(data.constants?.skillsPerOrbit) ||
    !data.sprites ||
    typeof data.sprites !== "object"
  ) {
    throw new Error(`Unsupported PoE1 skill-tree data in ${source}.`);
  }
  return data;
}

function getSpriteFileName(filename, source) {
  if (typeof filename !== "string" || !filename.trim()) {
    throw new Error(`Missing sprite filename in ${source}.`);
  }
  const cleanPath = filename.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  const segments = cleanPath.split("/");
  if (
    segments.some((segment) => segment === "." || segment === "..") ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segments[segments.length - 1])
  ) {
    throw new Error(`Unsafe sprite filename in ${source}: ${filename}`);
  }
  return segments[segments.length - 1];
}

function selectVariant(variants) {
  if (variants["0.5"]) return variants["0.5"];
  return Object.entries(variants)
    .filter(([zoom, variant]) => Number.isFinite(Number(zoom)) && variant?.filename)
    .sort(([left], [right]) => Number(right) - Number(left))[0]?.[1];
}

function getRuntimeAssets(data, assetDirectory, source) {
  const referenced = new Set();
  for (const atlasName of POE1_RUNTIME_ATLAS_NAMES) {
    const variants = data.sprites[atlasName];
    if (!variants) {
      if (["normalActive", "normalInactive", "frame"].includes(atlasName)) {
        throw new Error(`The PoE1 tree is missing its ${atlasName} sprite atlas.`);
      }
      continue;
    }
    if (typeof variants !== "object" || Array.isArray(variants)) {
      throw new Error(`Malformed ${atlasName} sprite atlas in ${source}.`);
    }
    const variant = selectVariant(variants);
    if (!variant) {
      if (["normalActive", "normalInactive", "frame"].includes(atlasName)) {
        throw new Error(`The PoE1 ${atlasName} sprite atlas has no usable resolution.`);
      }
      continue;
    }
    const fileName = getSpriteFileName(variant.filename, source);
    const assetPath = join(assetDirectory, fileName);
    if (!existsSync(assetPath) || statSync(assetPath).size === 0) {
      throw new Error(`Missing or empty PoE1 sprite asset: ${assetPath}`);
    }
    referenced.add(fileName);
  }
  return referenced;
}

export function preparePoe1Tree({
  root = DEFAULT_ROOT,
  publicDirectory = DEFAULT_PUBLIC,
  logger = console,
} = {}) {
  const dataDirectory = join(root, "data", "poe1");
  const assetDirectory = join(root, "assets", "poe1");
  const outputDirectory = join(publicDirectory, "data", "poe1");
  const outputAssetDirectory = join(publicDirectory, "assets", "poe1");
  mkdirSync(outputDirectory, { recursive: true });
  mkdirSync(outputAssetDirectory, { recursive: true });

  const trees = {};
  const referencedAssets = new Set();
  const availableRulesets = new Map([
    ["current", POE1_RULESETS.map((ruleset) => ruleset.id)],
  ]);
  for (const { file } of POE1_RULESETS) {
    const sourcePath = join(dataDirectory, file);
    const data = validateTreeData(readFileSync(sourcePath, "utf8"), sourcePath);
    trees[file] = data;
    for (const asset of getRuntimeAssets(data, assetDirectory, sourcePath)) {
      referencedAssets.add(asset);
    }
    copyFileSync(sourcePath, join(outputDirectory, file));
  }

  for (const asset of referencedAssets) {
    copyFileSync(join(assetDirectory, asset), join(outputAssetDirectory, asset));
  }

  const sourceManifestPath = join(dataDirectory, "manifest.json");
  let source = null;
  if (existsSync(sourceManifestPath)) {
    try {
      const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
      source = {
        repository: sourceManifest.repository,
        branch: sourceManifest.branch,
        commit: sourceManifest.commit,
        release: sourceManifest.release,
      };
    } catch (error) {
      throw new Error(`Invalid PoE1 source manifest: ${error.message}`, {
        cause: error,
      });
    }
  }

  const currentLabel = source?.release
    ? `${source.release} (current)`
    : "Current";
  const versionOptions = [{ id: "current", label: currentLabel }];
  const historyDirectory = join(dataDirectory, "versions");
  const archiveIds = existsSync(historyDirectory)
    ? readdirSync(historyDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && isPoe1ReleaseId(entry.name))
        .map((entry) => entry.name)
    : [];
  const archiveSources = [];
  const archiveRulesets = new Map();

  for (const release of archiveIds) {
    const sourceDirectory = join(historyDirectory, release);
    const sourceManifestPath = join(sourceDirectory, "manifest.json");
    let archiveSource;
    try {
      archiveSource = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
    } catch (error) {
      throw new Error(`Invalid PoE1 ${release} archive manifest: ${error.message}`, {
        cause: error,
      });
    }
    if (
      archiveSource?.release !== release ||
      typeof archiveSource?.commit !== "string" ||
      !/^[a-f0-9]{40}$/i.test(archiveSource.commit)
    ) {
      throw new Error(`PoE1 ${release} archive has invalid source provenance.`);
    }
    if (
      archiveSource.label !== undefined &&
      (typeof archiveSource.label !== "string" || !archiveSource.label.trim())
    ) {
      throw new Error(`PoE1 ${release} archive has an invalid source label.`);
    }
    if (
      archiveSource.historyOrder !== undefined &&
      (!Number.isInteger(archiveSource.historyOrder) || archiveSource.historyOrder < 0)
    ) {
      throw new Error(`PoE1 ${release} archive has an invalid history order.`);
    }
    if (
      archiveSource.committedAt !== undefined &&
      archiveSource.committedAt !== null &&
      (typeof archiveSource.committedAt !== "string" ||
        !Number.isFinite(Date.parse(archiveSource.committedAt)))
    ) {
      throw new Error(`PoE1 ${release} archive has an invalid commit date.`);
    }
    if (
      archiveSource.historyAnchorCommit !== undefined &&
      (typeof archiveSource.historyAnchorCommit !== "string" ||
        !/^[a-f0-9]{40}$/i.test(archiveSource.historyAnchorCommit))
    ) {
      throw new Error(`PoE1 ${release} archive has an invalid history anchor.`);
    }

    const archiveAssetDirectory = join(assetDirectory, "versions", release);
    const outputVersionDirectory = join(outputDirectory, "versions", release);
    const outputVersionAssetDirectory = join(
      outputAssetDirectory,
      "versions",
      release,
    );
    mkdirSync(outputVersionDirectory, { recursive: true });
    mkdirSync(outputVersionAssetDirectory, { recursive: true });

    const archiveReferencedAssets = new Set();
    const releaseRulesets = [];
    for (const { id, file } of POE1_RULESETS) {
      const sourcePath = join(sourceDirectory, file);
      if (!existsSync(sourcePath)) continue;
      const data = validateTreeData(readFileSync(sourcePath, "utf8"), sourcePath);
      for (const asset of getRuntimeAssets(
        data,
        archiveAssetDirectory,
        sourcePath,
      )) {
        archiveReferencedAssets.add(asset);
      }
      copyFileSync(sourcePath, join(outputVersionDirectory, file));
      releaseRulesets.push(id);
    }

    if (releaseRulesets.length === 0) {
      throw new Error(`PoE1 ${release} archive has no usable tree data.`);
    }

    for (const asset of archiveReferencedAssets) {
      const sourcePath = join(archiveAssetDirectory, asset);
      if (!existsSync(sourcePath) || statSync(sourcePath).size === 0) {
        throw new Error(
          `Missing or empty PoE1 ${release} sprite asset: ${sourcePath}`,
        );
      }
      copyFileSync(sourcePath, join(outputVersionAssetDirectory, asset));
    }

    archiveSources.push({
      release,
      commit: archiveSource.commit,
      branch: archiveSource.branch,
      label: archiveSource.label?.trim() || release,
      ...(typeof archiveSource.title === "string" ? { title: archiveSource.title } : {}),
      ...(Number.isInteger(archiveSource.historyOrder)
        ? { historyOrder: archiveSource.historyOrder }
        : {}),
      ...(typeof archiveSource.committedAt === "string"
        ? { committedAt: archiveSource.committedAt }
        : {}),
      ...(typeof archiveSource.historyAnchorCommit === "string"
        ? { historyAnchorCommit: archiveSource.historyAnchorCommit }
        : {}),
      ...(typeof archiveSource.historyPath === "string"
        ? { historyPath: archiveSource.historyPath }
        : {}),
    });
    archiveRulesets.set(release, releaseRulesets);
  }

  archiveSources.sort(compareArchiveHistory);
  versionOptions.push(
    ...archiveSources.map(({ release, label }) => ({ id: release, label })),
  );

  const manifest = {
    game: "poe1",
    source,
    trees: [
      { id: "standard", label: "Standard", file: "data.json" },
      { id: "ruthless", label: "Ruthless", file: "ruthless.json" },
    ],
    assetPath: "assets/poe1/",
    assets: [...referencedAssets].sort(),
  };
  const versionManifest = {
    game: "poe1",
    defaultVersion: "current",
    defaultCompareVersion: versionOptions[1]?.id ?? null,
    versions: versionOptions,
    defaultDataset: getPoe1DatasetId("current", "standard"),
    defaultCompareDataset: null,
    datasets: versionOptions.flatMap((version) =>
      (availableRulesets.get(version.id) ?? archiveRulesets.get(version.id) ?? [])
        .map((rulesetId) => {
          const ruleset = POE1_RULESETS.find((option) => option.id === rulesetId);
          if (!ruleset) return null;
          return {
            id: getPoe1DatasetId(version.id, ruleset.id),
            versionId: version.id,
            ruleset: ruleset.id,
            label: `${version.label} · ${ruleset.label}`,
          };
        })
        .filter(Boolean),
    ),
    archives: archiveSources,
  };
  const defaultCompareDatasets = versionManifest.datasets.filter(
    (dataset) =>
      dataset.versionId === versionManifest.defaultCompareVersion &&
      dataset.id !== versionManifest.defaultDataset,
  );
  versionManifest.defaultCompareDataset =
    defaultCompareDatasets.find((dataset) => dataset.ruleset === "standard")
      ?.id ??
    defaultCompareDatasets[0]?.id ??
    versionManifest.datasets.find(
      (dataset) => dataset.id !== versionManifest.defaultDataset,
    )?.id ??
    null;
  writeFileSync(
    join(outputDirectory, "tree-variants.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(outputDirectory, "tree-versions.json"),
    `${JSON.stringify(versionManifest, null, 2)}\n`,
    "utf8",
  );
  logger?.log?.(
    `Prepared PoE1 Standard and Ruthless plus ${archiveSources.length} historical version(s); ${referencedAssets.size} current asset(s).`,
  );
  return { trees, manifest, versionManifest, referencedAssets };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    preparePoe1Tree();
  } catch (error) {
    console.error(`PoE1 tree preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
