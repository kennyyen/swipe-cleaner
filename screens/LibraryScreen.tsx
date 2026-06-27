import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BurstTile } from '../components/BurstTile';
import { PhotoThumbnail } from '../components/PhotoThumbnail';
import { usePhotoLibrary } from '../hooks/usePhotoLibrary';
import { useShallow } from 'zustand/react/shallow';
import type { PhotoGroup } from '../types';

const COLUMNS = 3;
const GAP = 2;
const CELL_SIZE = (Dimensions.get('window').width - GAP * (COLUMNS - 1)) / COLUMNS;

type Props = {
  onStartSwiping: () => void;
  onOpenBurst: (group: PhotoGroup) => void;
};

export function LibraryScreen({ onStartSwiping, onOpenBurst }: Props) {
  const {
    permission,
    requestPermission,
    assets,
    index: currentIndex,
    groups,
    groupsLoading,
    loading,
    loadingMore,
    deleteQueue,
    startFrom,
    assetIndexOf,
    loadMoreAssets,
  } = usePhotoLibrary(useShallow((s) => ({
    permission: s.permission,
    requestPermission: s.requestPermission,
    assets: s.assets,
    index: s.index,
    groups: s.groups,
    groupsLoading: s.groupsLoading,
    loading: s.loading,
    loadingMore: s.loadingMore,
    deleteQueue: s.deleteQueue,
    startFrom: s.startFrom,
    assetIndexOf: s.assetIndexOf,
    loadMoreAssets: s.loadMoreAssets,
  })));

  const queuedIds = new Set(deleteQueue.map((a) => a.id));

  const groupHasQueued = useCallback(
    (group: PhotoGroup) => group.assets.some((a) => queuedIds.has(a.id)),
    [queuedIds]
  );

  const handleSingleTap = useCallback(
    (group: PhotoGroup) => {
      startFrom(assetIndexOf(group.assets[0].id));
      onStartSwiping();
    },
    [startFrom, assetIndexOf, onStartSwiping]
  );

  const isGroupActive = useCallback(
    (group: PhotoGroup) => group.assets.some((a) => assetIndexOf(a.id) === currentIndex),
    [assetIndexOf, currentIndex]
  );

  if (!permission) return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Swipe Cleaner needs access to your photos.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={styles.loadingText}>Loading your library…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Library</Text>
          <Text style={styles.subtitle}>
            {assets.length} photos
            {groupsLoading
              ? ' · computing groups…'
              : ` · ${groups.filter((g) => g.isBurst).length} bursts`}
          </Text>
        </View>
        {groupsLoading && <ActivityIndicator color="#555" size="small" />}
      </View>

      {/* Start from beginning */}
      <TouchableOpacity style={styles.startBtn} onPress={() => { startFrom(0); onStartSwiping(); }}>
        <Text style={styles.startBtnText}>▶  Start from beginning</Text>
      </TouchableOpacity>

      <Text style={styles.sectionHint}>
        {groupsLoading
          ? 'Tap any photo to start · Groups computing…'
          : 'Tap single photo to start · Tap burst (✦) to preview group'}
      </Text>

      {/* Grid of groups */}
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        onEndReached={loadMoreAssets}
        onEndReachedThreshold={0.5}
        renderItem={({ item: group }) =>
          group.isBurst ? (
            <BurstTile
              assets={group.assets}
              size={CELL_SIZE}
              onPress={() => onOpenBurst(group)}
              hasQueued={groupHasQueued(group)}
            />
          ) : (
            <PhotoThumbnail
              asset={group.assets[0]}
              size={CELL_SIZE}
              onPress={() => handleSingleTap(group)}
              isQueued={queuedIds.has(group.assets[0].id)}
              isActive={isGroupActive(group)}
              dimmed={assetIndexOf(group.assets[0].id) < currentIndex && !queuedIds.has(group.assets[0].id)}
            />
          )
        }
        getItemLayout={(_, index) => ({
          length: CELL_SIZE + GAP,
          offset: (CELL_SIZE + GAP) * Math.floor(index / COLUMNS),
          index,
        })}
        contentContainerStyle={styles.grid}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color="#555" size="small" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  center: {
    flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#666', fontSize: 13, marginTop: 2 },
  startBtn: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#4488ff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionHint: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  row: { gap: GAP },
  grid: { paddingBottom: 24 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  permText: { color: '#fff', fontSize: 18, textAlign: 'center', marginBottom: 28, lineHeight: 26 },
  btn: { backgroundColor: '#4488ff', paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingText: { color: '#666', fontSize: 15, marginTop: 16 },
});
