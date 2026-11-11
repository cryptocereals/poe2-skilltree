import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseCompareVersion,
  getComparisonOptions,
} from "./versionSelection.mjs";

const versions = [
  { id: "current", label: "Current" },
  { id: "0.5.5", label: "0.5.5" },
  { id: "0.4.0", label: "0.4.0" },
];

test("comparison options exclude the selected tree and preserve release order", () => {
  assert.deepEqual(getComparisonOptions(versions, "0.5.5"), [
    versions[0],
    versions[2],
  ]);
});

test("compare selection preserves a valid choice and otherwise prefers the baseline", () => {
  assert.equal(chooseCompareVersion(versions, "current", "0.5.5", "0.4.0"), "0.5.5");
  assert.equal(chooseCompareVersion(versions, "current", "missing", "0.4.0"), "0.4.0");
  assert.equal(chooseCompareVersion(versions, "0.4.0", "0.4.0", "0.4.0"), "current");
});

test("comparison is unavailable when only one tree version exists", () => {
  assert.deepEqual(getComparisonOptions([versions[0]], "current"), []);
  assert.equal(chooseCompareVersion([versions[0]], "current"), "");
});
