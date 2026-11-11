import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { downloadLatestPoe1History } from "./poe1-history.mjs";

const REPOSITORY = "grindinggear/skilltree-export";
const BRANCH = "master";
const API_BASE = `https://api.github.com/repos/${REPOSITORY}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPOSITORY}`;
const DEFAULT_DATA_DIRECTORY = fileURLToPath(
  new URL("../../data/poe1/", import.meta.url),
);
const DEFAULT_ASSET_DIRECTORY = fileURLToPath(
  new URL("../../assets/poe1/", import.meta.url),
);
const REQUEST_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "poe1-skilltree-local-archive",
};
const TREE_FILES = ["data.json", "ruthless.json"];

function logMessage(logger, level, message) {
  const method =
    typeof logger?.[level] === "function" ? logger[level] : logger?.log;
  if (typeof method === "function") method.call(logger, message);
}

function validateFetcher(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This downloader requires Node.js 18 or newer with built-in fetch.");
  }
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

function assetFileName(value, source) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing sprite filename in ${source}.`);
  }
  const withoutQuery = value.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  const segments = withoutQuery.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe sprite filename in ${source}: ${value}`);
  }
  const fileName = segments[segments.length - 1];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(fileName)) {
    throw new Error(`Unsupported sprite filename in ${source}: ${value}`);
  }
  return fileName;
}

function getReferencedAssets(treeData, source) {
  const assets = new Set();
  for (const [atlasName, variants] of Object.entries(treeData.sprites)) {
    if (!variants || typeof variants !== "object" || Array.isArray(variants)) {
      throw new Error(`Malformed ${atlasName} sprite atlas in ${source}.`);
    }
    for (const [zoom, variant] of Object.entries(variants)) {
      const fileName = assetFileName(
        variant?.filename,
        `${source} (${atlasName} at zoom ${zoom})`,
      );
      assets.add(`assets/${fileName}`);
    }
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

async function readExistingManifest(dataDirectory, logger) {
  try {
    return JSON.parse(
      await readFile(join(dataDirectory, "manifest.json"), "utf8"),
    );
  } catch (error) {
    if (error.code === "ENOENT") return null;
    logMessage(logger, "warn", "Ignoring an unreadable PoE1 download manifest.");
    return null;
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
  const response = await request(fetchImpl, url, `PoE1 export file ${sourcePath}`);
  let contents;
  try {
    contents = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw new Error(`Could not read PoE1 export file ${sourcePath}: ${error.message}`, {
      cause: error,
    });
  }
  if (contents.length === 0) {
    throw new Error(`PoE1 export file ${sourcePath} was empty.`);
  }

  if (TREE_FILES.includes(sourcePath)) {
    let data;
    try {
      data = JSON.parse(contents.toString("utf8"));
    } catch (error) {
      throw new Error(`Invalid JSON in official PoE1 file ${sourcePath}: ${error.message}`, {
        cause: error,
      });
    }
    validateTreeData(data, sourcePath);
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

export async function downloadPoe1Trees({
  dataDirectory = DEFAULT_DATA_DIRECTORY,
  assetDirectory = DEFAULT_ASSET_DIRECTORY,
  fetchImpl = globalThis.fetch,
  logger = console,
  concurrency = 6,
} = {}) {
  validateFetcher(fetchImpl);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error("concurrency must be an integer from 1 to 16.");
  }

  const outputDataDirectory = resolve(dataDirectory);
  const outputAssetDirectory = resolve(assetDirectory);
  const commitResponse = await request(
    fetchImpl,
    `${API_BASE}/commits/${BRANCH}`,
    "official PoE1 branch commit",
  );
  let commitInfo;
  try {
    commitInfo = await commitResponse.json();
  } catch (error) {
    throw new Error(`Could not parse the official PoE1 branch commit: ${error.message}`, {
      cause: error,
    });
  }
  const commit = commitInfo?.sha;
  if (typeof commit !== "string" || !/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error("The official PoE1 branch did not return a valid commit SHA.");
  }

  const treeResponse = await request(
    fetchImpl,
    `${API_BASE}/git/trees/${commit}?recursive=1`,
    "official PoE1 file list",
  );
  let upstreamTree;
  try {
    upstreamTree = await treeResponse.json();
  } catch (error) {
    throw new Error(`Could not parse the official PoE1 file list: ${error.message}`, {
      cause: error,
    });
  }
  if (upstreamTree?.truncated || !Array.isArray(upstreamTree?.tree)) {
    throw new Error("The official PoE1 file list is incomplete or malformed.");
  }

  const upstreamFiles = new Set(
    upstreamTree.tree
      .filter(
        (entry) =>
          entry?.type === "blob" &&
          typeof entry.path === "string" &&
          entry.path.startsWith("assets/"),
      )
      .map((entry) => safeUpstreamPath(entry.path))
  );
  for (const file of TREE_FILES) {
    if (!upstreamFiles.has(file) && !upstreamTree.tree.some((entry) => entry?.path === file)) {
      throw new Error(`The official PoE1 export is missing ${file}.`);
    }
  }

  const sourceFiles = [...TREE_FILES, ...upstreamFiles].sort((a, b) => {
    const aTree = TREE_FILES.includes(a);
    const bTree = TREE_FILES.includes(b);
    if (aTree !== bTree) return aTree ? -1 : 1;
    return a.localeCompare(b);
  });
  const previousManifest = await readExistingManifest(outputDataDirectory, logger);
  const previousFiles =
    previousManifest?.commit === commit && previousManifest.files
      ? previousManifest.files
      : {};
  const filesToDownload = [];
  const fileRecords = {};
  let skipped = 0;

  for (const sourcePath of sourceFiles) {
    const previousSha = previousFiles[sourcePath]?.sha256;
    if (
      await isCurrentFile(
        sourcePath,
        previousSha,
        outputDataDirectory,
        outputAssetDirectory,
      )
    ) {
      fileRecords[sourcePath] = previousFiles[sourcePath];
      skipped += 1;
    } else {
      filesToDownload.push(sourcePath);
    }
  }

  let downloaded = 0;
  await runWithConcurrency(filesToDownload, concurrency, async (sourcePath) => {
    const record = await downloadFile({
      sourcePath,
      commit,
      dataDirectory: outputDataDirectory,
      assetDirectory: outputAssetDirectory,
      fetchImpl,
    });
    fileRecords[sourcePath] = record;
    downloaded += 1;
    return record;
  });

  const trees = {};
  for (const sourcePath of TREE_FILES) {
    const data = JSON.parse(
      await readFile(filePathFor(sourcePath, outputDataDirectory, outputAssetDirectory), "utf8"),
    );
    trees[sourcePath] = validateTreeData(data, sourcePath);
  }

  const actualAssets = new Set(upstreamFiles);
  for (const file of TREE_FILES) {
    for (const referenced of getReferencedAssets(trees[file], file)) {
      if (!actualAssets.has(referenced)) {
        throw new Error(`${file} references an asset missing from the official export: ${referenced}`);
      }
    }
  }

  const message = String(commitInfo.commit?.message ?? "").split(/\r?\n/, 1)[0].trim();
  const release = /^(?:v)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\s|$)/.exec(message)?.[1] ?? null;
  const manifest = {
    repository: `https://github.com/${REPOSITORY}`,
    branch: BRANCH,
    commit,
    release,
    trees: { standard: "data.json", ruthless: "ruthless.json" },
    assetsDirectory: "assets/poe1",
    files: fileRecords,
  };
  await writeAtomically(
    join(outputDataDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const historical = await downloadLatestPoe1History({
    currentCommit: commit,
    dataDirectory: outputDataDirectory,
    assetDirectory: outputAssetDirectory,
    fetchImpl,
    logger,
    concurrency,
  });

  logMessage(
    logger,
    "log",
    `PoE1 ${release ?? commit.slice(0, 7)} ready: ${downloaded} downloaded, ${skipped} unchanged file(s), ${upstreamFiles.size} asset(s); ${historical.count} history snapshot(s).`,
  );
  return {
    commit,
    release,
    downloaded,
    skipped,
    assets: upstreamFiles.size,
    historical,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  downloadPoe1Trees().catch((error) => {
    console.error(`PoE1 Skill Tree Data download failed: ${error.message}`);
    process.exitCode = 1;
  });
}
