import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY = "grindinggear/poe2-skilltree-export";
const UPSTREAM_DATA_PATH = "data.json";
const COMMITS_API_URL = `https://api.github.com/repos/${REPOSITORY}/commits`;
const RAW_DATA_URL = `https://raw.githubusercontent.com/${REPOSITORY}`;
const DEFAULT_DESTINATION = fileURLToPath(
  new URL("../../data/skill-tree/", import.meta.url),
);
const MAX_PAGE_SIZE = 100;
const REQUEST_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "poe2-skilltree-version-archive",
};
const VERSION_SUBJECT =
  /^\s*v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?=$|\s)/;

export function extractVersionFromSubject(subject) {
  if (typeof subject !== "string") return null;

  const firstLine = subject.split(/\r?\n/, 1)[0].trim();
  const match = VERSION_SUBJECT.exec(firstLine);
  if (!match) return null;

  const coreVersion = `${match[1]}.${match[2]}.${match[3]}`;
  return match[4] ? `${coreVersion}-${match[4]}` : coreVersion;
}

function logMessage(logger, level, message) {
  const method = typeof logger?.[level] === "function" ? logger[level] : logger?.log;
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

export async function collectVersionCommits({
  fetchImpl = globalThis.fetch,
  perPage = MAX_PAGE_SIZE,
  logger = console,
} = {}) {
  validateFetcher(fetchImpl);
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > MAX_PAGE_SIZE) {
    throw new Error(`perPage must be an integer from 1 to ${MAX_PAGE_SIZE}.`);
  }

  const selectedVersions = new Map();
  let page = 1;

  while (true) {
    const url = new URL(COMMITS_API_URL);
    url.searchParams.set("path", UPSTREAM_DATA_PATH);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    const response = await request(fetchImpl, url, "GitHub commit history");
    let commits;
    try {
      commits = await response.json();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not parse GitHub commit history page ${page}: ${reason}`, {
        cause: error,
      });
    }
    if (!Array.isArray(commits)) {
      throw new Error(`GitHub commit history page ${page} was not a JSON array.`);
    }

    for (const [index, commit] of commits.entries()) {
      if (
        typeof commit?.sha !== "string" ||
        !/^[a-f0-9]{40}$/i.test(commit.sha) ||
        typeof commit.commit?.message !== "string"
      ) {
        throw new Error(
          `Malformed commit record on GitHub history page ${page} at index ${index}.`,
        );
      }

      const subject = commit.commit.message.split(/\r?\n/, 1)[0].trim();
      const version = extractVersionFromSubject(subject);
      const shortSha = commit.sha.slice(0, 7);
      if (!version) {
        logMessage(
          logger,
          "warn",
          `Skipping non-version commit ${shortSha}: ${subject || "(empty subject)"}`,
        );
        continue;
      }

      const newest = selectedVersions.get(version);
      if (newest) {
        logMessage(
          logger,
          "log",
          `Skipping duplicate version ${version} from ${shortSha}; keeping newer commit ${newest.sha.slice(0, 7)}.`,
        );
        continue;
      }

      selectedVersions.set(version, { sha: commit.sha, subject, version });
    }

    if (commits.length < perPage) break;
    page += 1;
  }

  const versionCommits = [...selectedVersions.values()];
  logMessage(
    logger,
    "log",
    `Found ${versionCommits.length} versioned commit(s) for ${UPSTREAM_DATA_PATH}.`,
  );
  return versionCommits;
}

async function inspectArchive(filePath) {
  let contents;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "missing";
    throw new Error(`Could not read existing archive ${filePath}: ${error.message}`, {
      cause: error,
    });
  }

  try {
    JSON.parse(contents);
    return "valid";
  } catch (error) {
    if (error instanceof SyntaxError) return "invalid";
    throw error;
  }
}

async function writeArchiveAtomically(destination, filePath, contents, version) {
  await mkdir(destination, { recursive: true });
  const temporaryPath = join(
    destination,
    `.${version}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw new Error(`Could not save archive for ${version}: ${error.message}`, {
      cause: error,
    });
  }
}

export async function downloadSkillTreeData({
  destination = DEFAULT_DESTINATION,
  fetchImpl = globalThis.fetch,
  logger = console,
  perPage = MAX_PAGE_SIZE,
} = {}) {
  validateFetcher(fetchImpl);
  const outputDirectory = resolve(destination);
  const versionCommits = await collectVersionCommits({ fetchImpl, logger, perPage });
  let downloaded = 0;
  let skipped = 0;

  for (const commit of versionCommits) {
    const fileName = `${commit.version}.json`;
    const filePath = join(outputDirectory, fileName);
    const existing = await inspectArchive(filePath);
    if (existing === "valid") {
      logMessage(logger, "log", `Skipping existing valid archive: ${fileName}`);
      skipped += 1;
      continue;
    }
    if (existing === "invalid") {
      logMessage(logger, "warn", `Replacing invalid archive: ${fileName}`);
    }

    const rawUrl = `${RAW_DATA_URL}/${commit.sha}/${UPSTREAM_DATA_PATH}`;
    const response = await request(fetchImpl, rawUrl, `skill-tree data for ${commit.version}`);
    let contents;
    try {
      contents = await response.text();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not read skill-tree data for ${commit.version}: ${reason}`, {
        cause: error,
      });
    }
    if (typeof contents !== "string") {
      throw new Error(`Skill-tree data for ${commit.version} was not text.`);
    }

    try {
      JSON.parse(contents);
    } catch (error) {
      throw new Error(
        `Invalid JSON for ${commit.version} from commit ${commit.sha}: ${error.message}`,
        { cause: error },
      );
    }

    await writeArchiveAtomically(outputDirectory, filePath, contents, commit.version);
    logMessage(logger, "log", `Downloaded ${fileName} from ${commit.sha.slice(0, 7)}.`);
    downloaded += 1;
  }

  logMessage(
    logger,
    "log",
    `Download complete: ${downloaded} downloaded, ${skipped} existing valid archive(s) skipped.`,
  );
  return { downloaded, skipped };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  downloadSkillTreeData().catch((error) => {
    console.error(`Skill Tree Data download failed: ${error.message}`);
    process.exitCode = 1;
  });
}
