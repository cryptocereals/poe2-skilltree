import React from "react";
import ReactDOM from "react-dom/client";
import Workspace from "./features/workspace/Workspace";
import "./index.css";
import "./features/sharedTree/components/sharedTree.css";
import "./features/workspace/WorkspaceShell.css";
import "./features/workspace/AtlasLanding.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Workspace />
  </React.StrictMode>
);
