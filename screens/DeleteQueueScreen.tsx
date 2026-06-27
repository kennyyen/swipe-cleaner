import type { Asset } from 'expo-media-library';
import React, { useCallback, useMemo, useState } from 'react';
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

const COLUMNS = 3;
const GAP = 2;
const CELL_SIZE = (Dimensions.get('window').width - GAP * (COLUMNS - 1)) / COLUMNS;

type Props = {
  onClose: () => void;
};

export function DeleteQueueScreen({ onClose }: Props) {
  const { deleteQueue, commitSpecificDeletions, committing } = usePhotoLibrary();

  // Track which IDs are checked (selected for deletion). All start checked.
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());

  const toggle = useCallback((assetId: string) => {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId); // re-check
      } else {
        next.add(assetId);   // uncheck
      }
      return next;
    });
  }, []);

  const checkedAssets = useMemo(
    () => deleteQueue.filter((a) => !unchecked.has(a.id)),
    [deleteQueue, unchecked]
  );

  const handleDelete = useCallback(async () => {
    await commitSpecificDeletions(checkedAssets);
    // Clear unchecked state for any items that were removed from the queue
    const remainingIds = new Set(deleteQueue.map((a) => a.id));
    setUnchecked((prev) => new Set([...prev].filter((id) => remainingIds.has(id))));
  }, [checkedAssets, commitSpecificDeletions, deleteQueue]);

  const selectAll = () => setUnchecked(new Set());
  const deselectAll = () => setUnchecked(new Set(deleteQueue.map((a) => a.id)));

  if (deleteQueue.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onClose={onClose} />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Queue is empty</Text>
          <Text style={styles.emptySub}>Swipe left on photos to queue them for deletion.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header onClose={onClose} />

      {/* Select-all / deselect-all row */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarCount}>
          {checkedAssets.length} of {deleteQueue.length} selected
        </Text>
        <View style={styles.toolbarActions}>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.toolbarBtn}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={deselectAll}>
            <Text style={styles.toolbarBtn}>None</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.hint}>Tap a photo to toggle selection</Text>

      {/* Grid */}
      <FlatList
        data={deleteQueue}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        renderItem={({ item }) => (
          <PhotoThumbnail
            asset={item}
            size={CELL_SIZE}
            onPress={() => toggle(item.id)}
            isQueued={!unchecked.has(item.id)}
            checked={!unchecked.has(item.id)}
            dimmed={unchecked.has(item.id)}
          />
        )}
        contentContainerStyle={styles.grid}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.deleteBtn,
            (checkedAssets.length === 0 || committing) && styles.deleteBtnDisabled,
          ]}
          onPress={handleDelete}
          disabled={checkedAssets.length === 0 || committing}
        >
          {committing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteBtnText}>
              {checkedAssets.length === 0
                ? 'Select photos to delete'
                : `Delete ${checkedAssets.length} photo${checkedAssets.length === 1 ? '' : 's'}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Delete Queue</Text>
      <View style={{ width: 60 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  back: { color: '#888', fontSize: 16, width: 60 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toolbarCount: { color: '#aaa', fontSize: 14 },
  toolbarActions: { flexDirection: 'row', gap: 16 },
  toolbarBtn: { color: '#4488ff', fontSize: 15, fontWeight: '600' },
  hint: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  row: { gap: GAP },
  grid: { paddingBottom: 120 },
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
  deleteBtn: {
    backgroundColor: '#ff4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 10 },
  emptySub: { color: '#555', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
