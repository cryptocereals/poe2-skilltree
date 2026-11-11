export interface TreeVersionOption {
  id: string;
  label: string;
}

export function getComparisonOptions<T extends TreeVersionOption>(
  versions: readonly T[],
  primaryVersion: string,
): T[];

export function chooseCompareVersion(
  versions: readonly TreeVersionOption[],
  primaryVersion: string,
  currentCompareVersion?: string,
  preferredCompareVersion?: string | null,
): string;
