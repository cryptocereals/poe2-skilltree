export function getComparisonOptions(versions, primaryVersion) {
  return versions.filter((version) => version.id !== primaryVersion);
}

export function chooseCompareVersion(
  versions,
  primaryVersion,
  currentCompareVersion = "",
  preferredCompareVersion = null,
) {
  const options = getComparisonOptions(versions, primaryVersion);
  if (options.some((version) => version.id === currentCompareVersion)) {
    return currentCompareVersion;
  }
  if (options.some((version) => version.id === preferredCompareVersion)) {
    return preferredCompareVersion;
  }
  return options[0]?.id ?? "";
}
