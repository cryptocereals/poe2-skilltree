import assert from "node:assert/strict";
import test from "node:test";

import {
  choosePreviousPoe1Release,
  comparePoe1Releases,
} from "./download-poe1-archive.mjs";
import { discoverPoe1TreeHistory } from "./poe1-history.mjs";

function numberedSha(number) {
  const hex = number.toString(16);
  return `${hex.padStart(8, "0")}${hex.padStart(32, "0")}`;
}

function jsonResponse(value) {
  return {
    ok: true,
    status: 200,
    json: async () => value,
  };
}

test("PoE1 release tags compare numerically and choose the newest earlier stable tag", () => {
  assert.ok(comparePoe1Releases("3.10.0", "3.9.9") > 0);
  assert.deepEqual(
    choosePreviousPoe1Release(
      [
        { name: "3.30.0" },
        { name: "3.29.1" },
        { name: "3.29.0" },
        { name: "3.29.0-rc1" },
        { name: "v3.28.3" },
      ],
      "3.29.1",
    ),
    { id: "3.29.0", ref: "3.29.0" },
  );
});

test("PoE1 history discovery is empty when there is no earlier stable release", () => {
  assert.equal(choosePreviousPoe1Release([{ name: "3.29.1" }], "3.29.1"), null);
  assert.equal(choosePreviousPoe1Release([{ name: "3.28.0" }], "unknown"), null);
});

test("discovers distinct data.json commits from the pinned SHA and paginates history", async () => {
  const currentCommit = "a".repeat(40);
  const titles = [
    "3.29.0 preview 2",
    "3.29.0 preview 1",
    "3.28.0j",
    "Curse of the Allflame Passive Tree preview",
    "3.27.0",
    "3.27.0",
  ];
  const historyCommits = Array.from({ length: 101 }, (_, index) => ({
    sha: numberedSha(index + 10),
    commit: {
      message: titles[index] ?? `4.${index}.0`,
      committer: { date: `2026-02-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z` },
    },
  }));
  const pages = [
    [
      { sha: currentCommit, commit: { message: "3.29.1" } },
      ...historyCommits.slice(0, 99),
    ],
    historyCommits.slice(99),
  ];
  const requests = [];
  const fetchImpl = async (input) => {
    const url = new URL(input);
    requests.push(url);
    const page = Number(url.searchParams.get("page"));
    return jsonResponse(pages[page - 1] ?? []);
  };

  const snapshots = await discoverPoe1TreeHistory({
    currentCommit,
    fetchImpl,
    limit: 101,
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get("path"), "data.json");
  assert.equal(requests[0].searchParams.get("sha"), currentCommit);
  assert.equal(requests[0].searchParams.get("per_page"), "100");
  assert.equal(requests[0].searchParams.get("page"), "1");
  assert.equal(requests[1].searchParams.get("page"), "2");
  assert.equal(snapshots.length, 101);
  assert.deepEqual(
    snapshots.slice(0, 6).map(({ id }) => id),
    [
      "3.29.0-preview-2",
      "3.29.0-preview-1",
      "3.28.0-j",
      `0.0.0-history-${historyCommits[3].sha.slice(0, 8)}`,
      "3.27.0",
      `3.27.0-${historyCommits[5].sha.slice(0, 8)}`,
    ],
  );
  assert.deepEqual(
    snapshots.slice(0, 4).map(({ label }) => label),
    [
      "3.29.0 preview 2",
      "3.29.0 preview 1",
      "3.28.0j",
      `Curse of the Allflame Passive Tree preview (${historyCommits[3].sha.slice(0, 7)})`,
    ],
  );
  assert.equal(snapshots[0].historyOrder, 0);
  assert.equal(snapshots[100].historyOrder, 100);
  assert.equal(snapshots[0].anchorCommit, currentCommit);
  assert.equal(
    new Set(snapshots.map(({ commit }) => commit)).size,
    101,
  );
  assert.equal(
    new Set(snapshots.map(({ id }) => id)).size,
    101,
  );
});
