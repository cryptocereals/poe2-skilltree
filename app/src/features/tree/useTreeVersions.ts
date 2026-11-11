import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeDiff } from "./diff";
import { loadTree, type ProgressFn } from "./data/treeData";
import type { ParsedTree, VersionDiff } from "../../types";
import {
  chooseCompareVersion,
  getComparisonOptions,
} from "./versionSelection.mjs";
import type { TreeVersionOption } from "./versionSelection.mjs";
import { createVersionRequestGate } from "../sharedTree/versionRequest.mjs";

interface TreeVersionManifest {
  defaultVersion: string;
  defaultCompareVersion: string | null;
  versions: TreeVersionOption[];
}

interface ProgressValue {
  loaded: number;
  total: number;
}

const SAFE_VERSION_ID = /^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/;
const MANIFEST_URL = `${import.meta.env.BASE_URL}data/tree-versions.json`;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseManifest(value: unknown): TreeVersionManifest {
  const raw = asRecord(value);
  if (!raw || !Array.isArray(raw.versions)) {
    throw new Error("The tree-version list is missing or malformed.");
  }

  const seen = new Set<string>();
  const versions: TreeVersionOption[] = [];
  for (const entry of raw.versions) {
    const option = asRecord(entry);
    if (
      !option ||
      typeof option.id !== "string" ||
      !SAFE_VERSION_ID.test(option.id) ||
      typeof option.label !== "string" ||
      !option.label.trim() ||
      seen.has(option.id)
    ) {
      throw new Error("The tree-version list contains an invalid entry.");
    }
    seen.add(option.id);
    versions.push({ id: option.id, label: option.label });
  }

  if (versions.length === 0 || typeof raw.defaultVersion !== "string" || !seen.has(raw.defaultVersion)) {
    throw new Error("The tree-version list has no usable default tree.");
  }

  const defaultCompareVersion =
    typeof raw.defaultCompareVersion === "string" &&
    seen.has(raw.defaultCompareVersion) &&
    raw.defaultCompareVersion !== raw.defaultVersion
      ? raw.defaultCompareVersion
      : null;

  return { defaultVersion: raw.defaultVersion, defaultCompareVersion, versions };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchManifest(): Promise<TreeVersionManifest> {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Could not load tree versions (HTTP ${response.status}).`);
  }
  return parseManifest(await response.json());
}

export function useTreeVersions() {
  const [manifest, setManifest] = useState<TreeVersionManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestRetry, setManifestRetry] = useState(0);
  const [treeRetry, setTreeRetry] = useState(0);
  const [selectedVersion, setSelectedVersionState] = useState("");
  const [compareVersion, setCompareVersionState] = useState("");
  const [compareOn, setCompareOnState] = useState(false);
  const [tree, setTree] = useState<ParsedTree | null>(null);
  const [compareTree, setCompareTree] = useState<ParsedTree | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [primaryError, setPrimaryError] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const requestGateRef = useRef<ReturnType<typeof createVersionRequestGate> | null>(
    null,
  );
  if (!requestGateRef.current) {
    requestGateRef.current = createVersionRequestGate();
  }
  const requestGate = requestGateRef.current;
  const cache = useRef(new Map<string, ParsedTree>());
  const inFlight = useRef(new Map<string, Promise<ParsedTree>>());
  const progressValues = useRef(new Map<string, ProgressValue>());

  useEffect(() => {
    let active = true;
    setManifestError(null);
    setPrimaryLoading(true);

    void fetchManifest()
      .then((loaded) => {
        if (!active) return;
        setManifest(loaded);
        setSelectedVersionState(loaded.defaultVersion);
        setCompareVersionState(
          chooseCompareVersion(
            loaded.versions,
            loaded.defaultVersion,
            "",
            loaded.defaultCompareVersion,
          ),
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setManifestError(errorText(error));
        setPrimaryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [manifestRetry]);

  const loadVersion = useCallback((version: string, onProgress: ProgressFn) => {
    const cached = cache.current.get(version);
    if (cached) return Promise.resolve(cached);

    const pending = inFlight.current.get(version);
    if (pending) return pending;

    const request = loadTree(version, onProgress).then((loaded) => {
      cache.current.set(version, loaded);
      return loaded;
    });
    inFlight.current.set(version, request);
    void request.then(
      () => {
        if (inFlight.current.get(version) === request) inFlight.current.delete(version);
      },
      () => {
        if (inFlight.current.get(version) === request) inFlight.current.delete(version);
      },
    );
    return request;
  }, []);

  useEffect(() => {
    if (!manifest || !selectedVersion) return;

    const currentRequest = requestGate.begin();
    const cachedTree = cache.current.get(selectedVersion) ?? null;
    const wantsComparison =
      compareOn &&
      compareVersion !== selectedVersion &&
      manifest.versions.some((version) => version.id === compareVersion);
    const cachedCompareTree = wantsComparison
      ? cache.current.get(compareVersion) ?? null
      : null;

    progressValues.current.clear();
    setTree(cachedTree);
    setCompareTree(cachedCompareTree);
    setPrimaryLoading(!cachedTree);
    setComparisonLoading(wantsComparison && !cachedCompareTree);
    setPrimaryError(null);
    setComparisonError(null);

    let pendingCount = Number(!cachedTree) + Number(wantsComparison && !cachedCompareTree);
    setProgress(pendingCount === 0 ? 1 : 0);

    const reportProgress = (version: string): ProgressFn => (loaded, total) => {
      if (!requestGate.isCurrent(currentRequest) || total <= 0) return;
      progressValues.current.set(version, { loaded, total });
      let totalLoaded = 0;
      let totalBytes = 0;
      for (const item of progressValues.current.values()) {
        totalLoaded += item.loaded;
        totalBytes += item.total;
      }
      if (totalBytes > 0) setProgress(Math.min(0.99, totalLoaded / totalBytes));
    };

    const completeRequest = () => {
      pendingCount -= 1;
      if (requestGate.isCurrent(currentRequest) && pendingCount === 0) {
        setProgress(1);
      }
    };

    if (!cachedTree) {
      void loadVersion(selectedVersion, reportProgress(selectedVersion)).then(
        (loaded) => {
          if (!requestGate.isCurrent(currentRequest)) return;
          setTree(loaded);
          setPrimaryLoading(false);
          completeRequest();
        },
        (error: unknown) => {
          if (!requestGate.isCurrent(currentRequest)) return;
          setTree(null);
          setPrimaryError(errorText(error));
          setPrimaryLoading(false);
          completeRequest();
        },
      );
    }

    if (wantsComparison && !cachedCompareTree) {
      void loadVersion(compareVersion, reportProgress(compareVersion)).then(
        (loaded) => {
          if (!requestGate.isCurrent(currentRequest)) return;
          setCompareTree(loaded);
          setComparisonLoading(false);
          completeRequest();
        },
        (error: unknown) => {
          if (!requestGate.isCurrent(currentRequest)) return;
          setCompareTree(null);
          setComparisonError(errorText(error));
          setComparisonLoading(false);
          completeRequest();
        },
      );
    }

    return () => {
      requestGate.cancel(currentRequest);
    };
  }, [
    manifest,
    selectedVersion,
    compareVersion,
    compareOn,
    treeRetry,
    loadVersion,
    requestGate,
  ]);

  const comparisonOptions = useMemo(
    () => (manifest ? getComparisonOptions(manifest.versions, selectedVersion) : []),
    [manifest, selectedVersion],
  );

  const setSelectedVersion = useCallback(
    (version: string) => {
      if (!manifest?.versions.some((option) => option.id === version)) return;
      setSelectedVersionState(version);
      setCompareVersionState((current) =>
        chooseCompareVersion(
          manifest.versions,
          version,
          current,
          manifest.defaultCompareVersion,
        ),
      );
    },
    [manifest],
  );

  const setCompareVersion = useCallback(
    (version: string) => {
      if (comparisonOptions.some((option) => option.id === version)) {
        setCompareVersionState(version);
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
    setTreeRetry((attempt) => attempt + 1);
  }, [manifest]);

  const retryComparison = useCallback(() => {
    setTreeRetry((attempt) => attempt + 1);
  }, []);

  const diff: VersionDiff | null = useMemo(
    () => (compareOn && tree && compareTree ? computeDiff(compareTree, tree) : null),
    [compareOn, tree, compareTree],
  );

  const newAscIds = useMemo(() => {
    const added = new Set<string>();
    if (!compareOn || !tree || !compareTree) return added;

    const previousIds = new Set<string>();
    for (const cls of compareTree.classes) {
      for (const asc of cls.ascendancies) {
        if (asc?.id && asc.name && !asc.name.startsWith("[DNT")) previousIds.add(asc.id);
      }
    }
    for (const cls of tree.classes) {
      for (const asc of cls.ascendancies) {
        if (asc?.id && asc.name && !asc.name.startsWith("[DNT") && !previousIds.has(asc.id)) {
          added.add(asc.id);
        }
      }
    }
    return added;
  }, [compareOn, tree, compareTree]);

  const selectedLabel =
    manifest?.versions.find((version) => version.id === selectedVersion)?.label ?? "";
  const compareLabel =
    manifest?.versions.find((version) => version.id === compareVersion)?.label ?? "";

  return {
    versions: manifest?.versions ?? [],
    selectedVersion,
    setSelectedVersion,
    compareVersion,
    setCompareVersion,
    comparisonOptions,
    compareOn,
    setCompareOn,
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
  };
}
