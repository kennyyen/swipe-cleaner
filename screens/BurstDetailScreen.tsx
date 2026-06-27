import type { Asset } from 'expo-media-library';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlatList, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { usePhotoLibrary } from '../hooks/usePhotoLibrary';
import { useShallow } from 'zustand/react/shallow';
import type { PhotoGroup } from '../types';

const COLUMNS = 3;
const GAP = 2;
const CELL_SIZE = (Dimensions.get('window').width - GAP * (COLUMNS - 1)) / COLUMNS;
const SWIPE_THRESHOLD = -38;

type Props = {
  group: PhotoGroup;
  onClose: () => void;
  onStartSwiping: () => void;
};

function formatTs(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

type CellProps = {
  asset: Asset;
  size: number;
  isQueued: boolean;
  onToggle: () => void;
};

function BurstPhotoCell({ asset, size, isQueued, onToggle }: CellProps) {
  const { getUri } = usePhotoLibrary((s) => ({ getUri: s.getUri }));
  const [uri, setUri] = useState<string | null>(null);
  const translateY = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    getUri(asset).then((u) => { if (!cancelled) setUri(u); });
    return () => { cancelled = true; };
  }, [asset.id]);

  const pan = Gesture.Pan()
    .activeOffsetY([-12, Number.MAX_SAFE_INTEGER])  // only activate on upward drag
    .failOffsetY([Number.MIN_SAFE_INTEGER, 8])      // fail if dragged down first
    .onUpdate((e) => {
      if (e.translationY < 0) {
        translateY.value = e.translationY * 0.35;
      }
    })
    .onEnd((e) => {
      if (e.translationY < SWIPE_THRESHOLD) {
        runOnJS(onToggle)();
      }
      translateY.value = withSpring(0, { damping: 18 });
    })
    .onFinalize(() => {
      translateY.value = withSpring(0, { damping: 18 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ width: size, height: size, overflow: 'hidden', backgroundColor: '#222' }, animStyle]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a1a' }]} />
        )}

        {/* Queued overlay */}
        {isQueued && (
          <View style={[StyleSheet.absoluteFill, styles.queuedOverlay]}>
            <Text style={styles.queuedIcon}>🗑</Text>
          </View>
        )}

        {/* Swipe hint arrow */}
        {!isQueued && (
          <View style={styles.hintArrow}>
            <Text style={styles.hintArrowText}>↑</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

export function BurstDetailScreen({ group, onClose, onStartSwiping }: Props) {
  const { queueAssets, removeFromQueue, deleteQueue, assetIndexOf, startFrom } = usePhotoLibrary(
    useShallow((s) => ({
      queueAssets: s.queueAssets,
      removeFromQueue: s.removeFromQueue,
      deleteQueue: s.deleteQueue,
      assetIndexOf: s.assetIndexOf,
      startFrom: s.startFrom,
    }))
  );

  const [firstTs, setFirstTs] = useState<number | null>(null);

  useEffect(() => {
    group.assets[0].getCreationTime().then(setFirstTs);
  }, [group.assets[0].id]);

  const isInQueue = useCallback(
    (asset: Asset) => deleteQueue.some((a) => a.id === asset.id),
    [deleteQueue]
  );

  const toggleQueue = useCallback((asset: Asset) => {
    if (isInQueue(asset)) {
      removeFromQueue(asset.id);
    } else {
      queueAssets([asset]);
    }
  }, [isInQueue, removeFromQueue, queueAssets]);

  const queueAll = () => queueAssets(group.assets);
  const dequeueAll = () => group.assets.forEach((a) => removeFromQueue(a.id));

  const queuedCount = group.assets.filter(isInQueue).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Burst · {group.assets.length} photos</Text>
          {firstTs != null && (
            <Text style={styles.subtitle}>{formatTs(firstTs)}</Text>
          )}
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarCount}>
          {queuedCount > 0
            ? `${queuedCount} queued for deletion`
            : 'Swipe ↑ on a photo to queue it'}
        </Text>
        <View style={styles.toolbarBtns}>
          <TouchableOpacity onPress={queueAll}>
            <Text style={styles.toolbarBtn}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={dequeueAll}>
            <Text style={[styles.toolbarBtn, { color: '#888' }]}>None</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid */}
      <FlatList
        data={group.assets}
        keyExtractor={(a) => a.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <BurstPhotoCell
            asset={item}
            size={CELL_SIZE}
            isQueued={isInQueue(item)}
            onToggle={() => toggleQueue(item)}
          />
        )}
        ListFooterComponent={
          <View style={styles.swipeSection}>
            <Text style={styles.swipeSectionTitle}>Start swiping from this burst</Text>
            <View style={styles.swipeRow}>
              {group.assets.map((asset) => (
                <TouchableOpacity
                  key={asset.id}
                  onPress={() => { startFrom(assetIndexOf(asset.id)); onStartSwiping(); }}
                  style={[styles.swipeThumb, { width: CELL_SIZE, height: CELL_SIZE }]}
                >
                  <SwipeThumb asset={asset} />
                  <Text style={styles.swipeThumbLabel}>▶</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function SwipeThumb({ asset }: { asset: Asset }) {
  const { getUri } = usePhotoLibrary((s) => ({ getUri: s.getUri }));
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getUri(asset).then((u) => { if (!cancelled) setUri(u); });
    return () => { cancelled = true; };
  }, [asset.id]);
  return uri ? (
    <Image source={{ uri }} style={[StyleSheet.absoluteFill, { opacity: 0.65 }]} resizeMode="cover" />
  ) : null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  back: { color: '#888', fontSize: 16, width: 60 },
  headerCenter: { alignItems: 'center', flex: 1 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#555', fontSize: 12, marginTop: 2 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toolbarCount: { color: '#aaa', fontSize: 13, flex: 1 },
  toolbarBtns: { flexDirection: 'row', gap: 16 },
  toolbarBtn: { color: '#4488ff', fontSize: 15, fontWeight: '600' },
  row: { gap: GAP },
  grid: { paddingBottom: 24 },
  queuedOverlay: {
    backgroundColor: 'rgba(255,68,68,0.45)',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 6,
  },
  queuedIcon: { fontSize: 18 },
  hintArrow: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintArrowText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '700' },
  swipeSection: {
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222',
    marginTop: 12,
    paddingHorizontal: GAP,
  },
  swipeSectionTitle: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  swipeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  swipeThumb: {
    overflow: 'hidden',
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeThumbLabel: {
    color: '#fff',
    fontSize: 22,
  },
});
