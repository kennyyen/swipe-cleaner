import { Album, Asset, AssetField, MediaType, Query, usePermissions } from 'expo-media-library';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

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
  canGoBack: boolean;
  deleteQueue: Asset[];
  committing: boolean;
  isCurrentQueued: boolean;
  queueDelete: () => void;
  keep: () => void;
  moveToAlbum: (albumId: string) => Promise<void>;
  goBack: () => void;
  commitDeletions: () => Promise<void>;
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
  const [committing, setCommitting] = useState(false);

  // Stable ref-based URI cache — avoids re-render churn on every cache write
  const uriCacheRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!permission?.granted) return;
    setLoading(true);
    new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
      .exe()
      .then((results) => {
        setAssets(results);
        setLoading(false);
      });
  }, [permission?.granted]);

  const getUri = useCallback(async (asset: Asset): Promise<string> => {
    if (uriCacheRef.current[asset.id]) return uriCacheRef.current[asset.id];
    const uri = await asset.getUri();
    uriCacheRef.current[asset.id] = uri;
    return uri;
  }, []);

  // Resolve URI + creation time, preload next URI
  useEffect(() => {
    const current = assets[index];
    if (!current) {
      setCurrentUri(null);
      setCurrentCreationTime(null);
      return;
    }
    getUri(current).then(setCurrentUri);
    current.getCreationTime().then(setCurrentCreationTime);
    if (assets[index + 1]) getUri(assets[index + 1]); // preload next
  }, [assets, index, getUri]);

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

  const keep = useCallback(() => {
    const asset = assets[index];
    if (asset && isQueued(asset)) {
      setDeleteQueue((q) => q.filter((a) => a.id !== asset.id));
    }
    setIndex((i) => i + 1);
  }, [assets, index, isQueued]);

  const moveToAlbum = useCallback(async (albumId: string) => {
    const asset = assets[index];
    if (!asset) return;
    try {
      const album = new Album(albumId);
      await album.add(asset);
    } catch {}
    setIndex((i) => i + 1);
  }, [assets, index]);

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const startFrom = useCallback((newIndex: number) => {
    setIndex(Math.max(0, Math.min(newIndex, assets.length - 1)));
  }, [assets.length]);

  const removeFromQueue = useCallback((assetId: string) => {
    setDeleteQueue((q) => q.filter((a) => a.id !== assetId));
  }, []);

  const commitDeletions = useCallback(async () => {
    if (deleteQueue.length === 0) return;
    setCommitting(true);
    try {
      await Asset.delete(deleteQueue);
      setDeleteQueue([]);
    } catch {
      // User cancelled iOS system confirmation
    } finally {
      setCommitting(false);
    }
  }, [deleteQueue]);

  const currentAsset = assets[index] ?? null;
  const remaining = Math.max(0, assets.length - index);

  return (
    <PhotoLibraryContext.Provider
      value={{
        permission,
        requestPermission,
        assets,
        index,
        startFrom,
        currentAsset,
        currentUri,
        currentCreationTime,
        remaining,
        done: !loading && remaining === 0,
        loading,
        canGoBack: index > 0,
        deleteQueue,
        committing,
        isCurrentQueued: currentAsset ? isQueued(currentAsset) : false,
        queueDelete,
        keep,
        moveToAlbum,
        goBack,
        commitDeletions,
        removeFromQueue,
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
