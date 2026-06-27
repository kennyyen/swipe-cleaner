import type { Asset } from 'expo-media-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PhotoThumbnail } from '../components/PhotoThumbnail';
import { usePhotoLibrary } from '../context/PhotoLibraryContext';
import type { PhotoGroup } from '../types';

const COLUMNS = 3;
const GAP = 2;
const CELL_SIZE = (Dimensions.get('window').width - GAP * (COLUMNS - 1)) / COLUMNS;

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

export function BurstDetailScreen({ group, onClose, onStartSwiping }: Props) {
  const { queueAssets, deleteQueue, assetIndexOf, startFrom, committing } = usePhotoLibrary();

  // All start unchecked — user selects what to queue
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [firstTs, setFirstTs] = useState<number | null>(null);

  useEffect(() => {
    group.assets[0].getCreationTime().then(setFirstTs);
  }, [group.assets[0].id]);

  const toggle = useCallback((assetId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  const selectAll = () => setSelected(new Set(group.assets.map((a) => a.id)));
  const selectNone = () => setSelected(new Set());

  const selectedAssets = useMemo(
    () => group.assets.filter((a) => selected.has(a.id)),
    [group.assets, selected]
  );

  const isInQueue = useCallback(
    (asset: Asset) => deleteQueue.some((a) => a.id === asset.id),
    [deleteQueue]
  );

  const handleQueue = () => {
    if (selectedAssets.length === 0) return;
    queueAssets(selectedAssets);
    setSelected(new Set()); // clear selection after queuing
  };

  const handleSwipeFrom = (asset: Asset) => {
    startFrom(assetIndexOf(asset.id));
    onStartSwiping();
  };

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
          {selected.size} selected
          {selected.size > 0 && ` · ${group.assets.filter((a) => isInQueue(a)).length} already queued`}
        </Text>
        <View style={styles.toolbarBtns}>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.toolbarBtn}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={selectNone}>
            <Text style={styles.toolbarBtn}>None</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.hint}>Tap to select · Long-press to start swiping from photo</Text>

      {/* Grid */}
      <FlatList
        data={group.assets}
        keyExtractor={(a) => a.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        renderItem={({ item }) => (
          <PhotoThumbnail
            asset={item}
            size={CELL_SIZE}
            onPress={() => toggle(item.id)}
            checked={selected.has(item.id)}
            isQueued={isInQueue(item)}
            dimmed={!selected.has(item.id) && !isInQueue(item)}
          />
        )}
        contentContainerStyle={styles.grid}
        ListFooterComponent={
          /* Swipe-from section at the bottom */
          <View style={styles.swipeSection}>
            <Text style={styles.swipeSectionTitle}>Start swiping from this burst</Text>
            <FlatList
              data={group.assets}
              keyExtractor={(a) => a.id}
              numColumns={COLUMNS}
              columnWrapperStyle={styles.row}
              ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <PhotoThumbnail
                  asset={item}
                  size={CELL_SIZE}
                  onPress={() => handleSwipeFrom(item)}
                  isActive={false}
                />
              )}
            />
          </View>
        }
      />

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.queueBtn,
            (selected.size === 0 || committing) && styles.queueBtnDisabled,
          ]}
          onPress={handleQueue}
          disabled={selected.size === 0 || committing}
        >
          {committing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.queueBtnText}>
              {selected.size === 0
                ? 'Select photos to queue'
                : `Queue ${selected.size} for deletion`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
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
  toolbarCount: { color: '#aaa', fontSize: 13 },
  toolbarBtns: { flexDirection: 'row', gap: 16 },
  toolbarBtn: { color: '#4488ff', fontSize: 15, fontWeight: '600' },
  hint: { color: '#444', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  row: { gap: GAP },
  grid: { paddingBottom: 140 },
  swipeSection: {
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222',
    marginTop: 16,
  },
  swipeSectionTitle: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  queueBtn: {
    backgroundColor: '#ff4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  queueBtnDisabled: { opacity: 0.4 },
  queueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
