import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  collectVersionCommits,
  downloadSkillTreeData,
  extractVersionFromSubject,
} from "./download.mjs";

function makeCommit(subject, id) {
  return {
    sha: id.toString(16).padStart(40, "0"),
    commit: { message: subject },
  };
}

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

function textResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => value,
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

async function makeTempDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "poe2-skill-tree-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("extracts safe versions from commit subjects", () => {
  assert.equal(extractVersionFromSubject("0.5.5"), "0.5.5");
  assert.equal(extractVersionFromSubject("0.5.0 Preview 2"), "0.5.0");
  assert.equal(extractVersionFromSubject("v1.2.3-rc.2 Release"), "1.2.3-rc.2");
  assert.equal(extractVersionFromSubject("Update to 0.5.5"), null);
  assert.equal(extractVersionFromSubject("0.5.5/../../outside"), null);
  assert.equal(extractVersionFromSubject("0.5.5unsafe"), null);
});

test("paginates history, skips non-version commits, and keeps the newest duplicate", async () => {
  const pages = new Map([
    [1, [makeCommit("0.5.5", 1), makeCommit("Update docs", 2)]],
    [2, [makeCommit("0.5.0 Preview 2", 3), makeCommit("0.5.0 Preview", 4)]],
    [3, [makeCommit("0.4.0", 5)]],
  ]);
  const requestedPages = [];
  const logger = makeLogger();
  const fetchImpl = async (input) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get("path"), "data.json");
    const page = Number(url.searchParams.get("page"));
    requestedPages.push(page);
    return jsonResponse(pages.get(page));
  };

  const commits = await collectVersionCommits({ fetchImpl, logger, perPage: 2 });

  assert.deepEqual(requestedPages, [1, 2, 3]);
  assert.deepEqual(
    commits.map(({ version }) => version),
    ["0.5.5", "0.5.0", "0.4.0"],
  );
  assert.equal(commits[1].sha, makeCommit("0.5.0 Preview 2", 3).sha);
  assert.ok(
    logger.messages.warn.some((message) => message.includes("non-version commit")),
  );
  assert.ok(
    logger.messages.log.some((message) => message.includes("duplicate version 0.5.0")),
  );
});

test("downloads immutable JSON and skips a valid archive on rerun", async (t) => {
  const root = await makeTempDirectory(t);
  const destination = join(root, "data", "skill-tree");
  const commit = makeCommit("0.5.5", 10);
  const expectedRawUrl =
    `https://raw.githubusercontent.com/grindinggear/poe2-skilltree-export/${commit.sha}/data.json`;
  const contents = '{"tree":[1,2,3]}\n';
  let apiRequests = 0;
  let rawRequests = 0;
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.hostname === "api.github.com") {
      apiRequests += 1;
      assert.equal(url.searchParams.get("path"), "data.json");
      return jsonResponse([commit]);
    }
    rawRequests += 1;
    assert.equal(url.href, expectedRawUrl);
    return textResponse(contents);
  };

  const firstRun = await downloadSkillTreeData({
    destination,
    fetchImpl,
    logger: makeLogger(),
  });
  assert.deepEqual(firstRun, { downloaded: 1, skipped: 0 });
  assert.equal(await readFile(join(destination, "0.5.5.json"), "utf8"), contents);

  const secondRun = await downloadSkillTreeData({
    destination,
    fetchImpl,
    logger: makeLogger(),
  });
  assert.deepEqual(secondRun, { downloaded: 0, skipped: 1 });
  assert.equal(apiRequests, 2);
  assert.equal(rawRequests, 1);
});

test("rejects malformed JSON without leaving an archive or temporary file", async (t) => {
  const root = await makeTempDirectory(t);
  const destination = join(root, "data", "skill-tree");
  const fetchImpl = async (input) =>
    new URL(input).hostname === "api.github.com"
      ? jsonResponse([makeCommit("0.5.5", 11)])
      : textResponse('{"broken":');

  await assert.rejects(
    downloadSkillTreeData({ destination, fetchImpl, logger: makeLogger() }),
    /Invalid JSON for 0\.5\.5/,
  );
  await assert.rejects(readdir(destination), { code: "ENOENT" });
});

test("replaces an invalid existing archive only after valid data is received", async (t) => {
  const root = await makeTempDirectory(t);
  const destination = join(root, "data", "skill-tree");
  const filePath = join(destination, "0.5.5.json");
  await mkdir(destination, { recursive: true });
  await writeFile(filePath, '{"partial":', "utf8");

  const fetchImpl = async (input) =>
    new URL(input).hostname === "api.github.com"
      ? jsonResponse([makeCommit("0.5.5", 12)])
      : textResponse('{"complete":true}');
  const result = await downloadSkillTreeData({
    destination,
    fetchImpl,
    logger: makeLogger(),
  });

  assert.deepEqual(result, { downloaded: 1, skipped: 0 });
  assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), { complete: true });
  assert.deepEqual(await readdir(destination), ["0.5.5.json"]);
});

test("reports HTTP errors from both GitHub endpoints", async (t) => {
  const root = await makeTempDirectory(t);
  const destination = join(root, "data", "skill-tree");
  await assert.rejects(
    downloadSkillTreeData({
      destination,
      fetchImpl: async () => jsonResponse({ message: "unavailable" }, 503),
      logger: makeLogger(),
    }),
    /HTTP 503 while requesting GitHub commit history/,
  );

  const rawFailureFetch = async (input) =>
    new URL(input).hostname === "api.github.com"
      ? jsonResponse([makeCommit("0.5.5", 13)])
      : textResponse("not found", 404);
  await assert.rejects(
    downloadSkillTreeData({
      destination,
      fetchImpl: rawFailureFetch,
      logger: makeLogger(),
    }),
    /HTTP 404 while requesting skill-tree data for 0\.5\.5/,
  );
  await assert.rejects(readdir(destination), { code: "ENOENT" });
});
