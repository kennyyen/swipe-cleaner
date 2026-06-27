import { useCallback, useEffect, useRef, useState } from 'react';
import * as MediaLibrary from 'expo-media-library';

export function usePhotoLibrary() {
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [current, setCurrent] = useState<MediaLibrary.Asset | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [done, setDone] = useState(false);
  const cursorRef = useRef<string | undefined>(undefined);

  const loadAsset = useCallback(async (afterCursor?: string) => {
    return MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      first: 1,
      after: afterCursor,
      sortBy: MediaLibrary.SortBy.creationTime,
    });
  }, []);

  useEffect(() => {
    if (!permission?.granted) return;
    loadAsset().then((result) => {
      if (result.assets.length > 0) {
        setCurrent(result.assets[0]);
        cursorRef.current = result.endCursor;
        setRemaining(result.totalCount);
      } else {
        setDone(true);
      }
    });
  }, [permission?.granted, loadAsset]);

  const advanceToNext = useCallback(async () => {
    const result = await loadAsset(cursorRef.current);
    cursorRef.current = result.endCursor;
    if (result.assets.length > 0) {
      setCurrent(result.assets[0]);
    } else {
      setCurrent(null);
      setDone(true);
    }
  }, [loadAsset]);

  const keep = useCallback(async () => {
    setRemaining((r) => r - 1);
    await advanceToNext();
  }, [advanceToNext]);

  const deleteCurrent = useCallback(async () => {
    if (!current) return;
    try {
      await MediaLibrary.deleteAssetsAsync([current.id]);
    } catch {
      // User cancelled iOS system confirmation dialog
    }
    setRemaining((r) => r - 1);
    await advanceToNext();
  }, [current, advanceToNext]);

  const moveToAlbum = useCallback(async (albumId: string) => {
    if (!current) return;
    try {
      const album = await MediaLibrary.getAlbumAsync(albumId);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([current], album, false);
      }
    } catch {
      // Ignore album errors
    }
    setRemaining((r) => r - 1);
    await advanceToNext();
  }, [current, advanceToNext]);

  return {
    permission,
    requestPermission,
    current,
    remaining,
    done,
    keep,
    deleteCurrent,
    moveToAlbum,
  };
}
