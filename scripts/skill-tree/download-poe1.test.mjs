import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { downloadPoe1Trees } from "./download-poe1.mjs";

const COMMIT = "a".repeat(40);
const HISTORY_TITLES = [
  "3.29.0 preview 2",
  "Curse of the Allflame Passive Tree preview",
  "3.29.0 preview 1",
  "3.28.0j",
  "3.28.0 preview",
  "3.27.0",
  "3.27.0",
  "3.26.0 preview 2",
  "3.26.0 preview 1",
  "3.25.0",
  "3.24.0",
  "3.23.0",
];

function numberedSha(number) {
  const hex = number.toString(16);
  return `${hex.padStart(8, "0")}${hex.padStart(32, "0")}`;
}

const HISTORY_COMMITS = HISTORY_TITLES.map((title, index) => ({
  sha: numberedSha(index + 2),
  commit: {
    message: title,
    committer: { date: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z` },
  },
}));

function treeData(label, assetPrefix = "") {
  return {
    tree: label,
    classes: [],
    groups: {},
    nodes: {},
    constants: { orbitRadii: [0], skillsPerOrbit: [1] },
    sprites: {
      normalActive: {
        "0.5": {
          filename: `https://web.poecdn.com/image/passive-skill/${assetPrefix}skills-4.jpg?v=1`,
          w: 1,
          h: 1,
          coords: {},
        },
      },
      normalInactive: {
        "0.5": {
          filename: `https://web.poecdn.com/image/passive-skill/${assetPrefix}skills-disabled-4.jpg?v=1`,
          w: 1,
          h: 1,
          coords: {},
        },
      },
      frame: {
        "0.5": {
          filename: `https://web.poecdn.com/image/passive-skill/${assetPrefix}frame-4.png?v=1`,
          w: 1,
          h: 1,
          coords: {},
        },
      },
    },
  };
}

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

function binaryResponse(value, status = 200) {
  const buffer = Buffer.from(value);
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

function makeLogger() {
  const messages = { log: [], warn: [] };
  return {
    messages,
    log: (message) => messages.log.push(message),
    warn: (message) => messages.warn.push(message),
  };
}

async function makeWorkspace(t) {
  const root = await mkdtemp(join(tmpdir(), "poe1-skill-tree-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    dataDirectory: join(root, "data", "poe1"),
    assetDirectory: join(root, "assets", "poe1"),
  };
}

function makeFetcher({
  failRaw = false,
  historyCount = HISTORY_COMMITS.length,
  missingHistoryFile = null,
  missingHistoryAsset = false,
} = {}) {
  const rawFiles = new Map([
    ["data.json", Buffer.from(JSON.stringify(treeData("Default")))],
    ["ruthless.json", Buffer.from(JSON.stringify(treeData("Default Ruthless")))],
    ["assets/skills-4.jpg", Buffer.from([1, 2, 3, 4])],
    ["assets/skills-disabled-4.jpg", Buffer.from([2, 3, 4, 5])],
    ["assets/frame-4.png", Buffer.from([3, 4, 5, 6])],
  ]);
  const historyFiles = new Map();
  for (const [index, entry] of HISTORY_COMMITS.entries()) {
    const prefix = `history-${index}-`;
    historyFiles.set(
      entry.sha,
      new Map([
        ["data.json", Buffer.from(JSON.stringify(treeData(entry.commit.message, prefix)))],
        [
          "ruthless.json",
          Buffer.from(JSON.stringify(treeData(`${entry.commit.message} Ruthless`, prefix))),
        ],
        [`assets/${prefix}skills-4.jpg`, Buffer.from([7, index, 8, 10])],
        [`assets/${prefix}skills-disabled-4.jpg`, Buffer.from([8, index, 9, 11])],
        [`assets/${prefix}frame-4.png`, Buffer.from([9, index, 10, 12])],
      ]),
    );
  }
  const requests = { api: [], raw: [] };
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/commits/master")) {
      requests.api.push(url.href);
      return jsonResponse({ sha: COMMIT, commit: { message: "3.29.1" } });
    }
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/commits")) {
      requests.api.push(url.href);
      const entries = [
        { sha: COMMIT, commit: { message: "3.29.1" } },
        ...HISTORY_COMMITS.slice(0, historyCount),
      ];
      const page = Number(url.searchParams.get("page") ?? 1);
      const perPage = Number(url.searchParams.get("per_page") ?? 100);
      return jsonResponse(entries.slice((page - 1) * perPage, page * perPage));
    }
    const treeMatch = url.pathname.match(/\/git\/trees\/([a-f0-9]{40})$/i);
    if (url.hostname === "api.github.com" && treeMatch) {
      const commit = treeMatch[1].toLowerCase();
      requests.api.push(url.href);
      if (commit === COMMIT) {
        return jsonResponse({
          truncated: false,
          tree: [
            { path: "README.md", type: "blob" },
            { path: "data.json", type: "blob" },
            { path: "ruthless.json", type: "blob" },
            { path: "assets/skills-4.jpg", type: "blob" },
            { path: "assets/skills-disabled-4.jpg", type: "blob" },
            { path: "assets/frame-4.png", type: "blob" },
          ],
        });
      }

      const historyIndex = HISTORY_COMMITS.findIndex((entry) => entry.sha === commit);
      const files = historyFiles.get(commit);
      if (!files) return jsonResponse({}, 404);
      const historyPaths = [...files.keys()];
      if (historyIndex === 0 && missingHistoryFile) {
        const index = historyPaths.indexOf(missingHistoryFile);
        if (index >= 0) historyPaths.splice(index, 1);
      }
      if (historyIndex === 0 && missingHistoryAsset) {
        const index = historyPaths.findIndex((path) => path.startsWith("assets/"));
        if (index >= 0) historyPaths.splice(index, 1);
      }
      return jsonResponse({
        truncated: false,
        tree: historyPaths.map((path) => ({ path, type: "blob" })),
      });
    }
    const rawMatch = url.pathname.match(/\/([a-f0-9]{40})\/(.+)$/i);
    if (!rawMatch) return binaryResponse("not found", 404);
    const commit = rawMatch[1].toLowerCase();
    const sourcePath = rawMatch[2];
    const isHistory = commit !== COMMIT;
    requests.raw.push(`${isHistory ? "history" : "current"}:${commit}:${sourcePath}`);
    if (failRaw) return binaryResponse("unavailable", 503);
    const contents = (isHistory ? historyFiles.get(commit) : rawFiles)?.get(sourcePath);
    return contents ? binaryResponse(contents) : binaryResponse("missing", 404);
  };
  return { fetchImpl, requests, historyFiles };
}

test("downloads the latest ten distinct data.json history snapshots", async (t) => {
  const workspace = await makeWorkspace(t);
  const logger = makeLogger();
  const { fetchImpl } = makeFetcher();

  const result = await downloadPoe1Trees({
    ...workspace,
    fetchImpl,
    logger,
  });

  assert.deepEqual(
    {
      commit: result.commit,
      release: result.release,
      downloaded: result.downloaded,
      skipped: result.skipped,
      assets: result.assets,
    },
    {
      commit: COMMIT,
      release: "3.29.1",
      downloaded: 5,
      skipped: 0,
      assets: 3,
    },
  );
  assert.equal(result.historical.requested, 10);
  assert.equal(result.historical.count, 10);
  assert.equal(result.historical.downloaded, 50);
  assert.equal(result.historical.skipped, 0);
  assert.equal(result.historical.assets, 30);
  assert.deepEqual(
    result.historical.snapshots.map(({ commit }) => commit),
    HISTORY_COMMITS.slice(0, 10).map(({ sha }) => sha),
  );
  assert.deepEqual(
    result.historical.snapshots.map(({ id }) => id),
    [
      "3.29.0-preview-2",
      `0.0.0-history-${HISTORY_COMMITS[1].sha.slice(0, 8)}`,
      "3.29.0-preview-1",
      "3.28.0-j",
      "3.28.0-preview",
      "3.27.0",
      `3.27.0-${HISTORY_COMMITS[6].sha.slice(0, 8)}`,
      "3.26.0-preview-2",
      "3.26.0-preview-1",
      "3.25.0",
    ],
  );
  assert.equal(
    new Set(result.historical.snapshots.map(({ id }) => id)).size,
    10,
  );
  assert.deepEqual(
    result.historical.snapshots.slice(0, 4).map(({ label }) => label),
    [
      "3.29.0 preview 2",
      `Curse of the Allflame Passive Tree preview (${HISTORY_COMMITS[1].sha.slice(0, 7)})`,
      "3.29.0 preview 1",
      "3.28.0j",
    ],
  );
  assert.equal(
    JSON.parse(await readFile(join(workspace.dataDirectory, "data.json"), "utf8")).tree,
    "Default",
  );
  assert.equal(
    JSON.parse(await readFile(join(workspace.dataDirectory, "ruthless.json"), "utf8")).tree,
    "Default Ruthless",
  );
  assert.deepEqual(
    await readFile(join(workspace.assetDirectory, "skills-4.jpg")),
    Buffer.from([1, 2, 3, 4]),
  );
  assert.equal(
    JSON.parse(
      await readFile(
        join(workspace.dataDirectory, "versions", "3.29.0-preview-2", "data.json"),
        "utf8",
      ),
    ).tree,
    "3.29.0 preview 2",
  );
  assert.deepEqual(
    await readFile(
      join(
        workspace.assetDirectory,
        "versions",
        "3.29.0-preview-2",
        "history-0-skills-4.jpg",
      ),
    ),
    Buffer.from([7, 0, 8, 10]),
  );

  const manifest = JSON.parse(
    await readFile(join(workspace.dataDirectory, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.commit, COMMIT);
  assert.equal(manifest.trees.standard, "data.json");
  assert.equal(manifest.trees.ruthless, "ruthless.json");
  assert.ok(manifest.files["assets/skills-4.jpg"].sha256);
  const archiveManifest = JSON.parse(
    await readFile(
      join(
        workspace.dataDirectory,
        "versions",
        "3.29.0-preview-2",
        "manifest.json",
      ),
      "utf8",
    ),
  );
  assert.equal(archiveManifest.release, "3.29.0-preview-2");
  assert.equal(archiveManifest.label, "3.29.0 preview 2");
  assert.equal(archiveManifest.commit, HISTORY_COMMITS[0].sha);
  assert.equal(archiveManifest.historyOrder, 0);
  assert.equal(archiveManifest.historyAnchorCommit, COMMIT);
  assert.ok(archiveManifest.files["assets/history-0-skills-4.jpg"].sha256);
  assert.ok(logger.messages.log.some((message) => message.includes("3.29.1 ready")));
  assert.ok(
    logger.messages.log.some((message) => message.includes("3.29.0 preview 2 archive ready")),
  );
  assert.ok(logger.messages.log.some((message) => message.includes("10 snapshots")));
});

test("skips unchanged files on rerun and refreshes a damaged local asset", async (t) => {
  const workspace = await makeWorkspace(t);
  const { fetchImpl, requests } = makeFetcher();
  const first = await downloadPoe1Trees({ ...workspace, fetchImpl, logger: makeLogger() });
  const initialRawCount = requests.raw.length;

  const second = await downloadPoe1Trees({ ...workspace, fetchImpl, logger: makeLogger() });
  assert.deepEqual(
    { downloaded: second.downloaded, skipped: second.skipped },
    { downloaded: 0, skipped: 5 },
  );
  assert.deepEqual(
    {
      downloaded: second.historical.downloaded,
      skipped: second.historical.skipped,
    },
    { downloaded: 0, skipped: 50 },
  );
  assert.equal(second.historical.count, 10);
  assert.equal(requests.raw.length, initialRawCount);
  assert.equal(first.commit, second.commit);

  await writeFile(join(workspace.assetDirectory, "skills-4.jpg"), "truncated");
  const third = await downloadPoe1Trees({ ...workspace, fetchImpl, logger: makeLogger() });
  assert.deepEqual(
    { downloaded: third.downloaded, skipped: third.skipped },
    { downloaded: 1, skipped: 4 },
  );
  assert.deepEqual(
    await readFile(join(workspace.assetDirectory, "skills-4.jpg")),
    Buffer.from([1, 2, 3, 4]),
  );
  await writeFile(
    join(
      workspace.assetDirectory,
      "versions",
      "3.29.0-preview-2",
      "history-0-skills-4.jpg",
    ),
    "truncated",
  );
  const fourth = await downloadPoe1Trees({ ...workspace, fetchImpl, logger: makeLogger() });
  assert.deepEqual(
    {
      downloaded: fourth.historical.downloaded,
      skipped: fourth.historical.skipped,
    },
    { downloaded: 1, skipped: 49 },
  );
  assert.deepEqual(
    await readFile(
      join(
        workspace.assetDirectory,
        "versions",
        "3.29.0-preview-2",
        "history-0-skills-4.jpg",
      ),
    ),
    Buffer.from([7, 0, 8, 10]),
  );
});

test("rejects a missing official tree variant before writing a manifest", async (t) => {
  const workspace = await makeWorkspace(t);
  const { fetchImpl: baseFetch } = makeFetcher();
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "api.github.com" && url.pathname.endsWith(`/git/trees/${COMMIT}`)) {
      return jsonResponse({
        truncated: false,
        tree: [{ path: "data.json", type: "blob" }],
      });
    }
    return baseFetch(input, options);
  };

  await assert.rejects(
    downloadPoe1Trees({ ...workspace, fetchImpl, logger: makeLogger() }),
    /missing ruthless\.json/,
  );
  await assert.rejects(readdir(workspace.dataDirectory), { code: "ENOENT" });
});

test("reports upstream HTTP failures without creating partial data", async (t) => {
  const workspace = await makeWorkspace(t);
  const { fetchImpl } = makeFetcher({ failRaw: true });

  await assert.rejects(
    downloadPoe1Trees({ ...workspace, fetchImpl, logger: makeLogger() }),
    /HTTP 503 while requesting PoE1 export file/,
  );
  await assert.rejects(readdir(workspace.dataDirectory), { code: "ENOENT" });
});

test("fails explicitly when ten distinct historical revisions are unavailable", async (t) => {
  const workspace = await makeWorkspace(t);
  const logger = makeLogger();
  const { fetchImpl } = makeFetcher({ historyCount: 4 });

  await assert.rejects(
    downloadPoe1Trees({ ...workspace, fetchImpl, logger }),
    /history is incomplete: found 4 distinct data\.json commit\(s\).*10 required/,
  );
  assert.ok(
    logger.messages.log.every((message) => !message.includes("history ready")),
  );
  assert.equal(
    JSON.parse(await readFile(join(workspace.dataDirectory, "manifest.json"), "utf8")).commit,
    COMMIT,
  );
  await assert.rejects(readdir(join(workspace.dataDirectory, "versions")), {
    code: "ENOENT",
  });
});

test("fails a historical snapshot when its required tree file or atlas is missing", async (t) => {
  const missingTreeWorkspace = await makeWorkspace(t);
  const missingTree = makeFetcher({ missingHistoryFile: "ruthless.json" });
  await assert.rejects(
    downloadPoe1Trees({
      ...missingTreeWorkspace,
      fetchImpl: missingTree.fetchImpl,
      logger: makeLogger(),
    }),
    /3\.29\.0-preview-2 export is missing ruthless\.json/,
  );

  const missingAssetWorkspace = await makeWorkspace(t);
  const missingAsset = makeFetcher({ missingHistoryAsset: true });
  await assert.rejects(
    downloadPoe1Trees({
      ...missingAssetWorkspace,
      fetchImpl: missingAsset.fetchImpl,
      logger: makeLogger(),
    }),
    /3\.29\.0-preview-2 references an asset missing from the official export/,
  );
  await assert.rejects(
    readFile(
      join(
        missingAssetWorkspace.dataDirectory,
        "versions",
        "3.29.0-preview-2",
        "manifest.json",
      ),
    ),
    { code: "ENOENT" },
  );
});
