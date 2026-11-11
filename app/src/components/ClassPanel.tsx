import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ClassAscendancyPicker from "../features/sharedTree/components/ClassAscendancyPicker";
import type { ClassInfo } from "../types";

interface Props {
  classes: ClassInfo[];
  selectedClass: number | null;
  selectedAsc: string | null;
  newAscIds: Set<string>;
  onSelectClass: (idx: number | null) => void;
  onSelectAsc: (id: string | null) => void;
  onNewBuild: () => void;
  onImport: () => void;
  onEdit: () => void;
  canEdit: boolean;
}

const isPlayable = (c: ClassInfo) => c.ascendancies.some((a) => a && a.name);

function ClassPanel({
  classes,
  selectedClass,
  selectedAsc,
  newAscIds,
  onSelectClass,
  onSelectAsc,
  onNewBuild,
  onImport,
  onEdit,
  canEdit,
}: Props) {
  const [open, setOpen] = useState(true);

  // Auto-open when a class or ascendancy is selected so the user can see choices
  useEffect(() => {
    if (selectedClass != null || selectedAsc != null) setOpen(true);
  }, [selectedClass, selectedAsc]);

  const cls = selectedClass != null ? classes[selectedClass] : null;
  const ascendancies = cls ? cls.ascendancies.filter((a) => a && a.name) : [];
  const classOptions = classes.flatMap((classInfo, index) =>
    isPlayable(classInfo)
      ? [{ id: String(index), label: classInfo.name }]
      : [],
  );
  const ascendancyOptions = ascendancies.map((ascendancy) => {
    const isNew = newAscIds.has(ascendancy.id);
    return {
      id: ascendancy.id,
      label: ascendancy.name,
      tag: isNew ? "NEW" : ascendancy.id,
      isNew,
    };
  });

  return (
    <motion.div
      className="panel classes"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="class-actions">
        <button className="ca-btn primary" onClick={onNewBuild}>
          ✦ New Build
        </button>
        <button className="ca-btn" onClick={onImport}>
          Import
        </button>
        {canEdit && (
          <button className="ca-btn edit" onClick={onEdit}>
            Edit ✎
          </button>
        )}
      </div>

      <button
        type="button"
        className="panel__title panel__title--toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Class · Ascendancy
        <span className={"panel__chevron" + (open ? " open" : "")}>›</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="class-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <ClassAscendancyPicker
              classes={classOptions}
              ascendancies={ascendancyOptions}
              selectedClassId={
                selectedClass == null ? null : String(selectedClass)
              }
              selectedAscendancyId={selectedAsc}
              onSelectClass={(id) =>
                onSelectClass(id == null ? null : Number(id))
              }
              onSelectAscendancy={onSelectAsc}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(ClassPanel);
