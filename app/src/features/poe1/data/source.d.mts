import type { Poe1Ruleset } from "../types";

export const POE1_RULESETS: readonly {
  readonly id: Poe1Ruleset;
  readonly label: string;
  readonly file: string;
}[];
export const POE1_RUNTIME_ATLAS_NAMES: readonly string[];

export interface Poe1VersionOption {
  id: string;
  label: string;
}

export interface Poe1VersionManifest {
  defaultVersion: string;
  defaultCompareVersion: string | null;
  versions: Poe1VersionOption[];
  defaultDataset: string;
  defaultCompareDataset: string | null;
  datasets: Poe1TreeDatasetOption[];
}

export interface Poe1TreeDatasetOption extends Poe1VersionOption {
  versionId: string;
  ruleset: Poe1Ruleset;
}

export function isPoe1ReleaseId(value: unknown): value is string;
export function getPoe1DatasetId(
  versionId: string,
  ruleset: Poe1Ruleset,
): string;
export function parsePoe1VersionManifest(input: unknown): Poe1VersionManifest;
export function getPoe1TreeFile(ruleset: Poe1Ruleset): string;
export function getPoe1TreeUrl(
  baseUrl: string,
  ruleset: Poe1Ruleset,
  versionId?: string,
): string;
export function getPoe1TreeDatasetUrl(
  baseUrl: string,
  dataset: Poe1TreeDatasetOption,
): string;
export function getPoe1AssetFileName(source: string): string;
export function getPoe1AssetUrl(
  baseUrl: string,
  source: string,
  versionId?: string,
): string;
