import type { VersionDiff } from "../../../types";
import TreeVersionPanel from "../../sharedTree/components/TreeVersionPanel";
import type { TreeVersionOption } from "../versionSelection.mjs";

interface Props {
  versions: TreeVersionOption[];
  version: string;
  setVersion: (version: string) => void;
  compareOn: boolean;
  setCompareOn: (enabled: boolean) => void;
  compareVersion: string;
  setCompareVersion: (version: string) => void;
  compareOptions: TreeVersionOption[];
  selectedLabel: string;
  compareLabel: string;
  comparisonLoading: boolean;
  comparisonError: string | null;
  onRetryComparison: () => void;
  diff: VersionDiff | null;
}

export default function VersionPanel({ diff, ...props }: Props) {
  return <TreeVersionPanel {...props} diffCounts={diff?.counts ?? null} />;
}
