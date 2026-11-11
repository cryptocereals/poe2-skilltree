export type WorkspaceSectionId = "skill-tree" | "atlas-tree";
export type WorkspaceGameId = "poe1" | "poe2";

export interface WorkspaceSection {
  readonly id: WorkspaceSectionId;
  readonly label: string;
  readonly summary: string;
  readonly status: "available" | "coming-soon";
}

export const WORKSPACE_SECTIONS: readonly WorkspaceSection[];
export const WORKSPACE_GAMES: readonly {
  readonly id: WorkspaceGameId;
  readonly label: string;
  readonly shortLabel: string;
}[];

export interface WorkspaceSelection {
  game: WorkspaceGameId;
  section: WorkspaceSectionId;
}

export const DEFAULT_WORKSPACE_SELECTION: Readonly<WorkspaceSelection>;
export function selectWorkspaceGame(
  selection: WorkspaceSelection,
  game: WorkspaceGameId,
): WorkspaceSelection;
export function selectWorkspaceSection(
  selection: WorkspaceSelection,
  section: WorkspaceSectionId,
): WorkspaceSelection;
export function getWorkspaceDestination(
  selection: WorkspaceSelection,
): `${WorkspaceGameId}:${WorkspaceSectionId}`;
export function getWorkspaceGame(
  game: WorkspaceGameId,
): (typeof WORKSPACE_GAMES)[number];
