export const WORKSPACE_SECTIONS = Object.freeze([
  Object.freeze({
    id: "skill-tree",
    label: "Skill Tree",
    summary: "Passive build planner",
    status: "available",
  }),
  Object.freeze({
    id: "atlas-tree",
    label: "Atlas Tree",
    summary: "Endgame progression planner",
    status: "coming-soon",
  }),
]);

export const WORKSPACE_GAMES = Object.freeze([
  Object.freeze({
    id: "poe2",
    label: "Path of Exile 2",
    shortLabel: "PoE 2",
  }),
  Object.freeze({
    id: "poe1",
    label: "Path of Exile 1",
    shortLabel: "PoE 1",
  }),
]);

export const DEFAULT_WORKSPACE_SELECTION = Object.freeze({
  game: "poe2",
  section: "skill-tree",
});

export function selectWorkspaceGame(selection, game) {
  if (!WORKSPACE_GAMES.some((option) => option.id === game)) return selection;
  if (selection.game === game) return selection;
  return { ...selection, game };
}

export function selectWorkspaceSection(selection, section) {
  if (!WORKSPACE_SECTIONS.some((option) => option.id === section)) return selection;
  if (selection.section === section) return selection;
  return { ...selection, section };
}

export function getWorkspaceDestination(selection) {
  return `${selection.game}:${selection.section}`;
}

export function getWorkspaceGame(game) {
  return WORKSPACE_GAMES.find((option) => option.id === game) ?? WORKSPACE_GAMES[0];
}
