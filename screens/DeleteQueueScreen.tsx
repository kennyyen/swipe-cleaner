import React, { useCallback } from 'react';
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
  const { deleteQueue, removeFromQueue, commitDeletions, committing } = usePhotoLibrary();

  const handleTap = useCallback(
    (assetId: string) => {
      removeFromQueue(assetId);
    },
    [removeFromQueue]
  );

  if (deleteQueue.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Delete Queue</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Queue is empty</Text>
          <Text style={styles.emptySubtitle}>Swipe left on photos to queue them for deletion.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Delete Queue</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text style={styles.hint}>Tap a photo to remove it from the queue</Text>

      {/* Grid of queued photos */}
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
            onPress={() => handleTap(item.id)}
            isQueued
          />
        )}
        contentContainerStyle={styles.grid}
      />

      {/* Commit button */}
      <View style={styles.footer}>
        <Text style={styles.footerCount}>{deleteQueue.length} photo{deleteQueue.length === 1 ? '' : 's'} selected</Text>
        <TouchableOpacity
          style={[styles.deleteBtn, committing && styles.deleteBtnDisabled]}
          onPress={commitDeletions}
          disabled={committing}
        >
          {committing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteBtnText}>Delete All {deleteQueue.length}</Text>
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
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  back: { color: '#888', fontSize: 16, width: 60 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hint: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
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
    paddingBottom: 32,
    alignItems: 'center',
    gap: 12,
  },
  footerCount: { color: '#888', fontSize: 14 },
  deleteBtn: {
    backgroundColor: '#ff4444',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 10 },
  emptySubtitle: { color: '#555', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
