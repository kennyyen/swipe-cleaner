import type { Asset } from 'expo-media-library';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePhotoLibrary } from '../context/PhotoLibraryContext';

type Props = {
  assets: Asset[];
  size: number;
  onPress: () => void;
  hasQueued?: boolean;
};

export function BurstTile({ assets, size, onPress, hasQueued }: Props) {
  const { getUri } = usePhotoLibrary();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUri(assets[0]).then((u) => { if (!cancelled) setUri(u); });
    return () => { cancelled = true; };
  }, [assets[0].id]);

  const count = assets.length;

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Stack peek strips behind the main tile */}
      {count > 2 && (
        <View style={[styles.strip, { width: size - 10, left: 5, top: 0, opacity: 0.5 }]} />
      )}
      {count > 1 && (
        <View style={[styles.strip, { width: size - 5, left: 2.5, top: 3, opacity: 0.75 }]} />
      )}

      {/* Main photo */}
      <View style={[styles.mainPhoto, { top: count > 1 ? 6 : 0, borderRadius: 6 }]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
        )}

        {/* Queued indicator */}
        {hasQueued && <View style={[StyleSheet.absoluteFill, styles.queuedOverlay]} />}

        {/* Burst count badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✦ {count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  strip: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#333',
    borderRadius: 6,
  },
  mainPhoto: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  placeholder: {
    backgroundColor: '#1a1a1a',
  },
  queuedOverlay: {
    backgroundColor: 'rgba(255,68,68,0.4)',
  },
  badge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
