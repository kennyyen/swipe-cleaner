import type { Asset } from 'expo-media-library';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePhotoLibrary } from '../context/PhotoLibraryContext';

type Props = {
  asset: Asset;
  size: number;
  onPress?: () => void;
  isQueued?: boolean;
  isActive?: boolean;
  dimmed?: boolean;
};

export function PhotoThumbnail({ asset, size, onPress, isQueued, isActive, dimmed }: Props) {
  const { getUri } = usePhotoLibrary();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUri(asset).then((u) => { if (!cancelled) setUri(u); });
    return () => { cancelled = true; };
  }, [asset.id]);

  return (
    <TouchableOpacity
      style={[styles.cell, { width: size, height: size }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}

      {/* Dimmed overlay for already-processed photos */}
      {dimmed && <View style={[StyleSheet.absoluteFill, styles.dimOverlay]} />}

      {/* Queued-for-deletion overlay */}
      {isQueued && (
        <View style={[StyleSheet.absoluteFill, styles.queuedOverlay]}>
          <Text style={styles.queuedIcon}>🗑</Text>
        </View>
      )}

      {/* Active position indicator */}
      {isActive && <View style={[StyleSheet.absoluteFill, styles.activeBorder]} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell: {
    backgroundColor: '#222',
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: '#1a1a1a',
  },
  dimOverlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  queuedOverlay: {
    backgroundColor: 'rgba(255,68,68,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queuedIcon: {
    fontSize: 22,
  },
  activeBorder: {
    borderWidth: 3,
    borderColor: '#fff',
  },
});
