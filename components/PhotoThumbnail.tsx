import type { Asset } from 'expo-media-library';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePhotoLibrary } from '../hooks/usePhotoLibrary';

type Props = {
  asset: Asset;
  size: number;
  onPress?: () => void;
  isQueued?: boolean;
  isActive?: boolean;
  dimmed?: boolean;
  /** When provided, renders a check/uncheck badge in the top-right corner */
  checked?: boolean;
};

export function PhotoThumbnail({ asset, size, onPress, isQueued, isActive, dimmed, checked }: Props) {
  const getUri = usePhotoLibrary((s) => s.getUri);
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

      {/* Check / uncheck badge (top-right corner) */}
      {checked !== undefined && (
        <View style={[styles.checkBadge, checked ? styles.checkBadgeOn : styles.checkBadgeOff]}>
          <Text style={styles.checkIcon}>{checked ? '✓' : ''}</Text>
        </View>
      )}
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
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  checkBadgeOn: {
    backgroundColor: '#44cc44',
    borderColor: '#44cc44',
  },
  checkBadgeOff: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderColor: '#fff',
  },
  checkIcon: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
});
