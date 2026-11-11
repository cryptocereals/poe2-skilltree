import ClassAscendancyPicker from "../../sharedTree/components/ClassAscendancyPicker";
import TreePanel from "../../sharedTree/components/TreePanel";
import { findPoe1AscendancyStart } from "../data/ascendancySelection.mjs";
import type { ParsedPoe1Tree, Poe1RawClass } from "../types";

interface Props {
  tree: ParsedPoe1Tree;
  classes: Poe1RawClass[];
  selectedClass: number | null;
  selectedAscendancyId: string | null;
  onSelectClass: (classIndex: number | null) => void;
  onSelectAscendancy: (ascendancyId: string | null) => void;
}

export default function Poe1ClassPanel({
  tree,
  classes,
  selectedClass,
  selectedAscendancyId,
  onSelectClass,
  onSelectAscendancy,
}: Props) {
  const classOptions = classes.map((classInfo, index) => ({
    id: String(index),
    label: classInfo.name,
  }));
  const ascendancyOptions =
    selectedClass == null
      ? []
      : (classes[selectedClass]?.ascendancies ?? []).flatMap((ascendancy) => {
          const id = String(ascendancy.id ?? ascendancy.name ?? "");
          const label = ascendancy.name ?? ascendancy.id ?? "";
          if (!id || !label || !findPoe1AscendancyStart(tree, selectedClass, id)) {
            return [];
          }
          return [{ id, label }];
        });

  return (
    <TreePanel
      as="section"
      className="classes poe1-class-panel"
      aria-label="Choose a PoE1 class and ascendancy"
    >
      <div className="panel__title">Class · Ascendancy</div>
      <ClassAscendancyPicker
        classes={classOptions}
        ascendancies={ascendancyOptions}
        selectedClassId={
          selectedClass == null ? null : String(selectedClass)
        }
        selectedAscendancyId={selectedAscendancyId}
        onSelectClass={(id) =>
          onSelectClass(id == null ? null : Number(id))
        }
        onSelectAscendancy={onSelectAscendancy}
      />
    </TreePanel>
  );
}
