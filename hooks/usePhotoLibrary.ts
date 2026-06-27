import { useCallback, useEffect, useRef, useState } from 'react';
import { Album, Asset, AssetField, MediaType, Query, usePermissions } from 'expo-media-library';

export function usePhotoLibrary() {
  const [permission, requestPermission] = usePermissions();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [index, setIndex] = useState(0);
  const [uriCache, setUriCache] = useState<Record<string, string>>({});
  const [deleteQueue, setDeleteQueue] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);

  // Load all photo assets once on permission grant
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

  // Cache URI for current asset (and preload next)
  const cacheUri = useCallback(
    async (asset: Asset) => {
      if (uriCache[asset.id]) return;
      const uri = await asset.getUri();
      setUriCache((prev) => ({ ...prev, [asset.id]: uri }));
    },
    [uriCache]
  );

  useEffect(() => {
    if (assets[index]) cacheUri(assets[index]);
    if (assets[index + 1]) cacheUri(assets[index + 1]); // preload next
  }, [assets, index]);

  const isQueued = useCallback(
    (asset: Asset) => deleteQueue.some((a) => a.id === asset.id),
    [deleteQueue]
  );

  // Queue photo for deletion and advance
  const queueDelete = useCallback(() => {
    const asset = assets[index];
    if (!asset) return;
    if (!isQueued(asset)) {
      setDeleteQueue((q) => [...q, asset]);
    }
    setIndex((i) => i + 1);
  }, [assets, index, isQueued]);

  // Remove from queue and advance (if already queued) or just advance
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
    } catch {
      // Ignore silently
    }
    setIndex((i) => i + 1);
  }, [assets, index]);

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Batch-delete all queued photos — shows one iOS system dialog
  const commitDeletions = useCallback(async () => {
    if (deleteQueue.length === 0) return;
    setCommitting(true);
    try {
      await Asset.delete(deleteQueue);
      setDeleteQueue([]);
    } catch {
      // User cancelled the system confirmation dialog
    } finally {
      setCommitting(false);
    }
  }, [deleteQueue]);

  const currentAsset = assets[index] ?? null;
  const currentUri = currentAsset ? (uriCache[currentAsset.id] ?? null) : null;
  const remaining = Math.max(0, assets.length - index);
  const done = !loading && remaining === 0;

  return {
    permission,
    requestPermission,
    currentAsset,
    currentUri,
    remaining,
    done,
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
  };
}
