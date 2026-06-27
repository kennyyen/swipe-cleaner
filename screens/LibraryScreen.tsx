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
  onStartSwiping: () => void;
};

export function LibraryScreen({ onStartSwiping }: Props) {
  const {
    permission,
    requestPermission,
    assets,
    index: currentIndex,
    deleteQueue,
    loading,
    startFrom,
  } = usePhotoLibrary();

  const handleTap = useCallback(
    (assetIndex: number) => {
      startFrom(assetIndex);
      onStartSwiping();
    },
    [startFrom, onStartSwiping]
  );

  const isQueued = useCallback(
    (assetId: string) => deleteQueue.some((a) => a.id === assetId),
    [deleteQueue]
  );

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

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
        <Text style={styles.title}>Your Library</Text>
        <Text style={styles.subtitle}>{assets.length} photos</Text>
      </View>

      {/* Start from beginning shortcut */}
      <TouchableOpacity style={styles.startBtn} onPress={() => handleTap(0)}>
        <Text style={styles.startBtnText}>▶  Start from beginning</Text>
      </TouchableOpacity>

      <Text style={styles.sectionHint}>Or tap any photo to start from there</Text>

      {/* Grid */}
      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        renderItem={({ item, index }) => (
          <PhotoThumbnail
            asset={item}
            size={CELL_SIZE}
            onPress={() => handleTap(index)}
            isQueued={isQueued(item.id)}
            isActive={index === currentIndex}
            dimmed={index < currentIndex && !isQueued(item.id)}
          />
        )}
        getItemLayout={(_, index) => ({
          length: CELL_SIZE + GAP,
          offset: (CELL_SIZE + GAP) * Math.floor(index / COLUMNS),
          index,
        })}
        initialScrollIndex={Math.max(0, currentIndex - COLUMNS * 2)}
        contentContainerStyle={styles.grid}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  center: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#666', fontSize: 14, marginTop: 2 },
  startBtn: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#4488ff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionHint: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  row: { gap: GAP },
  grid: { paddingBottom: 24 },
  permText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 26,
  },
  btn: {
    backgroundColor: '#4488ff',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingText: { color: '#666', fontSize: 15, marginTop: 16 },
});
