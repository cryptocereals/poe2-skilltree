export const POE1_RULESETS = Object.freeze([
  Object.freeze({ id: "standard", label: "Standard", file: "data.json" }),
  Object.freeze({ id: "ruthless", label: "Ruthless", file: "ruthless.json" }),
]);

export const POE1_RUNTIME_ATLAS_NAMES = Object.freeze([
  "normalActive",
  "normalInactive",
  "notableActive",
  "notableInactive",
  "keystoneActive",
  "keystoneInactive",
  "frame",
  "mastery",
  "masteryActiveSelected",
  "masteryInactive",
  "jewel",
]);

const TREE_FILES = Object.freeze({
  standard: "data.json",
  ruthless: "ruthless.json",
});
const POE1_RELEASE_ID = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;

export function isPoe1ReleaseId(value) {
  return typeof value === "string" && POE1_RELEASE_ID.test(value);
}

export function getPoe1DatasetId(versionId, ruleset) {
  if (versionId !== "current" && !isPoe1ReleaseId(versionId)) {
    throw new Error(`Unsupported PoE1 tree version: ${versionId}`);
  }
  if (!Object.hasOwn(TREE_FILES, ruleset)) {
    throw new Error(`Unsupported PoE1 ruleset: ${ruleset}`);
  }
  return `${versionId}:${ruleset}`;
}

export function parsePoe1VersionManifest(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    input.game !== "poe1" ||
    !Array.isArray(input.versions)
  ) {
    throw new Error("The PoE1 tree-version list is missing or malformed.");
  }

  const seen = new Set();
  const versions = [];
  for (const entry of input.versions) {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      (entry.id !== "current" && !isPoe1ReleaseId(entry.id)) ||
      typeof entry.label !== "string" ||
      !entry.label.trim() ||
      seen.has(entry.id)
    ) {
      throw new Error("The PoE1 tree-version list contains an invalid entry.");
    }
    seen.add(entry.id);
    versions.push({ id: entry.id, label: entry.label });
  }

  if (
    versions.length === 0 ||
    typeof input.defaultVersion !== "string" ||
    !seen.has(input.defaultVersion)
  ) {
    throw new Error("The PoE1 tree-version list has no usable default tree.");
  }

  const defaultCompareVersion =
    typeof input.defaultCompareVersion === "string" &&
    seen.has(input.defaultCompareVersion) &&
    input.defaultCompareVersion !== input.defaultVersion
      ? input.defaultCompareVersion
      : null;

  if (!Array.isArray(input.datasets)) {
    throw new Error("The PoE1 tree-dataset list is missing or malformed.");
  }
  const datasetIds = new Set();
  const datasets = [];
  for (const entry of input.datasets) {
    const versionId = entry?.versionId;
    const ruleset = entry?.ruleset;
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      typeof versionId !== "string" ||
      !seen.has(versionId) ||
      typeof ruleset !== "string" ||
      !Object.hasOwn(TREE_FILES, ruleset) ||
      typeof entry.id !== "string" ||
      entry.id !== getPoe1DatasetId(versionId, ruleset) ||
      typeof entry.label !== "string" ||
      !entry.label.trim() ||
      datasetIds.has(entry.id)
    ) {
      throw new Error("The PoE1 tree-dataset list contains an invalid entry.");
    }
    datasetIds.add(entry.id);
    datasets.push({
      id: entry.id,
      versionId,
      ruleset,
      label: entry.label,
    });
  }

  if (datasets.length === 0) {
    throw new Error("The PoE1 tree-dataset list has no usable tree.");
  }
  const defaultDataset =
    typeof input.defaultDataset === "string" &&
    datasetIds.has(input.defaultDataset)
      ? input.defaultDataset
      : null;
  if (!defaultDataset) {
    throw new Error("The PoE1 tree-dataset list has no usable default tree.");
  }
  const defaultCompareDataset =
    typeof input.defaultCompareDataset === "string" &&
    datasetIds.has(input.defaultCompareDataset) &&
    input.defaultCompareDataset !== defaultDataset
      ? input.defaultCompareDataset
      : null;

  return {
    defaultVersion: input.defaultVersion,
    defaultCompareVersion,
    versions,
    defaultDataset,
    defaultCompareDataset,
    datasets,
  };
}

function basePath(baseUrl) {
  if (typeof baseUrl !== "string") {
    throw new Error("A base URL is required for PoE1 tree assets.");
  }
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function getPoe1TreeFile(ruleset) {
  if (!Object.hasOwn(TREE_FILES, ruleset)) {
    throw new Error(`Unsupported PoE1 ruleset: ${ruleset}`);
  }
  const file = TREE_FILES[ruleset];
  return file;
}

export function getPoe1TreeUrl(baseUrl, ruleset, versionId = "current") {
  const versionPath =
    versionId === "current"
      ? ""
      : isPoe1ReleaseId(versionId)
        ? `versions/${versionId}/`
        : (() => {
            throw new Error(`Unsupported PoE1 tree version: ${versionId}`);
          })();
  return `${basePath(baseUrl)}data/poe1/${versionPath}${getPoe1TreeFile(ruleset)}`;
}

export function getPoe1TreeDatasetUrl(baseUrl, dataset) {
  if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
    throw new Error("A valid PoE1 tree dataset is required.");
  }
  const id = getPoe1DatasetId(dataset.versionId, dataset.ruleset);
  if (dataset.id !== id) {
    throw new Error("The PoE1 tree dataset identity does not match its source.");
  }
  return getPoe1TreeUrl(baseUrl, dataset.ruleset, dataset.versionId);
}

export function getPoe1AssetFileName(source) {
  if (typeof source !== "string" || !source.trim()) {
    throw new Error("The official PoE1 sprite has no filename.");
  }
  const withoutQuery = source.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  const parts = withoutQuery.split("/");
  if (
    parts.some((part) => part === "." || part === "..") ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(parts[parts.length - 1])
  ) {
    throw new Error(`Unsafe PoE1 sprite filename: ${source}`);
  }
  return parts[parts.length - 1];
}

export function getPoe1AssetUrl(baseUrl, source, versionId = "current") {
  const fileName = getPoe1AssetFileName(source);
  if (versionId === "current") {
    return `${basePath(baseUrl)}assets/poe1/${fileName}`;
  }
  if (!isPoe1ReleaseId(versionId)) {
    throw new Error(`Unsupported PoE1 tree version: ${versionId}`);
  }
  return `${basePath(baseUrl)}assets/poe1/versions/${versionId}/${fileName}`;
}
