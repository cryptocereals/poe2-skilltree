import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  getPoe1AssetFileName,
  isPoe1ReleaseId,
  POE1_RUNTIME_ATLAS_NAMES,
} from "../../app/src/features/poe1/data/source.mjs";

const REPOSITORY = "grindinggear/skilltree-export";
const API_BASE = `https://api.github.com/repos/${REPOSITORY}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPOSITORY}`;
const REQUEST_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "poe1-skilltree-local-archive",
};
const TREE_FILES = ["data.json", "ruthless.json"];
const REQUIRED_ATLASES = new Set(["normalActive", "normalInactive", "frame"]);
const RELEASE_TAG = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function logMessage(logger, level, message) {
  const method =
    typeof logger?.[level] === "function" ? logger[level] : logger?.log;
  if (typeof method === "function") method.call(logger, message);
}

function releaseParts(value) {
  const match = RELEASE_TAG.exec(String(value));
  return match ? match.slice(1).map(Number) : null;
}

export function comparePoe1Releases(left, right) {
  const a = releaseParts(left);
  const b = releaseParts(right);
  if (!a || !b) return String(left).localeCompare(String(right));
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function choosePreviousPoe1Release(tags, currentRelease) {
  const currentParts = releaseParts(currentRelease);
  if (!currentParts || !Array.isArray(tags)) return null;

  const candidates = tags.flatMap((tag) => {
    if (typeof tag?.name !== "string") return [];
    const parts = releaseParts(tag.name);
    if (!parts || comparePoe1Releases(parts.join("."), currentParts.join(".")) >= 0) {
      return [];
    }
    return [{ id: parts.join("."), ref: tag.name }];
  });
  candidates.sort((left, right) => comparePoe1Releases(right.id, left.id));
  return candidates[0] ?? null;
}

async function request(fetchImpl, url, description) {
  let response;
  try {
    response = await fetchImpl(url, { headers: REQUEST_HEADERS });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Request failed for ${description}: ${reason}`, { cause: error });
  }
  if (!response?.ok) {
    throw new Error(
      `HTTP ${response?.status ?? "unknown"} while requesting ${description}: ${url}`,
    );
  }
  return response;
}

async function responseJson(response, description) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Could not parse ${description}: ${error.message}`, {
      cause: error,
    });
  }
}

function validateTreeData(data, source) {
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
    typeof data.sprites !== "object" ||
    Array.isArray(data.sprites)
  ) {
    throw new Error(`Unsupported PoE1 skill-tree data in ${source}.`);
  }
  return data;
}

function selectVariant(variants) {
  if (variants["0.5"]) return variants["0.5"];
  return Object.entries(variants)
    .filter(([zoom, variant]) => Number.isFinite(Number(zoom)) && variant?.filename)
    .sort(([left], [right]) => Number(right) - Number(left))[0]?.[1];
}

function getRuntimeAssets(treeData, source) {
  const assets = new Set();
  for (const atlasName of POE1_RUNTIME_ATLAS_NAMES) {
    const variants = treeData.sprites[atlasName];
    if (!variants) {
      if (REQUIRED_ATLASES.has(atlasName)) {
        throw new Error(`The PoE1 tree is missing its ${atlasName} sprite atlas.`);
      }
      continue;
    }
    if (typeof variants !== "object" || Array.isArray(variants)) {
      throw new Error(`Malformed ${atlasName} sprite atlas in ${source}.`);
    }
    const variant = selectVariant(variants);
    if (!variant) {
      if (REQUIRED_ATLASES.has(atlasName)) {
        throw new Error(`The PoE1 ${atlasName} sprite atlas has no usable resolution.`);
      }
      continue;
    }
    const fileName = getPoe1AssetFileName(variant.filename);
    assets.add(`assets/${fileName}`);
  }
  return assets;
}

function safeUpstreamPath(value) {
  if (TREE_FILES.includes(value)) return value;
  if (typeof value !== "string" || !value.startsWith("assets/")) {
    throw new Error(`Unexpected file in the official PoE1 export: ${value}`);
  }
  const parts = value.split("/");
  if (
    parts.length < 2 ||
    parts[0] !== "assets" ||
    parts.slice(1).some(
      (part) => !/^[A-Za-z0-9._-]+$/.test(part) || part === "." || part === "..",
    )
  ) {
    throw new Error(`Unsafe file path in the official PoE1 export: ${value}`);
  }
  return value;
}

function filePathFor(sourcePath, dataDirectory, assetDirectory) {
  if (TREE_FILES.includes(sourcePath)) return join(dataDirectory, sourcePath);
  return join(assetDirectory, ...sourcePath.slice("assets/".length).split("/"));
}

function digest(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function writeAtomically(filePath, contents) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, contents, { flag: "wx" });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw new Error(`Could not save ${filePath}: ${error.message}`, {
      cause: error,
    });
  }
}

async function isCurrentFile(sourcePath, expectedSha, dataDirectory, assetDirectory) {
  if (typeof expectedSha !== "string") return false;
  try {
    const contents = await readFile(
      filePathFor(sourcePath, dataDirectory, assetDirectory),
    );
    return digest(contents) === expectedSha;
  } catch {
    return false;
  }
}

async function readArchiveManifest(dataDirectory, logger) {
  try {
    return JSON.parse(await readFile(join(dataDirectory, "manifest.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      logMessage(logger, "warn", "Ignoring an unreadable PoE1 archive manifest.");
    }
    return null;
  }
}

async function downloadFile({
  sourcePath,
  commit,
  dataDirectory,
  assetDirectory,
  fetchImpl,
}) {
  const encodedPath = sourcePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const url = `${RAW_BASE}/${commit}/${encodedPath}`;
  const response = await request(fetchImpl, url, `PoE1 ${sourcePath} at ${commit.slice(0, 7)}`);
  let contents;
  try {
    contents = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw new Error(`Could not read PoE1 archive file ${sourcePath}: ${error.message}`, {
      cause: error,
    });
  }
  if (contents.length === 0) {
    throw new Error(`PoE1 archive file ${sourcePath} was empty.`);
  }

  if (TREE_FILES.includes(sourcePath)) {
    let data;
    try {
      data = JSON.parse(contents.toString("utf8"));
    } catch (error) {
      throw new Error(`Invalid JSON in PoE1 archive ${sourcePath}: ${error.message}`, {
        cause: error,
      });
    }
    validateTreeData(data, `${commit}:${sourcePath}`);
  }

  await writeAtomically(
    filePathFor(sourcePath, dataDirectory, assetDirectory),
    contents,
  );
  return { sha256: digest(contents), bytes: contents.length };
}

async function runWithConcurrency(items, concurrency, callback) {
  let nextIndex = 0;
  const results = new Array(items.length);
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await callback(items[index]);
      }
    }),
  );
  return results;
}

async function downloadSnapshotFiles({
  sources,
  commit,
  dataDirectory,
  assetDirectory,
  fetchImpl,
  previousFiles,
  concurrency,
  fileRecords,
  counters,
}) {
  const filesToDownload = [];
  for (const sourcePath of sources) {
    const previousRecord = previousFiles[sourcePath];
    if (
      await isCurrentFile(
        sourcePath,
        previousRecord?.sha256,
        dataDirectory,
        assetDirectory,
      )
    ) {
      fileRecords[sourcePath] = previousRecord;
      counters.skipped += 1;
    } else {
      filesToDownload.push(sourcePath);
    }
  }

  await runWithConcurrency(filesToDownload, concurrency, async (sourcePath) => {
    const record = await downloadFile({
      sourcePath,
      commit,
      dataDirectory,
      assetDirectory,
      fetchImpl,
    });
    fileRecords[sourcePath] = record;
    counters.downloaded += 1;
  });
}

export async function downloadPoe1Snapshot({
  snapshot,
  dataDirectory,
  assetDirectory,
  fetchImpl = globalThis.fetch,
  logger = console,
  concurrency = 6,
} = {}) {
  const { id, label, title, commit, committedAt, historyOrder, anchorCommit } =
    snapshot ?? {};
  if (typeof fetchImpl !== "function") {
    throw new Error("This downloader requires Node.js 18 or newer with built-in fetch.");
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error("concurrency must be an integer from 1 to 16.");
  }
  if (!isPoe1ReleaseId(id)) {
    throw new Error(`Unsupported PoE1 history snapshot id: ${id}`);
  }
  if (typeof commit !== "string" || !/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error(`PoE1 history snapshot ${id} has an invalid commit SHA.`);
  }
  if (!Number.isInteger(historyOrder) || historyOrder < 0) {
    throw new Error(`PoE1 history snapshot ${id} has an invalid history order.`);
  }

  const treeResponse = await request(
    fetchImpl,
    `${API_BASE}/git/trees/${commit}?recursive=1`,
    `official PoE1 ${id} file list`,
  );
  const upstreamTree = await responseJson(
    treeResponse,
    `the PoE1 ${id} file list`,
  );
  if (upstreamTree?.truncated || !Array.isArray(upstreamTree?.tree)) {
    throw new Error(`The PoE1 ${id} file list is incomplete or malformed.`);
  }

  const upstreamFiles = new Set(
    upstreamTree.tree
      .filter(
        (entry) =>
          entry?.type === "blob" &&
          typeof entry.path === "string" &&
          entry.path.startsWith("assets/"),
      )
      .map((entry) => safeUpstreamPath(entry.path)),
  );
  for (const file of TREE_FILES) {
    if (!upstreamTree.tree.some((entry) => entry?.type === "blob" && entry.path === file)) {
      throw new Error(`The official PoE1 ${id} export is missing ${file}.`);
    }
  }

  const archiveDataDirectory = resolve(dataDirectory, "versions", id);
  const archiveAssetDirectory = resolve(assetDirectory, "versions", id);
  const existingManifest = await readArchiveManifest(archiveDataDirectory, logger);
  const previousFiles =
    existingManifest?.commit === commit && existingManifest.files
      ? existingManifest.files
      : {};
  const fileRecords = {};
  const counters = { downloaded: 0, skipped: 0 };

  await downloadSnapshotFiles({
    sources: TREE_FILES,
    commit,
    dataDirectory: archiveDataDirectory,
    assetDirectory: archiveAssetDirectory,
    fetchImpl,
    previousFiles,
    concurrency,
    fileRecords,
    counters,
  });

  const trees = {};
  for (const sourcePath of TREE_FILES) {
    const data = JSON.parse(
      await readFile(
        filePathFor(sourcePath, archiveDataDirectory, archiveAssetDirectory),
        "utf8",
      ),
    );
    trees[sourcePath] = validateTreeData(data, `${id}:${sourcePath}`);
  }

  const requiredAssets = new Set();
  for (const sourcePath of TREE_FILES) {
    for (const asset of getRuntimeAssets(trees[sourcePath], `${id}:${sourcePath}`)) {
      requiredAssets.add(asset);
    }
  }
  for (const asset of requiredAssets) {
    if (!upstreamFiles.has(asset)) {
      throw new Error(
        `${id} references an asset missing from the official export: ${asset}`,
      );
    }
  }

  await downloadSnapshotFiles({
    sources: [...requiredAssets].sort(),
    commit,
    dataDirectory: archiveDataDirectory,
    assetDirectory: archiveAssetDirectory,
    fetchImpl,
    previousFiles,
    concurrency,
    fileRecords,
    counters,
  });

  const manifest = {
    repository: `https://github.com/${REPOSITORY}`,
    branch: "master",
    commit,
    release: id,
    label,
    title,
    committedAt,
    historyOrder,
    historyAnchorCommit: anchorCommit,
    historyPath: "data.json",
    trees: { standard: "data.json", ruthless: "ruthless.json" },
    assetsDirectory: `assets/poe1/versions/${id}`,
    files: fileRecords,
  };
  await writeAtomically(
    join(archiveDataDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  logMessage(
    logger,
    "log",
    `PoE1 ${label} archive ready: ${counters.downloaded} downloaded, ${counters.skipped} unchanged file(s), ${requiredAssets.size} runtime asset(s).`,
  );
  return {
    id,
    label,
    title,
    commit,
    committedAt,
    historyOrder,
    anchorCommit,
    downloaded: counters.downloaded,
    skipped: counters.skipped,
    assets: requiredAssets.size,
  };
}
