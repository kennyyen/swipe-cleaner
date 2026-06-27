import { Album, Asset, AssetField, MediaType, Query, usePermissions } from 'expo-media-library';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PhotoGroup } from '../types';

const PAGE_SIZE = 200;
const LOAD_MORE_THRESHOLD = 40; // start loading next page when this many assets left
const URI_PRELOAD_AHEAD = 3;

type PermissionResponse = ReturnType<typeof usePermissions>[0];
type RequestPermission = ReturnType<typeof usePermissions>[1];

type ContextValue = {
  permission: PermissionResponse;
  requestPermission: RequestPermission;
  assets: Asset[];
  index: number;
  startFrom: (index: number) => void;
  currentAsset: Asset | null;
  currentUri: string | null;
  currentCreationTime: number | null;
  remaining: number;
  done: boolean;
  loading: boolean;
  loadingMore: boolean;
  canGoBack: boolean;
  loadMoreAssets: () => void;
  // Burst grouping
  groups: PhotoGroup[];
  groupsLoading: boolean;
  groupingThresholdSecs: number;
  setGroupingThresholdSecs: (n: number) => void;
  assetIndexOf: (assetId: string) => number;
  // Delete queue
  deleteQueue: Asset[];
  committing: boolean;
  isCurrentQueued: boolean;
  queueDelete: () => void;
  queueAssets: (assets: Asset[]) => void;
  clearDeleteQueue: () => void;
  keep: () => void;
  moveToAlbum: (albumId: string) => Promise<void>;
  goBack: () => void;
  commitDeletions: () => Promise<void>;
  commitSpecificDeletions: (assets: Asset[]) => Promise<void>;
  removeFromQueue: (assetId: string) => void;
  getUri: (asset: Asset) => Promise<string>;
};

const PhotoLibraryContext = createContext<ContextValue | null>(null);

export function PhotoLibraryProvider({ children }: { children: React.ReactNode }) {
  const [permission, requestPermission] = usePermissions();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [index, setIndex] = useState(0);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [currentCreationTime, setCurrentCreationTime] = useState<number | null>(null);
  const [deleteQueue, setDeleteQueue] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [committing, setCommitting] = useState(false);
  // Burst grouping
  const [groupingThresholdSecs, setGroupingThresholdSecs] = useState(5);
  const [creationTimes, setCreationTimes] = useState<Record<string, number>>({});
  const [groupsLoading, setGroupsLoading] = useState(false);

  const uriCacheRef = useRef<Record<string, string>>({});
  const pageOffsetRef = useRef(0);
  // Track how many assets we've already fetched creation times for
  const timesFetchedCountRef = useRef(0);

  // Fetch creation times for newly added assets (one batch per page)
  const fetchCreationTimesForNew = useCallback((newAssets: Asset[], isLastPage: boolean) => {
    if (newAssets.length === 0) return;
    Promise.all(
      newAssets.map(async (a) => ({ id: a.id, time: await a.getCreationTime() }))
    ).then((results) => {
      setCreationTimes((prev) => {
        const next = { ...prev };
        results.forEach(({ id, time }) => { if (time !== null) next[id] = time; });
        return next;
      });
      if (isLastPage) setGroupsLoading(false);
    });
  }, []);

  // Load first page
  useEffect(() => {
    if (!permission?.granted) return;
    setLoading(true);
    setGroupsLoading(true);
    pageOffsetRef.current = 0;
    timesFetchedCountRef.current = 0;
    new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
      .limit(PAGE_SIZE)
      .exe()
      .then((results) => {
        setAssets(results);
        pageOffsetRef.current = results.length;
        timesFetchedCountRef.current = results.length;
        const isLast = results.length < PAGE_SIZE;
        setHasMore(!isLast);
        setLoading(false);
        fetchCreationTimesForNew(results, isLast);
      });
  }, [permission?.granted]);

  const loadMoreAssets = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
      .limit(PAGE_SIZE)
      .offset(pageOffsetRef.current)
      .exe()
      .then((results) => {
        if (results.length === 0) {
          setHasMore(false);
          setLoadingMore(false);
          setGroupsLoading(false);
          return;
        }
        setAssets((prev) => [...prev, ...results]);
        pageOffsetRef.current += results.length;
        timesFetchedCountRef.current += results.length;
        const isLast = results.length < PAGE_SIZE;
        setHasMore(!isLast);
        setLoadingMore(false);
        fetchCreationTimesForNew(results, isLast);
      });
  }, [loadingMore, hasMore, fetchCreationTimesForNew]);

  // Compute groups whenever assets, times, or threshold changes
  const groups = useMemo<PhotoGroup[]>(() => {
    if (assets.length === 0) return [];
    const thresholdMs = groupingThresholdSecs * 1000;
    const result: PhotoGroup[] = [];
    let current: Asset[] = [assets[0]];

    for (let i = 1; i < assets.length; i++) {
      const prevTime = creationTimes[assets[i - 1].id];
      const currTime = creationTimes[assets[i].id];
      const closeEnough =
        prevTime !== undefined &&
        currTime !== undefined &&
        Math.abs(currTime - prevTime) <= thresholdMs;

      if (closeEnough) {
        current.push(assets[i]);
      } else {
        result.push({ id: current[0].id, assets: current, isBurst: current.length > 1 });
        current = [assets[i]];
      }
    }
    result.push({ id: current[0].id, assets: current, isBurst: current.length > 1 });
    return result;
  }, [assets, creationTimes, groupingThresholdSecs]);

  // Fast asset-id → asset-array-index lookup
  const assetIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a, i) => { map[a.id] = i; });
    return map;
  }, [assets]);

  const assetIndexOf = useCallback(
    (assetId: string) => assetIndexMap[assetId] ?? 0,
    [assetIndexMap]
  );

  const getUri = useCallback(async (asset: Asset): Promise<string> => {
    if (uriCacheRef.current[asset.id]) return uriCacheRef.current[asset.id];
    const uri = await asset.getUri();
    uriCacheRef.current[asset.id] = uri;
    return uri;
  }, []);

  // Resolve URI + creation time for current asset; preload ahead; trigger page load near end
  useEffect(() => {
    const current = assets[index];
    if (!current) { setCurrentUri(null); setCurrentCreationTime(null); return; }
    getUri(current).then(setCurrentUri);
    current.getCreationTime().then(setCurrentCreationTime);
    // Preload upcoming URIs
    for (let i = 1; i <= URI_PRELOAD_AHEAD; i++) {
      if (assets[index + i]) getUri(assets[index + i]);
    }
    // Load next page when approaching end
    if (assets.length - index <= LOAD_MORE_THRESHOLD && hasMore && !loadingMore) {
      loadMoreAssets();
    }
  }, [assets, index, getUri, hasMore, loadingMore, loadMoreAssets]);

  const isQueued = useCallback(
    (asset: Asset) => deleteQueue.some((a) => a.id === asset.id),
    [deleteQueue]
  );

  const queueDelete = useCallback(() => {
    const asset = assets[index];
    if (!asset) return;
    if (!isQueued(asset)) setDeleteQueue((q) => [...q, asset]);
    setIndex((i) => i + 1);
  }, [assets, index, isQueued]);

  const queueAssets = useCallback((toQueue: Asset[]) => {
    setDeleteQueue((q) => {
      const existingIds = new Set(q.map((a) => a.id));
      const newOnes = toQueue.filter((a) => !existingIds.has(a.id));
      return [...q, ...newOnes];
    });
  }, []);

  const clearDeleteQueue = useCallback(() => setDeleteQueue([]), []);

  const keep = useCallback(() => {
    const asset = assets[index];
    if (asset && isQueued(asset)) setDeleteQueue((q) => q.filter((a) => a.id !== asset.id));
    setIndex((i) => i + 1);
  }, [assets, index, isQueued]);

  const moveToAlbum = useCallback(async (albumId: string) => {
    const asset = assets[index];
    if (!asset) return;
    try { await new Album(albumId).add(asset); } catch {}
    setIndex((i) => i + 1);
  }, [assets, index]);

  const goBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const startFrom = useCallback(
    (newIndex: number) => setIndex(Math.max(0, Math.min(newIndex, assets.length - 1))),
    [assets.length]
  );

  const removeFromQueue = useCallback(
    (assetId: string) => setDeleteQueue((q) => q.filter((a) => a.id !== assetId)),
    []
  );

  const commitDeletions = useCallback(async () => {
    if (deleteQueue.length === 0) return;
    setCommitting(true);
    try {
      await Asset.delete(deleteQueue);
      setDeleteQueue([]);
    } catch {} finally { setCommitting(false); }
  }, [deleteQueue]);

  const commitSpecificDeletions = useCallback(async (toDelete: Asset[]) => {
    if (toDelete.length === 0) return;
    setCommitting(true);
    try {
      await Asset.delete(toDelete);
      const deletedIds = new Set(toDelete.map((a) => a.id));
      setDeleteQueue((q) => q.filter((a) => !deletedIds.has(a.id)));
    } catch {} finally { setCommitting(false); }
  }, []);

  const currentAsset = assets[index] ?? null;
  const remaining = Math.max(0, assets.length - index);

  return (
    <PhotoLibraryContext.Provider
      value={{
        permission, requestPermission,
        assets, index, startFrom,
        currentAsset, currentUri, currentCreationTime,
        remaining,
        done: !loading && !hasMore && remaining === 0,
        loading,
        loadingMore,
        canGoBack: index > 0,
        loadMoreAssets,
        groups, groupsLoading, groupingThresholdSecs, setGroupingThresholdSecs,
        assetIndexOf,
        deleteQueue, committing,
        isCurrentQueued: currentAsset ? isQueued(currentAsset) : false,
        queueDelete, queueAssets, clearDeleteQueue, keep, moveToAlbum, goBack,
        commitDeletions, commitSpecificDeletions, removeFromQueue,
        getUri,
      }}
    >
      {children}
    </PhotoLibraryContext.Provider>
  );
}

export function usePhotoLibrary() {
  const ctx = useContext(PhotoLibraryContext);
  if (!ctx) throw new Error('usePhotoLibrary must be used within PhotoLibraryProvider');
  return ctx;
}
