import { useCallback, useEffect, useState } from 'react';
import { Album, Asset, AssetField, MediaType, Query, usePermissions } from 'expo-media-library';

export function usePhotoLibrary() {
  const [permission, requestPermission] = usePermissions();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [index, setIndex] = useState(0);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load all photo assets once permissions are granted
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

  // Resolve URI for the current asset whenever index or assets change
  useEffect(() => {
    const asset = assets[index];
    if (!asset) {
      setCurrentUri(null);
      return;
    }
    asset.getUri().then(setCurrentUri);
  }, [assets, index]);

  const keep = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const deleteCurrent = useCallback(async () => {
    const asset = assets[index];
    if (!asset) return;
    try {
      await asset.delete();
    } catch {
      // User cancelled iOS system confirmation dialog
    }
    // Remove deleted asset from local list; index stays, pointing at next asset
    setAssets((prev) => prev.filter((_, i) => i !== index));
  }, [assets, index]);

  const moveToAlbum = useCallback(async (albumId: string) => {
    const asset = assets[index];
    if (!asset) return;
    try {
      const album = new Album(albumId);
      await album.add(asset);
    } catch {
      // Ignore album errors silently
    }
    setIndex((i) => i + 1);
  }, [assets, index]);

  const remaining = Math.max(0, assets.length - index);

  return {
    permission,
    requestPermission,
    current: assets[index] ?? null,
    currentUri,
    remaining,
    done: !loading && remaining === 0,
    loading,
    keep,
    deleteCurrent,
    moveToAlbum,
  };
}
