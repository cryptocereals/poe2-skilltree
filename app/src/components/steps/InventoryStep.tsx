import { memo } from "react";
import type { BuildInventorySlot } from "../../lib/buildFile";

interface Props {
  inventory: BuildInventorySlot[];
  setInventory: (inv: BuildInventorySlot[]) => void;
  version: string;
}

// Phase 1 placeholder — filled in Phase 2 (slots + poe2db item autocomplete).
function InventoryStep(_props: Props) {
  return (
    <div className="panel step">
      <div className="step__title">Inventory</div>
      <p className="step__hint">Gear slots with item autocomplete — coming up.</p>
    </div>
  );
}

export default memo(InventoryStep);
