import { memo } from "react";
import { type BuildInventorySlot } from "../../lib/buildFile";
import MarkupEditor from "../MarkupEditor";

interface Props {
  inventory: BuildInventorySlot[];
  setInventory: (inv: BuildInventorySlot[]) => void;
  selectedAsc: string | null;
}

const BASE_SLOTS: { id: string; label: string }[] = [
  { id: "Weapon1",     label: "Weapon — Set I" },
  { id: "Helm1",       label: "Helmet" },
  { id: "BodyArmour1", label: "Body Armour" },
  { id: "Gloves1",     label: "Gloves" },
  { id: "Boots1",      label: "Boots" },
  { id: "Amulet1",     label: "Amulet" },
  { id: "Ring1",       label: "Ring 1" },
  { id: "Ring2",       label: "Ring 2" },
  { id: "Belt1",       label: "Belt" },
];

function InventoryStep({ inventory, setInventory, selectedAsc }: Props) {
  const slots =
    selectedAsc === "Huntress3"
      ? [...BASE_SLOTS.slice(0, 8), { id: "Ring3", label: "Ring 3" }, BASE_SLOTS[8]]
      : BASE_SLOTS;

  const byId: Record<string, BuildInventorySlot> = {};
  for (const s of inventory) byId[s.inventory_id] = s;

  const update = (id: string, text: string) => {
    const next = inventory.filter((s) => s.inventory_id !== id);
    if (text.trim()) next.push({ inventory_id: id, additional_text: text });
    setInventory(next);
  };

  return (
    <div className="panel step step--inv">
      <div className="step__title">Inventory</div>
      <div className="inv-grid">
        {slots.map((slot) => (
          <div className="inv-slot-block" key={slot.id}>
            <div className="inv-slot__label">{slot.label}</div>
            <MarkupEditor
              value={byId[slot.id]?.additional_text ?? ""}
              onChange={(v) => update(slot.id, v)}
              placeholder="slot note (optional) — right-click to format"
              rows={2}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(InventoryStep);
