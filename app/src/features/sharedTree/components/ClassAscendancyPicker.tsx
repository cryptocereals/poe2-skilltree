import { AnimatePresence, motion } from "framer-motion";

export interface TreeClassOption {
  id: string;
  label: string;
}

export interface TreeAscendancyOption {
  id: string;
  label: string;
  tag?: string;
  isNew?: boolean;
}

interface Props {
  classes: readonly TreeClassOption[];
  ascendancies?: readonly TreeAscendancyOption[];
  selectedClassId: string | null;
  selectedAscendancyId: string | null;
  onSelectClass: (id: string | null) => void;
  onSelectAscendancy: (id: string | null) => void;
}

export default function ClassAscendancyPicker({
  classes,
  ascendancies = [],
  selectedClassId,
  selectedAscendancyId,
  onSelectClass,
  onSelectAscendancy,
}: Props) {
  return (
    <>
      <div className="class-grid" role="group" aria-label="Select class">
        {classes.map((classOption) => {
          const selected = selectedClassId === classOption.id;
          return (
            <button
              key={classOption.id}
              type="button"
              className={"class-chip" + (selected ? " active" : "")}
              aria-pressed={selected}
              onClick={() =>
                onSelectClass(selected ? null : classOption.id)
              }
            >
              {classOption.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {ascendancies.length > 0 && (
          <motion.div
            key="ascendancies"
            className="asc-row"
            role="group"
            aria-label="Select ascendancy"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            {ascendancies.map((ascendancy) => {
              const selected = selectedAscendancyId === ascendancy.id;
              return (
                <button
                  key={ascendancy.id}
                  type="button"
                  className={
                    "asc-chip" +
                    (selected ? " active" : "") +
                    (ascendancy.isNew ? " new" : "")
                  }
                  aria-pressed={selected}
                  onClick={() =>
                    onSelectAscendancy(selected ? null : ascendancy.id)
                  }
                >
                  <span className="asc-chip__name">{ascendancy.label}</span>
                  {ascendancy.tag && (
                    <span className="asc-chip__tag">{ascendancy.tag}</span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
