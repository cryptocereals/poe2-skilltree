import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Camera } from "./lib/camera";
import { loadAtlases, type AtlasSet } from "./features/tree/canvas/atlas";
import { buildReducer, initialBuild, ASC_BUDGET, SWAP_MAX, SWAP_MAX_MASTER, WEAPON_MASTER_KEY, type Tag } from "./lib/buildState";
import type { TreeNode } from "./types";
import TreeCanvas from "./features/tree/components/TreeCanvas";
import SearchPanel from "./features/tree/components/SearchPanel";
import ClassPanel from "./components/ClassPanel";
import VersionPanel from "./features/tree/components/VersionPanel";
import StatsPanel from "./components/StatsPanel";
import BuildPanel from "./components/BuildPanel";
import Controls from "./components/Controls";
import HoverLayer, { type HoverHandle } from "./features/tree/components/HoverLayer";
import PlannerWizard from "./components/PlannerWizard";
import NotesPanel from "./components/NotesPanel";
import DetailsStep from "./components/steps/DetailsStep";
import InventoryStep from "./components/steps/InventoryStep";
import SkillsStep from "./components/steps/SkillsStep";
import PobImportModal from "./components/PobImportModal";
import { useTreeVersions } from "./features/tree/useTreeVersions";
import { useTreeSearch } from "./features/tree/useTreeSearch";
import { useBuildSummary } from "./features/build/useBuildSummary";
import { usePlannerDocument } from "./features/build/usePlannerDocument";
import { useBuildFileActions } from "./features/build/useBuildFileActions";
import { useTreeNavigation } from "./features/tree/useTreeNavigation";
import TreeSideToggle from "./features/sharedTree/components/TreeSideToggle";

const WIZARD_STEPS = ["Details", "Passives", "Skills", "Inventory"];

export default function App() {
  const cameraRef = useRef(new Camera());
  const hoverRef = useRef<HoverHandle>(null);

  const [atlases, setAtlases] = useState<AtlasSet | null>(null);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  const [atlasRetry, setAtlasRetry] = useState(0);

  const treeVersions = useTreeVersions();
  const {
    versions,
    selectedVersion: version,
    setSelectedVersion: setVersion,
    compareVersion,
    setCompareVersion,
    comparisonOptions,
    compareOn: diffOn,
    setCompareOn: setCompareOn,
    selectedLabel,
    compareLabel,
    tree,
    diff,
    newAscIds,
    primaryLoading,
    comparisonLoading,
    primaryError,
    comparisonError,
    manifestError,
    progress,
    retryLoad,
    retryComparison,
  } = treeVersions;

  // view state
  const [query, setQuery] = useState("");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  // Panel visibility on mobile. Default false = "not manually opened"; CSS
  // shows panels on desktop regardless and hides them on mobile until a
  // `show-*` class is added by the edge toggles. This keeps the mobile default
  // purely CSS-media-driven (no reliance on JS innerWidth).
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  // PoB import modal
  const [pobModalOpen, setPobModalOpen] = useState(false);

  // planner mode (build wizard)
  const [planner, setPlanner] = useState(false);
  const [step, setStep] = useState(0);
  const [wizardMinimized, setWizardMinimized] = useState(false);

  // all selection + build-planner state in one reducer
  const [build, dispatch] = useReducer(buildReducer, initialBuild);
  const { selectedClass, selectedAsc, mode, alloc, ascAlloc, baseBudget } = build;
  const {
    doc,
    setDoc,
    resetDoc,
    setDocField,
    setInventory,
    setSkills,
    setNote,
  } = usePlannerDocument(planner, alloc, ascAlloc);

  // ---- atlas loading ----
  useEffect(() => {
    let active = true;
    setAtlasError(null);
    void loadAtlases()
      .then((loaded) => {
        if (active) setAtlases(loaded);
      })
      .catch((error: unknown) => {
        if (active) {
          setAtlasError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      active = false;
    };
  }, [atlasRetry]);

  const retryInitialLoad = useCallback(() => {
    retryLoad();
    setAtlasRetry((attempt) => attempt + 1);
  }, [retryLoad]);

  // ---- search ----
  const { results, hits } = useTreeSearch(tree, query, selectedClass);

  const { focusTarget, goTo, resetView, selectClass, selectAsc, pickSearch } =
    useTreeNavigation({
      camera: cameraRef.current,
      tree,
      selectedClass,
      dispatch,
      setFocusKey,
    });

  // click a node: allocate, or switch ascendancy / focus when not allocatable.
  // In planner mode the tree is read-only for allocation; on the Passives
  // step a click only focuses the node so its note can be edited — and only
  // if that node is currently allocated. Notes live on allocated passives;
  // a separate effect prunes them when a node gets unallocated.
  const handleNodeClick = useCallback(
    (node: TreeNode | null) => {
      if (!node) {
        setFocusKey(null);
        return;
      }
      const t = tree;
      if (!t) return;

      // Planner: never mutate allocations from the tree.
      if (planner) {
        if (step === 1 && (alloc.has(node.key) || ascAlloc.has(node.key))) {
          setFocusKey(node.key);
        }
        return;
      }

      if (node.ascendancyId && selectedAsc !== node.ascendancyId) {
        selectAsc(node.ascendancyId);
        return;
      }
      if (!node.ascendancyId && selectedClass == null) {
        setFocusKey(node.key);
        return;
      }
      dispatch({ type: "clickNode", node, tree: t });
    },
    [tree, selectedClass, selectedAsc, selectAsc, planner, step, alloc, ascAlloc]
  );

  const setMode = useCallback((m: Tag) => dispatch({ type: "setMode", mode: m }), []);
  const setBaseBudget = useCallback((n: number) => dispatch({ type: "setBudget", n }), []);
  const clearBuild = useCallback(() => dispatch({ type: "clear" }), []);

  // hover routes straight to HoverLayer — no App re-render per mousemove
  const onHover = useCallback((node: TreeNode | null, x: number, y: number) => {
    hoverRef.current?.setHover(node, x, y);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setQuery("");
        setFocusKey(null);
        // In planner mode, never wipe the class/allocations — the user manages
        // that deliberately through the wizard steps.
        if (!planner) {
          dispatch({ type: "selectClass", idx: null });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [planner]);

  // ---- planner ----
  const enterPlanner = useCallback(() => {
    dispatch({ type: "load", selectedClass: null, selectedAsc: null, alloc: new Map(), ascAlloc: new Set() });
    resetDoc();
    setStep(0);
    setPlanner(true);
  }, [resetDoc]);

  const exitPlanner = useCallback(() => setPlanner(false), []);

  // Edit an already-loaded build (e.g. just imported) in the planner wizard.
  const editBuild = useCallback(() => {
    setStep(0);
    setPlanner(true);
  }, []);

  const triggerImport = useCallback(() => setPobModalOpen(true), []);

  // Entering the Passives step: focus the class start so allocation can begin.
  const goToStep = useCallback(
    (s: number) => {
      setStep(s);
      setWizardMinimized(false);
      if (s === 1) {
        const start = selectedClass != null && tree ? tree.classStart.get(selectedClass) : null;
        if (start) goTo(start.x, start.y, 0.42);
        else resetView();
      }
    },
    [tree, selectedClass, goTo, resetView]
  );

  const { onExport, onImport, onPobString } = useBuildFileActions({
    tree,
    alloc,
    ascAlloc,
    selectedAsc,
    doc,
    setDoc,
    dispatch,
    goTo,
    resetView,
    setPobModalOpen,
  });

  const {
    allocated,
    weaponTag,
    ascOffset,
    ascAngle,
    bonus,
    setCounts,
    mainUsed,
    ascUsed,
    notesNodes,
    notedKeys,
    ascPrefixForClass,
    activeOverrides,
    className,
  } = useBuildSummary({ tree, build, notes: doc.notes });

  const initialLoadError = manifestError || primaryError || atlasError;
  if (!tree || !atlases) {
    return (
      <div className="app">
        <div className="loader">
          <div className="loader__ring" />
          <div className="loader__brand">Passive Skill Tree</div>
          {initialLoadError ? (
            <>
              <div className="loader__label">Unable to load tree data</div>
              <div className="loader__error" role="alert">{initialLoadError}</div>
              <button className="loader__retry" type="button" onClick={retryInitialLoad}>
                Retry
              </button>
            </>
          ) : (
            <>
              <div className="loader__label">
                {progress >= 1 ? "Awakening the tree…" : primaryLoading ? "Drawing the passive tree" : "Loading tree art"}
              </div>
              <div className="loader__bar">
                <div className="loader__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="loader__pct">{Math.round(progress * 100)}%</div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "app" + (showLeft ? " show-left" : "") + (showRight ? " show-right" : "") + (planner ? " planner" : "")
      }
    >
      <TreeCanvas
        tree={tree}
        atlases={atlases}
        camera={cameraRef.current}
        diff={diff}
        diffOn={diffOn}
        searchHits={hits}
        focusKey={focusKey}
        selectedClass={selectedClass}
        selectedAsc={selectedAsc}
        ascPrefixForClass={ascPrefixForClass}
        overrides={activeOverrides}
        allocated={allocated}
        weaponTag={weaponTag}
        ascOffset={ascOffset}
        ascAngle={ascAngle}
        alloc={alloc}
        ascAlloc={ascAlloc}
        mode={mode}
        notedKeys={notedKeys}
        focusTarget={focusTarget}
        onHover={onHover}
        onPick={handleNodeClick}
      />

      {planner ? (
        <>
          <PlannerWizard
            steps={WIZARD_STEPS}
            step={step}
            setStep={goToStep}
            onExport={onExport}
            onExit={exitPlanner}
            minimized={wizardMinimized}
            onToggleMinimize={() => setWizardMinimized((v) => !v)}
          />
          {!wizardMinimized && step === 0 && (
            <DetailsStep
              name={doc.name}
              author={doc.author}
              description={doc.description}
              setField={setDocField}
              classes={tree.classes}
              selectedClass={selectedClass}
              selectedAsc={selectedAsc}
              newAscIds={newAscIds}
              onSelectClass={selectClass}
              onSelectAsc={selectAsc}
            />
          )}
          {step === 1 && (
            <>
              {!wizardMinimized && (
                <SearchPanel
                  query={query}
                  setQuery={setQuery}
                  results={results}
                  total={results.length}
                  diff={diff}
                  diffOn={diffOn}
                  onPick={pickSearch}
                  overrides={activeOverrides}
                />
              )}
              <BuildPanel
                hasClass={selectedClass != null}
                mainUsed={mainUsed}
                budget={baseBudget + bonus}
                bonus={bonus}
                ascUsed={ascUsed}
                ascBudget={ASC_BUDGET}
                mode={mode}
                set1={setCounts[0]}
                set2={setCounts[1]}
                swapMax={ascAlloc.has(WEAPON_MASTER_KEY) ? SWAP_MAX_MASTER : SWAP_MAX}
                setMode={setMode}
                setBaseBudget={setBaseBudget}
                onClear={clearBuild}
              />
              {!wizardMinimized && <NotesPanel nodes={notesNodes} notes={doc.notes} setNote={setNote} focusKey={focusKey && (alloc.has(focusKey) || ascAlloc.has(focusKey)) ? focusKey : null} focusName={focusKey ? tree.nodes.get(focusKey)?.name ?? null : null} />}
              {!wizardMinimized && selectedClass == null && (
                <div className="panel passives-locked-hint">
                  Go back to <strong>Details</strong> and select a class to unlock passive allocation.
                </div>
              )}
            </>
          )}
          {!wizardMinimized && step === 2 && <SkillsStep skills={doc.skills} setSkills={setSkills} version={version} />}
          {!wizardMinimized && step === 3 && (
            <InventoryStep
              inventory={doc.inventory}
              setInventory={setInventory}
              selectedAsc={selectedAsc}
            />
          )}
          <Controls camera={cameraRef.current} onReset={resetView} />
        </>
      ) : (
        <>
          <div className="side-col side-col--left" id="poe2-tree-left-panels">
            <SearchPanel
              query={query}
              setQuery={setQuery}
              results={results}
              total={results.length}
              diff={diff}
              diffOn={diffOn}
              onPick={pickSearch}
              overrides={activeOverrides}
            />
            <Controls camera={cameraRef.current} onReset={resetView} />
          </div>
          <div className="side-col side-col--right" id="poe2-tree-right-panels">
            <ClassPanel
              classes={tree.classes}
              selectedClass={selectedClass}
              selectedAsc={selectedAsc}
              newAscIds={newAscIds}
              onSelectClass={selectClass}
              onSelectAsc={selectAsc}
              onNewBuild={enterPlanner}
              onImport={triggerImport}
              onEdit={editBuild}
              canEdit={selectedClass != null || alloc.size > 0}
            />
            <VersionPanel
              versions={versions}
              version={version}
              setVersion={setVersion}
              compareOn={diffOn}
              setCompareOn={setCompareOn}
              compareVersion={compareVersion}
              setCompareVersion={setCompareVersion}
              compareOptions={comparisonOptions}
              selectedLabel={selectedLabel}
              compareLabel={compareLabel}
              comparisonLoading={comparisonLoading}
              comparisonError={comparisonError}
              onRetryComparison={retryComparison}
              diff={diff}
            />
            <StatsPanel
              tree={tree}
              alloc={alloc}
              ascAlloc={ascAlloc}
              selectedClass={selectedClass}
            />
          </div>
          <BuildPanel
            hasClass={selectedClass != null}
            mainUsed={mainUsed}
            budget={baseBudget + bonus}
            bonus={bonus}
            ascUsed={ascUsed}
            ascBudget={ASC_BUDGET}
            mode={mode}
            set1={setCounts[0]}
            set2={setCounts[1]}
            swapMax={ascAlloc.has(WEAPON_MASTER_KEY) ? SWAP_MAX_MASTER : SWAP_MAX}
            setMode={setMode}
            setBaseBudget={setBaseBudget}
            onClear={clearBuild}
          />
          <TreeSideToggle
            side="left"
            expanded={showLeft}
            label="Toggle search panel"
            controlsId="poe2-tree-left-panels"
            onClick={() => setShowLeft((visible) => !visible)}
          />
          <TreeSideToggle
            side="right"
            expanded={showRight}
            label="Toggle version and class panels"
            controlsId="poe2-tree-right-panels"
            onClick={() => setShowRight((visible) => !visible)}
          />
        </>
      )}

      <PobImportModal
        open={pobModalOpen}
        onClose={() => setPobModalOpen(false)}
        onPobString={onPobString}
        onFile={onImport}
      />

      <HoverLayer
        ref={hoverRef}
        diff={diff}
        diffOn={diffOn}
        overrides={activeOverrides}
        className={className}
        notes={doc.notes}
      />
    </div>
  );
}
