import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  chooseCompareVersion,
  getComparisonOptions,
} from "../tree/versionSelection.mjs";
import { createVersionRequestGate } from "../sharedTree/versionRequest.mjs";
import { computePoe1Diff } from "./diff.mjs";
import { normalizePoe1Tree } from "./data/normalizeTree.mjs";
import {
  getPoe1TreeDatasetUrl,
  parsePoe1VersionManifest,
} from "./data/source.mjs";
import type { ParsedPoe1Tree } from "./types";
import type {
  Poe1TreeDatasetOption,
  Poe1VersionManifest,
} from "./data/source.mjs";

const VERSION_MANIFEST_URL = `${import.meta.env.BASE_URL}data/poe1/tree-versions.json`;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchVersionManifest(): Promise<Poe1VersionManifest> {
  const response = await fetch(VERSION_MANIFEST_URL);
  if (!response.ok) {
    throw new Error(
      `Could not load PoE1 tree versions (HTTP ${response.status}).`,
    );
  }
  return parsePoe1VersionManifest(await response.json());
}

export function usePoe1TreeVersions() {
  const [manifest, setManifest] = useState<Poe1VersionManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestRetry, setManifestRetry] = useState(0);
  const [primaryRetry, setPrimaryRetry] = useState(0);
  const [comparisonRetry, setComparisonRetry] = useState(0);
  const [selectedDataset, setSelectedDatasetState] = useState("");
  const [compareDataset, setCompareDatasetState] = useState("");
  const [compareOn, setCompareOnState] = useState(false);
  const [tree, setTree] = useState<ParsedPoe1Tree | null>(null);
  const [compareTree, setCompareTree] = useState<ParsedPoe1Tree | null>(null);
  const [manifestLoading, setManifestLoading] = useState(true);
  const [primaryLoading, setPrimaryLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [primaryError, setPrimaryError] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const requestGateRef = useRef<ReturnType<typeof createVersionRequestGate> | null>(
    null,
  );
  if (!requestGateRef.current) {
    requestGateRef.current = createVersionRequestGate();
  }
  const requestGate = requestGateRef.current;
  const cache = useRef(new Map<string, ParsedPoe1Tree>());
  const inFlight = useRef(new Map<string, Promise<ParsedPoe1Tree>>());

  useEffect(() => {
    let active = true;
    setManifestLoading(true);
    setManifestError(null);

    void fetchVersionManifest().then(
      (loaded) => {
        if (!active) return;
        setManifest(loaded);
        setSelectedDatasetState(loaded.defaultDataset);
        setCompareDatasetState(
          chooseCompareVersion(
            loaded.datasets,
            loaded.defaultDataset,
            "",
            loaded.defaultCompareDataset,
          ),
        );
        setManifestLoading(false);
      },
      (error: unknown) => {
        if (!active) return;
        setManifestError(errorText(error));
        setManifestLoading(false);
        setPrimaryLoading(false);
      },
    );

    return () => {
      active = false;
    };
  }, [manifestRetry]);

  const loadDataset = useCallback((dataset: Poe1TreeDatasetOption) => {
    const key = dataset.id;
    const cached = cache.current.get(key);
    if (cached) return Promise.resolve(cached);

    const pending = inFlight.current.get(key);
    if (pending) return pending;

    const request = fetch(
      getPoe1TreeDatasetUrl(import.meta.env.BASE_URL, dataset),
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Could not load the PoE1 ${dataset.label} tree (HTTP ${response.status}).`,
          );
        }
        return response.json();
      })
      .then((data: unknown) =>
        normalizePoe1Tree(data, dataset.ruleset, dataset.versionId),
      )
      .then((loaded) => {
        cache.current.set(key, loaded);
        return loaded;
      });
    inFlight.current.set(key, request);
    void request.then(
      () => {
        if (inFlight.current.get(key) === request) inFlight.current.delete(key);
      },
      () => {
        if (inFlight.current.get(key) === request) inFlight.current.delete(key);
      },
    );
    return request;
  }, []);

  const datasets = manifest?.datasets ?? [];
  const primaryOption = datasets.find(
    (dataset) => dataset.id === selectedDataset,
  );
  const comparisonOptions = useMemo(
    () => getComparisonOptions(datasets, selectedDataset),
    [datasets, selectedDataset],
  );
  const compareOption = comparisonOptions.find(
    (dataset) => dataset.id === compareDataset,
  );

  useEffect(() => {
    if (!manifest || !primaryOption) return;

    const requestId = requestGate.begin();
    const cachedTree = cache.current.get(primaryOption.id) ?? null;
    const wantsComparison = compareOn && Boolean(compareOption);
    const cachedCompareTree = wantsComparison
      ? cache.current.get(compareOption!.id) ?? null
      : null;

    setTree(cachedTree);
    setCompareTree(cachedCompareTree);
    setPrimaryLoading(!cachedTree);
    setComparisonLoading(wantsComparison && !cachedCompareTree);
    setPrimaryError(null);
    setComparisonError(null);

    if (!cachedTree) {
      void loadDataset(primaryOption).then(
        (loaded) => {
          if (!requestGate.isCurrent(requestId)) return;
          setTree(loaded);
          setPrimaryLoading(false);
        },
        (error: unknown) => {
          if (!requestGate.isCurrent(requestId)) return;
          setTree(null);
          setPrimaryError(errorText(error));
          setPrimaryLoading(false);
        },
      );
    }

    if (wantsComparison && compareOption && !cachedCompareTree) {
      void loadDataset(compareOption).then(
        (loaded) => {
          if (!requestGate.isCurrent(requestId)) return;
          setCompareTree(loaded);
          setComparisonLoading(false);
        },
        (error: unknown) => {
          if (!requestGate.isCurrent(requestId)) return;
          setCompareTree(null);
          setComparisonError(errorText(error));
          setComparisonLoading(false);
        },
      );
    }

    return () => requestGate.cancel(requestId);
  }, [
    manifest,
    primaryOption,
    compareOption,
    compareOn,
    primaryRetry,
    comparisonRetry,
    loadDataset,
    requestGate,
  ]);

  const setSelectedDataset = useCallback(
    (datasetId: string) => {
      if (!manifest?.datasets.some((dataset) => dataset.id === datasetId)) {
        return;
      }
      setSelectedDatasetState(datasetId);
      setCompareDatasetState((current) =>
        chooseCompareVersion(
          manifest.datasets,
          datasetId,
          current,
          manifest.defaultCompareDataset,
        ),
      );
    },
    [manifest],
  );

  const setCompareDataset = useCallback(
    (datasetId: string) => {
      if (comparisonOptions.some((dataset) => dataset.id === datasetId)) {
        setCompareDatasetState(datasetId);
      }
    },
    [comparisonOptions],
  );

  const setCompareOn = useCallback(
    (enabled: boolean) => {
      if (enabled && comparisonOptions.length === 0) return;
      setCompareOnState(enabled);
    },
    [comparisonOptions.length],
  );

  const retryLoad = useCallback(() => {
    if (!manifest) {
      setManifestRetry((attempt) => attempt + 1);
      return;
    }
    setPrimaryRetry((attempt) => attempt + 1);
  }, [manifest]);

  const retryComparison = useCallback(() => {
    setComparisonRetry((attempt) => attempt + 1);
  }, []);

  const displayedTree =
    tree?.datasetId === selectedDataset ? tree : null;
  const displayedCompareTree =
    compareOption && compareTree?.datasetId === compareOption.id
      ? compareTree
      : null;
  const diff = useMemo(
    () =>
      compareOn && compareOption && displayedTree && displayedCompareTree
        ? computePoe1Diff(displayedCompareTree, displayedTree)
        : null,
    [compareOn, compareOption, displayedTree, displayedCompareTree],
  );

  const selectedLabel = primaryOption?.label ?? "";
  const compareLabel = compareOption?.label ?? "";

  return {
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
    tree: displayedTree,
    diff,
    manifestLoading,
    primaryLoading,
    comparisonLoading,
    primaryError,
    comparisonError,
    manifestError,
    retryLoad,
    retryComparison,
  };
}
