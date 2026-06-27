import React from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PhotoCard } from '../components/PhotoCard';
import { usePhotoLibrary } from '../hooks/usePhotoLibrary';
import type { AppSettings, SwipeAction } from '../types';

type Props = {
  settings: AppSettings;
  onOpenSettings: () => void;
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

export function SwipeScreen({ settings, onOpenSettings }: Props) {
  const { permission, requestPermission, current, remaining, done, keep, deleteCurrent, moveToAlbum } =
    usePhotoLibrary();

  const executeAction = async (action: SwipeAction) => {
    if (action.type === 'delete') await deleteCurrent();
    else if (action.type === 'album') await moveToAlbum(action.albumId);
    else await keep();
  };

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

  if (done || !current) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>All done!</Text>
        <Text style={styles.doneSub}>Your photo library is clean.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.counter}>{remaining} photos left</Text>
        <TouchableOpacity onPress={onOpenSettings} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.gear}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hints}>
        <Text style={[styles.hint, { color: actionColor(settings.leftAction) }]}>
          ← {actionLabel(settings.leftAction)}
        </Text>
        <Text style={[styles.hint, { color: actionColor(settings.rightAction) }]}>
          {actionLabel(settings.rightAction)} →
        </Text>
      </View>

      <View style={styles.cardArea}>
        <PhotoCard
          key={current.id}
          uri={current.uri}
          leftAction={settings.leftAction}
          rightAction={settings.rightAction}
          onSwipeLeft={() => executeAction(settings.leftAction)}
          onSwipeRight={() => executeAction(settings.rightAction)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
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
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  counter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  gear: {
    fontSize: 22,
  },
  hints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  doneTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 10,
  },
  doneSub: {
    color: '#666',
    fontSize: 16,
  },
});
