import type {
  ParsedPoe1Tree,
  Poe1RawData,
  Poe1Ruleset,
} from "../types";

export function normalizePoe1Tree(
  input: Poe1RawData | unknown,
  ruleset?: Poe1Ruleset,
  versionId?: string,
): ParsedPoe1Tree;
