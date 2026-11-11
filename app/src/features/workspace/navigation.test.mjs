import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WORKSPACE_SELECTION,
  getWorkspaceDestination,
  selectWorkspaceGame,
  selectWorkspaceSection,
  WORKSPACE_GAMES,
  WORKSPACE_SECTIONS,
} from "./navigation.mjs";

test("workspace navigation exposes the skill and atlas tree destinations", () => {
  assert.deepEqual(
    WORKSPACE_SECTIONS.map(({ id, label }) => ({ id, label })),
    [
      { id: "skill-tree", label: "Skill Tree" },
      { id: "atlas-tree", label: "Atlas Tree" },
    ],
  );
});

test("Atlas Tree remains explicitly marked as coming soon", () => {
  const atlas = WORKSPACE_SECTIONS.find(({ id }) => id === "atlas-tree");

  assert.equal(atlas?.status, "coming-soon");
  assert.equal(atlas?.summary, "Endgame progression planner");
});

test("the header game switch works for both destinations without changing section", () => {
  for (const { id } of WORKSPACE_SECTIONS) {
    const selection = selectWorkspaceSection(DEFAULT_WORKSPACE_SELECTION, id);
    const poe1Selection = selectWorkspaceGame(selection, "poe1");

    assert.deepEqual(poe1Selection, { game: "poe1", section: id });
    assert.equal(getWorkspaceDestination(poe1Selection), `poe1:${id}`);
    assert.equal(
      getWorkspaceDestination(selectWorkspaceGame(poe1Selection, "poe2")),
      `poe2:${id}`,
    );
  }
  assert.deepEqual(WORKSPACE_GAMES.map(({ id }) => id), ["poe2", "poe1"]);
  assert.ok(WORKSPACE_GAMES.every((option) => !("rulesets" in option)));
});

test("invalid workspace selections leave the independent game/section state unchanged", () => {
  const selection = { game: "poe1", section: "skill-tree" };
  assert.equal(selectWorkspaceGame(selection, "poe3"), selection);
  assert.equal(selectWorkspaceSection(selection, "build-planner"), selection);
});
