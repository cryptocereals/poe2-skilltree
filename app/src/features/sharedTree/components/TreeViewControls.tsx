import { memo, useEffect, useState } from "react";
import type { Camera } from "../../../lib/camera";
import TreePanel from "./TreePanel";

interface Props {
  camera: Camera;
  onReset: () => void;
  className?: string;
}

function TreeViewControls({ camera, onReset, className }: Props) {
  const [zoomPercent, setZoomPercent] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setZoomPercent(Math.round(camera.zoom * 100)),
      150,
    );
    return () => window.clearInterval(timer);
  }, [camera]);

  const zoomAtCenter = (factor: number) =>
    camera.zoomAt(factor, camera.vw / 2, camera.vh / 2);

  return (
    <TreePanel
      as="div"
      className={["controls", "tree-view-controls", className]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="Tree view controls"
    >
      <button
        type="button"
        title="Zoom in"
        aria-label="Zoom in"
        onClick={() => zoomAtCenter(1.3)}
      >
        +
      </button>
      <div className="zoom-readout" aria-label={`Zoom ${zoomPercent}%`}>
        {zoomPercent}%
      </div>
      <button
        type="button"
        title="Zoom out"
        aria-label="Zoom out"
        onClick={() => zoomAtCenter(1 / 1.3)}
      >
        −
      </button>
      <button
        type="button"
        title="Fit tree"
        aria-label="Fit tree"
        onClick={onReset}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
          <path d="M8 8 3 3m13 5 5-5M8 16l-5 5m13-5 5 5" />
        </svg>
      </button>
    </TreePanel>
  );
}

export default memo(TreeViewControls);
