import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "../../../lib/camera";
import TreePanel from "../../sharedTree/components/TreePanel";
import TreeSideToggle from "../../sharedTree/components/TreeSideToggle";
import TreeVersionPanel from "../../sharedTree/components/TreeVersionPanel";
import TreeViewControls from "../../sharedTree/components/TreeViewControls";
import { findPoe1AscendancyStart, identifyPoe1Ascendancy } from "../data/ascendancySelection.mjs";
import type { Poe1TreeNode, ParsedPoe1Tree } from "../types";
import { usePoe1Allocation } from "../allocation/usePoe1Allocation";
import { usePoe1TreeVersions } from "../usePoe1TreeVersions";
import Poe1BuildPanel from "./Poe1BuildPanel";
import Poe1ClassPanel from "./Poe1ClassPanel";
import Poe1HoverLayer, { type Poe1HoverHandle } from "./Poe1HoverLayer";
import Poe1NodeDetails from "./Poe1NodeDetails";
import Poe1SearchPanel from "./Poe1SearchPanel";
import Poe1StatsPanel from "./Poe1StatsPanel";
import Poe1TreeCanvas from "../canvas/Poe1TreeCanvas";
import Poe1MasteryChoiceDialog from "../mastery/Poe1MasteryChoiceDialog";
import "./Poe1TreeWorkspace.css";
import "../mastery/mastery.css";

function classStartIndexForNode(
  tree: ParsedPoe1Tree,
  node: Poe1TreeNode,
  selectedClass: number | null,
): number | null {
  let firstMatch: number | null = null;
  for (const [classIndex, start] of tree.classStart) {
    if (start.key !== node.key) continue;
    if (classIndex === selectedClass) return classIndex;
    if (firstMatch == null) firstMatch = classIndex;
  }
  return firstMatch;
}

export default function Poe1TreeWorkspace() {
  const camera = useRef(new Camera());
  const hoverRef = useRef<Poe1HoverHandle>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetRetry, setAssetRetry] = useState(0);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [focusNodeKey, setFocusNodeKey] = useState<string | null>(null);
  const [masteryPickerKey, setMasteryPickerKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const {
    datasets,
    selectedDataset,
    setSelectedDataset,
    compareDataset,
    setCompareDataset,
    comparisonOptions,
    compareOn,
    setCompareOn,
    selectedLabel,
    compareLabel,
    tree,
    diff,
    manifestLoading,
    primaryLoading,
    comparisonLoading,
    primaryError,
    comparisonError,
    manifestError,
    retryLoad,
    retryComparison,
  } = usePoe1TreeVersions();
  const allocation = usePoe1Allocation(selectedDataset, tree);
  const {
    selectedClass,
    selectedAscendancyId,
    mainAlloc,
    ascAlloc,
  } = allocation.state;
  const loading = manifestLoading || primaryLoading;
  const treeError = manifestError || primaryError;

  const onHover = useCallback(
    (node: Poe1TreeNode | null, x: number, y: number) => {
      hoverRef.current?.setHover(node, x, y);
    },
    [],
  );

  useEffect(() => {
    hoverRef.current?.setHover(null, 0, 0);
    setSelectedNodeKey(null);
    setFocusNodeKey(null);
    setMasteryPickerKey(null);
    setAssetError(null);
  }, [selectedDataset]);

  const searchResults = useMemo(() => {
    if (!tree || !query.trim()) {
      return { items: [] as Poe1TreeNode[], total: 0 };
    }
    const needle = query.trim().toLocaleLowerCase();
    const matches = tree.nodeList.filter(
      (node) =>
        node.name.toLocaleLowerCase().includes(needle) ||
        node.ascendancyName?.toLocaleLowerCase().includes(needle) ||
        node.stats.some((stat) => stat.toLocaleLowerCase().includes(needle)),
    );
    matches.sort((left, right) => {
      const priority = (node: Poe1TreeNode) =>
        node.kind === "keystone" ? 3 : node.kind === "notable" ? 2 : 1;
      return (
        priority(right) - priority(left) ||
        left.name.localeCompare(right.name)
      );
    });
    return { items: matches.slice(0, 30), total: matches.length };
  }, [tree, query]);

  const selectedNode = tree?.nodes.get(selectedNodeKey ?? "") ?? null;
  const masteryPickerNode =
    tree?.nodes.get(masteryPickerKey ?? "") ?? null;

  const openMasteryPicker = useCallback((nodeKey: string) => {
    setSelectedNodeKey(nodeKey);
    setMasteryPickerKey(nodeKey);
  }, []);

  const closeMasteryPicker = useCallback(() => {
    setMasteryPickerKey(null);
  }, []);

  const chooseMasteryEffect = useCallback(
    (effectId: number) => {
      if (!masteryPickerNode) return;
      allocation.chooseMasteryEffect(masteryPickerNode.key, effectId);
      setMasteryPickerKey(null);
    },
    [allocation.chooseMasteryEffect, masteryPickerNode],
  );

  const clearMasteryChoice = useCallback(() => {
    if (!masteryPickerNode) return;
    allocation.clearMasteryChoice(masteryPickerNode.key);
    setMasteryPickerKey(null);
  }, [allocation.clearMasteryChoice, masteryPickerNode]);

  const removeMastery = useCallback(() => {
    if (!masteryPickerNode) return;
    allocation.removeMastery(masteryPickerNode.key);
    setMasteryPickerKey(null);
  }, [allocation.removeMastery, masteryPickerNode]);

  const focusNode = useCallback(
    (key: string) => {
      setSelectedNodeKey(key);
      setFocusNodeKey(key);
      if (!tree) return;
      const node = tree.nodes.get(key);
      if (!node) return;

      const ascendancy = identifyPoe1Ascendancy(tree, node);
      if (ascendancy) {
        allocation.selectClass(ascendancy.classIndex);
        allocation.selectAscendancy(ascendancy.ascendancyId);
        return;
      }

      const classIndex = classStartIndexForNode(tree, node, selectedClass);
      if (classIndex != null && classIndex !== selectedClass) {
        allocation.selectClass(classIndex);
      }
    },
    [
      tree,
      selectedClass,
      allocation.selectClass,
      allocation.selectAscendancy,
    ],
  );

  const selectClass = useCallback(
    (classIndex: number | null) => {
      allocation.selectClass(classIndex);
      const start =
        classIndex == null ? null : tree?.classStart.get(classIndex) ?? null;
      setSelectedNodeKey(start?.key ?? null);
      setFocusNodeKey(start?.key ?? null);
    },
    [tree, allocation.selectClass],
  );

  const selectAscendancy = useCallback(
    (ascendancyId: string | null) => {
      allocation.selectAscendancy(ascendancyId);
      const start =
        tree && selectedClass != null
          ? ascendancyId
            ? findPoe1AscendancyStart(tree, selectedClass, ascendancyId)
            : tree.classStart.get(selectedClass) ?? null
          : null;
      setSelectedNodeKey(start?.key ?? null);
      setFocusNodeKey(start?.key ?? null);
    },
    [tree, selectedClass, allocation.selectAscendancy],
  );

  const selectNodeDetails = useCallback((key: string | null) => {
    setSelectedNodeKey(key);
  }, []);

  const pickNode = useCallback(
    (node: Poe1TreeNode | null) => {
      setSelectedNodeKey(node?.key ?? null);
      if (!tree || !node) return;
      if (node.kind === "mastery") {
        setMasteryPickerKey(node.key);
        return;
      }

      const ascendancy = identifyPoe1Ascendancy(tree, node);
      if (
        ascendancy &&
        (ascendancy.classIndex !== selectedClass ||
          ascendancy.ascendancyId !== selectedAscendancyId)
      ) {
        if (ascendancy.classIndex !== selectedClass) {
          allocation.selectClass(ascendancy.classIndex);
        }
        allocation.selectAscendancy(ascendancy.ascendancyId);
        const start = findPoe1AscendancyStart(
          tree,
          ascendancy.classIndex,
          ascendancy.ascendancyId,
        );
        setFocusNodeKey(start?.key ?? node.key);
        return;
      }

      const classIndex = classStartIndexForNode(tree, node, selectedClass);
      if (classIndex != null && classIndex !== selectedClass) {
        allocation.selectClass(classIndex);
        setFocusNodeKey(tree.classStart.get(classIndex)?.key ?? node.key);
        return;
      }

      allocation.pickNode(node);
    },
    [
      tree,
      selectedClass,
      selectedAscendancyId,
      allocation.selectClass,
      allocation.selectAscendancy,
      allocation.pickNode,
    ],
  );

  const fitTree = useCallback(() => {
    if (tree) camera.current.fit(tree.bounds);
  }, [tree]);

  const assetStatus = assetError ? (
    <div className="version__error" role="alert">
      <span>Tree art could not load: {assetError}</span>
      <button
        type="button"
        onClick={() => setAssetRetry((retry) => retry + 1)}
      >
        Retry tree art
      </button>
    </div>
  ) : null;

  return (
    <div
      className={
        "poe1-tree-workspace" +
        (showLeft ? " show-left" : "") +
        (showRight ? " show-right" : "")
      }
      role="region"
      aria-label="Path of Exile 1 skill tree"
    >
      {tree && (
        <Poe1TreeCanvas
          tree={tree}
          camera={camera.current}
          allocation={allocation.state}
          activeNodeKeys={allocation.activeNodeKeys}
          selectedNodeKey={selectedNodeKey}
          focusNodeKey={focusNodeKey}
          assetRetry={assetRetry}
          onAssetError={setAssetError}
          onSelectNode={selectNodeDetails}
          onPickNode={pickNode}
          diff={diff}
          diffOn={compareOn}
          onHover={onHover}
        />
      )}

      <div
        className="side-col side-col--left poe1-tree-panels"
        id="poe1-tree-left-panels"
      >
        <Poe1SearchPanel
          query={query}
          onQueryChange={setQuery}
          results={searchResults.items}
          total={searchResults.total}
          onSelectNode={focusNode}
        />
        <TreeViewControls
          camera={camera.current}
          onReset={fitTree}
        />
      </div>

      <div
        className="side-col side-col--right poe1-tree-panels"
        id="poe1-tree-right-panels"
      >
        {tree ? (
          <Poe1ClassPanel
            tree={tree}
            classes={tree.classes}
            selectedClass={selectedClass}
            selectedAscendancyId={selectedAscendancyId}
            onSelectClass={selectClass}
            onSelectAscendancy={selectAscendancy}
          />
        ) : (
          <TreePanel
            as="section"
            className="classes poe1-class-panel"
            aria-label="PoE1 class selection"
          >
            <div className="panel__title">Class · Ascendancy</div>
            <p className="poe1-details__empty">
              {loading
                ? "Class choices are loading with the selected dataset."
                : "Class choices are unavailable until the tree data loads."}
            </p>
          </TreePanel>
        )}

        <TreeVersionPanel
          className="poe1-version-panel"
          title="Tree dataset"
          versionFieldLabel="Version · ruleset"
          comparisonToggleLabel="Compare with another dataset"
          comparisonHint="Choose any available version and ruleset."
          comparisonFieldLabel="Compare with"
          noComparisonLabel="No other tree datasets are available."
          versions={datasets}
          version={selectedDataset}
          setVersion={setSelectedDataset}
          compareOn={compareOn}
          setCompareOn={setCompareOn}
          compareVersion={compareDataset}
          setCompareVersion={setCompareDataset}
          compareOptions={comparisonOptions}
          selectedLabel={selectedLabel}
          compareLabel={compareLabel}
          comparisonLoading={comparisonLoading}
          comparisonError={comparisonError}
          onRetryComparison={retryComparison}
          diffCounts={diff?.counts ?? null}
          primaryLoading={loading}
          primaryError={treeError}
          onRetryPrimary={retryLoad}
          statusContent={assetStatus}
        />

        {tree && (
          <Poe1StatsPanel
            tree={tree}
            allocation={allocation.state}
          />
        )}
        <Poe1NodeDetails
          node={selectedNode}
          masteryEffectId={
            selectedNode
              ? allocation.state.masteryChoices.get(selectedNode.key) ?? null
              : null
          }
          masteryAllocated={
            selectedNode ? mainAlloc.has(selectedNode.key) : false
          }
          onOpenMastery={openMasteryPicker}
        />
      </div>

      <Poe1BuildPanel
        mainPoints={mainAlloc.size}
        ascendancyPoints={ascAlloc.size}
        onClear={allocation.clear}
      />

      <TreeSideToggle
        side="left"
        expanded={showLeft}
        label="Toggle search and view controls"
        controlsId="poe1-tree-left-panels"
        onClick={() => setShowLeft((visible) => !visible)}
      />
      <TreeSideToggle
        side="right"
        expanded={showRight}
        label="Toggle class, tree dataset, and stats panels"
        controlsId="poe1-tree-right-panels"
        onClick={() => setShowRight((visible) => !visible)}
      />
      <Poe1HoverLayer
        ref={hoverRef}
        diff={diff}
        diffOn={compareOn}
        selectedLabel={selectedLabel}
        compareLabel={compareLabel}
        masteryChoices={allocation.state.masteryChoices}
      />
      {tree && masteryPickerNode && (
        <Poe1MasteryChoiceDialog
          tree={tree}
          state={allocation.state}
          node={masteryPickerNode}
          onChoose={chooseMasteryEffect}
          onClearChoice={clearMasteryChoice}
          onRemove={removeMastery}
          onClose={closeMasteryPicker}
        />
      )}
    </div>
  );
}
