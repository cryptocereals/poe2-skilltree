import { isPoe1ReleaseId } from "../../app/src/features/poe1/data/source.mjs";
import { downloadPoe1Snapshot } from "./download-poe1-archive.mjs";

const REPOSITORY = "grindinggear/skilltree-export";
const API_BASE = `https://api.github.com/repos/${REPOSITORY}`;
const REQUEST_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "poe1-skilltree-local-archive",
};
const HISTORY_PAGE_SIZE = 100;
const MAX_HISTORY_PAGES = 20;

export const POE1_HISTORY_SNAPSHOT_COUNT = 10;

function logMessage(logger, level, message) {
  const method =
    typeof logger?.[level] === "function" ? logger[level] : logger?.log;
  if (typeof method === "function") method.call(logger, message);
}

function normalizeSuffix(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function versionIdFromTitle(title) {
  const match =
    /(?:^|[^A-Za-z0-9])v?(\d+\.\d+\.\d+)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)|([A-Za-z][0-9A-Za-z]*))?(?=$|[^A-Za-z0-9])/i.exec(
      title,
    );
  if (!match) return null;

  const titleSuffix = normalizeSuffix(
    title.slice(match.index + match[0].length),
  );
  const releaseSuffix = normalizeSuffix(match[2] ?? match[3] ?? "");
  const suffix = [releaseSuffix, titleSuffix].filter(Boolean).join("-");
  const id = suffix ? `${match[1]}-${suffix}` : match[1];
  return isPoe1ReleaseId(id) ? id : null;
}

function uniqueSnapshotId(baseId, commit, usedIds) {
  if (!usedIds.has(baseId)) return baseId;
  for (const length of [8, 12, 16, 24, 40]) {
    const candidate = `${baseId}-${commit.slice(0, length).toLowerCase()}`;
    if (!usedIds.has(candidate) && isPoe1ReleaseId(candidate)) return candidate;
  }
  throw new Error(`Could not create a unique PoE1 snapshot id for ${commit}.`);
}

function commitDate(commit) {
  const value = commit?.committer?.date ?? commit?.author?.date;
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function describeSnapshots(commits, anchorCommit) {
  const usedIds = new Set();
  return commits.map(({ commit, title, committedAt }, historyOrder) => {
    const versionId = versionIdFromTitle(title);
    const baseId =
      versionId ?? `0.0.0-history-${commit.slice(0, 8).toLowerCase()}`;
    const id = uniqueSnapshotId(baseId, commit, usedIds);
    usedIds.add(id);

    const labelTitle = title || "PoE1 tree snapshot";
    const label =
      !versionId || id !== baseId
        ? `${labelTitle} (${commit.slice(0, 7)})`
        : labelTitle;
    return {
      id,
      label,
      title: labelTitle,
      commit,
      committedAt,
      historyOrder,
      anchorCommit,
    };
  });
}

async function requestJson(fetchImpl, url, description) {
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
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Could not parse ${description}: ${error.message}`, {
      cause: error,
    });
  }
}

export async function discoverPoe1TreeHistory({
  currentCommit,
  fetchImpl = globalThis.fetch,
  limit = POE1_HISTORY_SNAPSHOT_COUNT,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This downloader requires Node.js 18 or newer with built-in fetch.");
  }
  if (typeof currentCommit !== "string" || !/^[a-f0-9]{40}$/i.test(currentCommit)) {
    throw new Error("A valid current PoE1 commit SHA is required to discover history.");
  }
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > HISTORY_PAGE_SIZE * MAX_HISTORY_PAGES
  ) {
    throw new Error(
      `PoE1 history limit must be an integer from 1 to ${HISTORY_PAGE_SIZE * MAX_HISTORY_PAGES}.`,
    );
  }

  const commits = [];
  const seenCommits = new Set([currentCommit.toLowerCase()]);
  for (
    let page = 1;
    page <= MAX_HISTORY_PAGES && commits.length < limit;
    page += 1
  ) {
    const url = new URL(`${API_BASE}/commits`);
    url.searchParams.set("path", "data.json");
    url.searchParams.set("sha", currentCommit);
    url.searchParams.set("per_page", String(HISTORY_PAGE_SIZE));
    url.searchParams.set("page", String(page));

    const entries = await requestJson(
      fetchImpl,
      url,
      `PoE1 data.json history page ${page}`,
    );
    if (!Array.isArray(entries)) {
      throw new Error(`The PoE1 data.json history page ${page} is malformed.`);
    }

    for (const entry of entries) {
      const commit = entry?.sha;
      if (typeof commit !== "string" || !/^[a-f0-9]{40}$/i.test(commit)) {
        throw new Error(`The PoE1 data.json history page ${page} contains an invalid commit.`);
      }
      const normalizedCommit = commit.toLowerCase();
      if (seenCommits.has(normalizedCommit)) continue;
      seenCommits.add(normalizedCommit);

      const message = entry?.commit?.message;
      const title =
        typeof message === "string" ? message.split(/\r?\n/, 1)[0].trim() : "";
      commits.push({
        commit: normalizedCommit,
        title,
        committedAt: commitDate(entry?.commit),
      });
      if (commits.length === limit) break;
    }

    if (commits.length < limit && entries.length < HISTORY_PAGE_SIZE) break;
  }

  if (commits.length < limit) {
    throw new Error(
      `PoE1 history is incomplete: found ${commits.length} distinct data.json commit(s) after ${currentCommit.slice(0, 7)}; ${limit} required.`,
    );
  }
  return describeSnapshots(commits, currentCommit.toLowerCase());
}

export async function downloadLatestPoe1History({
  currentCommit,
  dataDirectory,
  assetDirectory,
  fetchImpl = globalThis.fetch,
  logger = console,
  concurrency = 6,
  limit = POE1_HISTORY_SNAPSHOT_COUNT,
} = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error("concurrency must be an integer from 1 to 16.");
  }

  const snapshots = await discoverPoe1TreeHistory({
    currentCommit,
    fetchImpl,
    limit,
  });
  const results = [];
  for (const snapshot of snapshots) {
    try {
      results.push(
        await downloadPoe1Snapshot({
          snapshot,
          dataDirectory,
          assetDirectory,
          fetchImpl,
          logger,
          concurrency,
        }),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `PoE1 history download incomplete: ${results.length} of ${limit} snapshots saved; failed ${snapshot.historyOrder + 1}/${limit} (${snapshot.label}): ${reason}`,
        { cause: error },
      );
    }
  }

  const summary = {
    requested: limit,
    count: results.length,
    downloaded: results.reduce((total, result) => total + result.downloaded, 0),
    skipped: results.reduce((total, result) => total + result.skipped, 0),
    assets: results.reduce((total, result) => total + result.assets, 0),
    snapshots: results,
  };
  logMessage(
    logger,
    "log",
    `PoE1 history ready: ${summary.count} snapshots, ${summary.downloaded} downloaded, ${summary.skipped} unchanged file(s).`,
  );
  return summary;
}
