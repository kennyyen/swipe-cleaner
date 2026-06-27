import React from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhotoCard } from '../components/PhotoCard';
import { usePhotoLibrary } from '../hooks/usePhotoLibrary';
import { useShallow } from 'zustand/react/shallow';
import type { AppSettings, SwipeAction } from '../types';

type Props = {
  settings: AppSettings;
  onOpenSettings: () => void;
  onOpenLibrary: () => void;
  onOpenDeleteQueue: () => void;
};

function actionLabel(action: SwipeAction): string {
  if (action.type === 'delete') return 'Delete';
  if (action.type === 'keep') return 'Keep';
  return action.albumName;
}

function actionColor(action: SwipeAction): string {
  if (action.type === 'delete') return '#ff4444';
  if (action.type === 'keep') return '#44cc44';
  return '#4488ff';
}

export function SwipeScreen({ settings, onOpenSettings, onOpenLibrary, onOpenDeleteQueue }: Props) {
  const {
    permission,
    requestPermission,
    currentAsset,
    currentUri,
    currentCreationTime,
    currentMediaType,
    remaining,
    done,
    loading,
    canGoBack,
    deleteQueue,
    committing,
    isCurrentQueued,
    isRandomMode,
    toggleRandomMode,
    queueDelete,
    clearDeleteQueue,
    keep,
    moveToAlbum,
    goBack,
    commitDeletions,
  } = usePhotoLibrary(useShallow((s) => ({
    permission: s.permission,
    requestPermission: s.requestPermission,
    currentAsset: s.currentAsset,
    currentUri: s.currentUri,
    currentCreationTime: s.currentCreationTime,
    currentMediaType: s.currentMediaType,
    remaining: s.remaining,
    done: s.done,
    loading: s.loading,
    canGoBack: s.canGoBack,
    deleteQueue: s.deleteQueue,
    committing: s.committing,
    isCurrentQueued: s.isCurrentQueued,
    isRandomMode: s.isRandomMode,
    toggleRandomMode: s.toggleRandomMode,
    queueDelete: s.queueDelete,
    clearDeleteQueue: s.clearDeleteQueue,
    keep: s.keep,
    moveToAlbum: s.moveToAlbum,
    goBack: s.goBack,
    commitDeletions: s.commitDeletions,
  })));

  const handleGoHome = () => {
    if (deleteQueue.length === 0) {
      onOpenLibrary();
      return;
    }
    Alert.alert(
      'Go back to library?',
      `You have ${deleteQueue.length} photo${deleteQueue.length === 1 ? '' : 's'} queued for deletion.`,
      [
        { text: 'Keep queue & go home', onPress: onOpenLibrary },
        {
          text: 'Discard queue & go home',
          style: 'destructive',
          onPress: () => { clearDeleteQueue(); onOpenLibrary(); },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const executeAction = (action: SwipeAction) => {
    if (action.type === 'delete') queueDelete();
    else if (action.type === 'album') moveToAlbum(action.albumId);
    else keep();
  };

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
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

  if (done) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>All done!</Text>
        <Text style={styles.doneSub}>
          {deleteQueue.length > 0
            ? `${deleteQueue.length} photo${deleteQueue.length === 1 ? '' : 's'} queued for deletion.`
            : 'Your photo library is clean.'}
        </Text>
        {deleteQueue.length > 0 && (
          <TouchableOpacity
            style={[styles.btn, styles.deleteBtn, committing && styles.btnDisabled]}
            onPress={commitDeletions}
            disabled={committing}
          >
            {committing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Delete {deleteQueue.length} photos</Text>}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!currentAsset || !currentUri) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleGoHome} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.headerIcon}>⊞</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleRandomMode} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.headerIcon, isRandomMode && styles.headerIconActive]}>🔀</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.counter}>{remaining} left</Text>

        <View style={styles.headerRight}>
          {deleteQueue.length > 0 && (
            <TouchableOpacity
              onPress={onOpenDeleteQueue}
              style={styles.deleteChip}
            >
              {committing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.deleteChipText}>🗑 {deleteQueue.length}</Text>}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onOpenSettings} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.headerIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Swipe hints */}
      <View style={styles.hints}>
        <Text style={[styles.hint, { color: actionColor(settings.leftAction) }]}>
          ← {actionLabel(settings.leftAction)}
        </Text>
        <Text style={[styles.hint, { color: actionColor(settings.rightAction) }]}>
          {actionLabel(settings.rightAction)} →
        </Text>
      </View>

      {/* Card area */}
      <View style={styles.cardArea}>
        {isCurrentQueued && (
          <View style={styles.queuedBadge}>
            <Text style={styles.queuedText}>Queued for deletion</Text>
          </View>
        )}
        <PhotoCard
          key={currentAsset.id}
          uri={currentUri}
          creationTime={currentCreationTime}
          mediaType={currentMediaType}
          leftAction={settings.leftAction}
          rightAction={settings.rightAction}
          onSwipeLeft={() => executeAction(settings.leftAction)}
          onSwipeRight={() => executeAction(settings.rightAction)}
        />
      </View>

      {/* Navigation controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
          onPress={goBack}
          disabled={!canGoBack}
        >
          <Text style={styles.navBtnText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => executeAction(settings.rightAction)}
        >
          <Text style={[styles.navBtnText, { color: actionColor(settings.rightAction) }]}>
            {actionLabel(settings.rightAction)} →
          </Text>
        </TouchableOpacity>
      </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { fontSize: 22 },
  headerIconActive: { opacity: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counter: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteChip: {
    backgroundColor: '#ff4444',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 58,
    alignItems: 'center',
  },
  deleteChipText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  hint: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  queuedBadge: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  queuedText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  navBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1c1c1c',
    minWidth: 110,
    alignItems: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
    marginTop: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  deleteBtn: { backgroundColor: '#ff4444' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingText: { color: '#666', fontSize: 15, marginTop: 16 },
  doneTitle: { color: '#fff', fontSize: 34, fontWeight: '700', marginBottom: 10 },
  doneSub: { color: '#666', fontSize: 16, textAlign: 'center' },
});
