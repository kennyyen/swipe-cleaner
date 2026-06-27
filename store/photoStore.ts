import {
  Album,
  Asset,
  AssetField,
  getPermissionsAsync,
  MediaType,
  Query,
  requestPermissionsAsync,
} from 'expo-media-library';
import type { PermissionResponse } from 'expo';
import { create } from 'zustand';
import type { PhotoGroup } from '../types';

const PAGE_SIZE = 200;
const LOAD_MORE_THRESHOLD = 40;
const URI_PRELOAD_AHEAD = 3;

// Module-level non-reactive cache (no re-renders needed)
const uriCache: Record<string, string> = {};
const pageOffsetRef = { current: 0 };
const isRandomModeRef = { current: false };
let resolveVersion = 0; // incremented on each asset change to discard stale async results

function fisherYatesShuffle(arr: number[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function computeGroups(
  assets: Asset[],
  creationTimes: Record<string, number>,
  thresholdSecs: number
): PhotoGroup[] {
  if (assets.length === 0) return [];
  const thresholdMs = thresholdSecs * 1000;
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
}

export type PhotoStore = {
  // Permission
  permission: PermissionResponse | null;
  initPermissions: () => Promise<void>;
  requestPermission: () => Promise<void>;

  // Assets
  assets: Asset[];
  index: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;

  // Random mode
  isRandomMode: boolean;
  shuffledOrder: number[];
  toggleRandomMode: () => void;

  // Current asset (async-resolved)
  currentUri: string | null;
  currentCreationTime: number | null;
  currentMediaType: MediaType | null;

  // Burst grouping
  groups: PhotoGroup[];
  groupsLoading: boolean;
  groupingThresholdSecs: number;
  setGroupingThresholdSecs: (n: number) => void;

  // Lookup map
  assetIndexMap: Record<string, number>;
  assetIndexOf: (assetId: string) => number;

  // Delete queue
  deleteQueue: Asset[];
  committing: boolean;

  // Derived state (updated via _sync on every index/assets/queue change)
  currentAsset: Asset | null;
  remaining: number;
  done: boolean;
  canGoBack: boolean;
  isCurrentQueued: boolean;

  // Actions
  loadFirstPage: () => Promise<void>;
  loadMoreAssets: () => void;
  resolveCurrentAsset: () => void;
  startFrom: (index: number) => void;
  goBack: () => void;
  queueDelete: () => void;
  keep: () => void;
  moveToAlbum: (albumId: string) => Promise<void>;
  queueAssets: (assets: Asset[]) => void;
  clearDeleteQueue: () => void;
  removeFromQueue: (assetId: string) => void;
  commitDeletions: () => Promise<void>;
  commitSpecificDeletions: (assets: Asset[]) => Promise<void>;
  getUri: (asset: Asset) => Promise<string>;

  // Private helpers (prefixed _ to signal internal use)
  _effectiveIndex: () => number;
  _sync: () => void;
  _recomputeGroups: () => void;
  _fetchCreationTimesForPage: (newAssets: Asset[], isLastPage: boolean) => void;
};

export const usePhotoStore = create<PhotoStore>()((set, get) => ({
  // ─── Permission ──────────────────────────────────────────────────────────
  permission: null,

  initPermissions: async () => {
    const p = await getPermissionsAsync();
    set({ permission: p });
    if (p.granted) get().loadFirstPage();
  },

  requestPermission: async () => {
    const p = await requestPermissionsAsync();
    set({ permission: p });
    if (p.granted) get().loadFirstPage();
  },

  // ─── Assets & pagination ─────────────────────────────────────────────────
  assets: [],
  index: 0,
  loading: true,
  loadingMore: false,
  hasMore: true,

  loadFirstPage: async () => {
    set({ loading: true, groupsLoading: true });
    pageOffsetRef.current = 0;
    const results = await new Query()
      .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
      .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
      .limit(PAGE_SIZE)
      .exe();
    const isLast = results.length < PAGE_SIZE;
    const indexMap: Record<string, number> = {};
    results.forEach((a, i) => { indexMap[a.id] = i; });
    set({
      assets: results,
      loading: false,
      hasMore: !isLast,
      assetIndexMap: indexMap,
    });
    pageOffsetRef.current = results.length;
    get()._sync();
    get().resolveCurrentAsset();
    get()._fetchCreationTimesForPage(results, isLast);
  },

  loadMoreAssets: () => {
    const { loadingMore, hasMore } = get();
    if (loadingMore || !hasMore) return;
    set({ loadingMore: true });
    const capturedOffset = pageOffsetRef.current;
    new Query()
      .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
      .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
      .limit(PAGE_SIZE)
      .offset(capturedOffset)
      .exe()
      .then((results) => {
        if (results.length === 0) {
          set({ hasMore: false, loadingMore: false, groupsLoading: false });
          get()._sync();
          return;
        }
        pageOffsetRef.current += results.length;
        const isLast = results.length < PAGE_SIZE;
        set((state) => {
          const newAssets = [...state.assets, ...results];
          const indexMap = { ...state.assetIndexMap };
          results.forEach((a, i) => { indexMap[a.id] = capturedOffset + i; });
          return { assets: newAssets, assetIndexMap: indexMap, hasMore: !isLast, loadingMore: false };
        });
        get()._sync();
        get()._fetchCreationTimesForPage(results, isLast);
        // Extend shuffle order if random mode is on
        if (isRandomModeRef.current) {
          const newIndices = Array.from({ length: results.length }, (_, i) => i + capturedOffset);
          fisherYatesShuffle(newIndices);
          set((state) => ({ shuffledOrder: [...state.shuffledOrder, ...newIndices] }));
        }
      });
  },

  // ─── Random mode ─────────────────────────────────────────────────────────
  isRandomMode: false,
  shuffledOrder: [],

  toggleRandomMode: () => {
    const { isRandomMode, index, assets, shuffledOrder } = get();
    if (!isRandomMode) {
      const played = Array.from({ length: index }, (_, i) => i);
      const remaining = Array.from({ length: assets.length - index }, (_, i) => i + index);
      fisherYatesShuffle(remaining);
      set({ isRandomMode: true, shuffledOrder: [...played, ...remaining] });
      isRandomModeRef.current = true;
    } else {
      const realIdx = shuffledOrder[index] ?? index;
      set({ isRandomMode: false, index: realIdx });
      isRandomModeRef.current = false;
    }
    get().resolveCurrentAsset();
  },

  // ─── Current asset resolution ─────────────────────────────────────────────
  currentUri: null,
  currentCreationTime: null,
  currentMediaType: null,

  resolveCurrentAsset: () => {
    const s = get();
    const eff = s._effectiveIndex();
    const current = s.assets[eff];
    resolveVersion++;
    const captured = resolveVersion;
    if (!current) {
      set({ currentUri: null, currentCreationTime: null, currentMediaType: null });
      return;
    }
    s.getUri(current).then((uri) => { if (resolveVersion === captured) set({ currentUri: uri }); });
    current.getCreationTime().then((t) => { if (resolveVersion === captured) set({ currentCreationTime: t }); });
    current.getMediaType().then((t) => { if (resolveVersion === captured) set({ currentMediaType: t }); });
    // Preload upcoming URIs
    for (let i = 1; i <= URI_PRELOAD_AHEAD; i++) {
      const nextEff = s.isRandomMode ? (s.shuffledOrder[s.index + i] ?? s.index + i) : s.index + i;
      const next = s.assets[nextEff];
      if (next) s.getUri(next);
    }
    // Trigger next page load when near end
    const { assets, index, hasMore, loadingMore } = get();
    if (assets.length - index <= LOAD_MORE_THRESHOLD && hasMore && !loadingMore) {
      get().loadMoreAssets();
    }
  },

  // ─── Burst grouping ───────────────────────────────────────────────────────
  groups: [],
  groupsLoading: false,
  groupingThresholdSecs: 5,

  setGroupingThresholdSecs: (n) => {
    set({ groupingThresholdSecs: n });
    get()._recomputeGroups();
  },

  _recomputeGroups: () => {
    const { assets, creationTimes, groupingThresholdSecs } = get();
    set({ groups: computeGroups(assets, creationTimes, groupingThresholdSecs) });
  },

  _fetchCreationTimesForPage: (newAssets, isLastPage) => {
    Promise.all(newAssets.map(async (a) => ({ id: a.id, time: await a.getCreationTime() })))
      .then((results) => {
        set((state) => {
          const next = { ...state.creationTimes };
          results.forEach(({ id, time }) => { if (time !== null) next[id] = time; });
          return { creationTimes: next, ...(isLastPage ? { groupsLoading: false } : {}) };
        });
        get()._recomputeGroups();
      });
  },

  // ─── Lookup ───────────────────────────────────────────────────────────────
  assetIndexMap: {},
  assetIndexOf: (assetId) => get().assetIndexMap[assetId] ?? 0,

  // ─── Delete queue ────────────────────────────────────────────────────────
  deleteQueue: [],
  committing: false,

  queueAssets: (toQueue) => {
    set((state) => {
      const existingIds = new Set(state.deleteQueue.map((a) => a.id));
      const newOnes = toQueue.filter((a) => !existingIds.has(a.id));
      return { deleteQueue: [...state.deleteQueue, ...newOnes] };
    });
    get()._sync();
  },

  clearDeleteQueue: () => { set({ deleteQueue: [] }); get()._sync(); },

  removeFromQueue: (assetId) => {
    set((state) => ({ deleteQueue: state.deleteQueue.filter((a) => a.id !== assetId) }));
    get()._sync();
  },

  commitDeletions: async () => {
    const { deleteQueue } = get();
    if (deleteQueue.length === 0) return;
    set({ committing: true });
    try { await Asset.delete(deleteQueue); set({ deleteQueue: [] }); } catch {}
    set({ committing: false });
    get()._sync();
  },

  commitSpecificDeletions: async (toDelete) => {
    if (toDelete.length === 0) return;
    set({ committing: true });
    try {
      await Asset.delete(toDelete);
      const deletedIds = new Set(toDelete.map((a) => a.id));
      set((state) => ({ deleteQueue: state.deleteQueue.filter((a) => !deletedIds.has(a.id)) }));
    } catch {}
    set({ committing: false });
    get()._sync();
  },

  // ─── Navigation ───────────────────────────────────────────────────────────
  startFrom: (newIndex) => {
    const { assets } = get();
    set({ index: Math.max(0, Math.min(newIndex, assets.length - 1)), isRandomMode: false });
    isRandomModeRef.current = false;
    get()._sync();
    get().resolveCurrentAsset();
  },

  goBack: () => {
    set((state) => ({ index: Math.max(0, state.index - 1) }));
    get()._sync();
    get().resolveCurrentAsset();
  },

  // ─── Swipe actions ────────────────────────────────────────────────────────
  queueDelete: () => {
    const s = get();
    const asset = s.assets[s._effectiveIndex()];
    if (!asset) return;
    const alreadyQueued = s.deleteQueue.some((a) => a.id === asset.id);
    set((state) => ({
      index: state.index + 1,
      deleteQueue: alreadyQueued ? state.deleteQueue : [...state.deleteQueue, asset],
    }));
    get()._sync();
    get().resolveCurrentAsset();
  },

  keep: () => {
    const s = get();
    const asset = s.assets[s._effectiveIndex()];
    set((state) => ({
      index: state.index + 1,
      deleteQueue: asset ? state.deleteQueue.filter((a) => a.id !== asset.id) : state.deleteQueue,
    }));
    get()._sync();
    get().resolveCurrentAsset();
  },

  moveToAlbum: async (albumId) => {
    const s = get();
    const asset = s.assets[s._effectiveIndex()];
    if (asset) try { await new Album(albumId).add(asset); } catch {}
    set((state) => ({ index: state.index + 1 }));
    get()._sync();
    get().resolveCurrentAsset();
  },

  // ─── URI cache ────────────────────────────────────────────────────────────
  getUri: async (asset) => {
    if (uriCache[asset.id]) return uriCache[asset.id];
    const uri = await asset.getUri();
    uriCache[asset.id] = uri;
    return uri;
  },

  // ─── Derived state ────────────────────────────────────────────────────────
  currentAsset: null,
  remaining: 0,
  done: false,
  canGoBack: false,
  isCurrentQueued: false,

  creationTimes: {},

  _effectiveIndex: () => {
    const { index, isRandomMode, shuffledOrder } = get();
    return isRandomMode ? (shuffledOrder[index] ?? index) : index;
  },

  _sync: () => {
    const s = get();
    const eff = s._effectiveIndex();
    const currentAsset = s.assets[eff] ?? null;
    const remaining = Math.max(0, s.assets.length - s.index);
    set({
      currentAsset,
      remaining,
      done: !s.loading && !s.hasMore && remaining === 0,
      canGoBack: s.index > 0,
      isCurrentQueued: currentAsset ? s.deleteQueue.some((a) => a.id === currentAsset.id) : false,
    });
  },
}));

export const usePhotoLibrary = usePhotoStore;
