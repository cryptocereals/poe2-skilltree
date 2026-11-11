#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(SCRIPT_DIR, "..", "..");
const DEFAULT_PUBLIC = join(SCRIPT_DIR, "..", "public");
const DEFAULT_LEGACY_COMMIT = process.env.V04_COMMIT || "859f2b1";
const VERSION_FILE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?\.json$/;
const VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function parseArchivedVersion(fileName) {
  const match = VERSION_FILE.exec(fileName);
  if (!match) return null;
  return `${match[1]}.${match[2]}.${match[3]}${match[4] ? `-${match[4]}` : ""}`;
}

function parseVersion(version) {
  const match = VERSION.exec(version);
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function comparePrerelease(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    if (a[i] === b[i]) continue;

    const aNumeric = /^\d+$/.test(a[i]);
    const bNumeric = /^\d+$/.test(b[i]);
    if (aNumeric && bNumeric) return Number(a[i]) - Number(b[i]);
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export function compareTreeVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return String(a).localeCompare(String(b));

  for (let i = 0; i < left.core.length; i++) {
    if (left.core[i] !== right.core[i]) return left.core[i] - right.core[i];
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function log(logger, level, message) {
  const method = typeof logger?.[level] === "function" ? logger[level] : logger?.log;
  if (typeof method === "function") method.call(logger, message);
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
    !data.nodes ||
    typeof data.nodes !== "object" ||
    Array.isArray(data.nodes) ||
    !Array.isArray(data.classes) ||
    !Array.isArray(data.edges)
  ) {
    throw new Error(`Unsupported skill-tree data in ${source}.`);
  }
}

function readLegacyTree({ root, outputPath, legacyCommit, execFileSyncImpl, logger }) {
  try {
    const output = execFileSyncImpl(
      "git",
      ["-C", root, "show", `${legacyCommit}:data.json`],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const contents = Buffer.isBuffer(output) ? output.toString("utf8") : String(output);
    validateTreeData(contents, `${legacyCommit}:data.json`);
    writeFileSync(outputPath, contents);
    return true;
  } catch (error) {
    log(logger, "error", `Could not extract v0.4 data from git history: ${error.message}`);

    if (!existsSync(outputPath)) return false;
    try {
      validateTreeData(readFileSync(outputPath, "utf8"), outputPath);
      return true;
    } catch {
      return false;
    }
  }
}

export function prepareTreeVersions({
  root = DEFAULT_ROOT,
  publicDirectory = DEFAULT_PUBLIC,
  legacyCommit = DEFAULT_LEGACY_COMMIT,
  execFileSyncImpl = execFileSync,
  logger = console,
} = {}) {
  const outputDirectory = join(publicDirectory, "data");
  mkdirSync(outputDirectory, { recursive: true });

  const currentPath = join(root, "data.json");
  validateTreeData(readFileSync(currentPath, "utf8"), currentPath);
  copyFileSync(currentPath, join(outputDirectory, "data-current.json"));
  // Keep the old URL available for integrations that still use the 0.5 alias.
  copyFileSync(currentPath, join(outputDirectory, "data-0.5.json"));

  const legacyPath = join(outputDirectory, "data-0.4.json");
  const hasLegacyTree = readLegacyTree({
    root,
    outputPath: legacyPath,
    legacyCommit,
    execFileSyncImpl,
    logger,
  });

  const archiveDirectory = join(root, "data", "skill-tree");
  const archiveVersions = [];
  if (existsSync(archiveDirectory)) {
    for (const fileName of readdirSync(archiveDirectory).sort()) {
      const version = parseArchivedVersion(fileName);
      if (!version) continue;

      const sourcePath = join(archiveDirectory, fileName);
      try {
        validateTreeData(readFileSync(sourcePath, "utf8"), sourcePath);
        copyFileSync(sourcePath, join(outputDirectory, `data-${version}.json`));
        archiveVersions.push(version);
      } catch (error) {
        log(logger, "warn", `Skipping invalid skill-tree archive ${fileName}: ${error.message}`);
      }
    }
  }

  const sortedArchives = [...new Set(archiveVersions)].sort((a, b) =>
    compareTreeVersions(b, a),
  );
  const versions = [
    { id: "current", label: "Current" },
    ...sortedArchives.map((id) => ({ id, label: id })),
  ];

  if (!sortedArchives.includes("0.4.0") && hasLegacyTree) {
    versions.push({ id: "0.4", label: "0.4.0" });
  }

  const legacyVersion = sortedArchives.includes("0.4.0")
    ? "0.4.0"
    : hasLegacyTree
      ? "0.4"
      : null;
  const defaultCompareVersion =
    legacyVersion ?? versions.find((version) => version.id !== "current")?.id ?? null;
  const manifest = {
    defaultVersion: "current",
    defaultCompareVersion,
    versions,
  };

  writeFileSync(
    join(outputDirectory, "tree-versions.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  log(logger, "log", `Prepared ${sortedArchives.length} archived tree version(s).`);
  return manifest;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    prepareTreeVersions();
  } catch (error) {
    console.error(`Tree-version preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
