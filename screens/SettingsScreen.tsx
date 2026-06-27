import * as MediaLibrary from 'expo-media-library';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AppSettings, SwipeAction } from '../types';

type Props = {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
};

type ActionType = SwipeAction['type'];

export function SettingsScreen({ settings, onSave, onClose }: Props) {
  const [left, setLeft] = useState<SwipeAction>(settings.leftAction);
  const [right, setRight] = useState<SwipeAction>(settings.rightAction);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [pickingFor, setPickingFor] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    setLoadingAlbums(true);
    MediaLibrary.getAlbumsAsync({ includeSmartAlbums: false })
      .then(setAlbums)
      .finally(() => setLoadingAlbums(false));
  }, []);

  const pickAlbum = (album: MediaLibrary.Album) => {
    const action: SwipeAction = { type: 'album', albumId: album.id, albumName: album.title };
    if (pickingFor === 'left') setLeft(action);
    else if (pickingFor === 'right') setRight(action);
    setPickingFor(null);
  };

  const save = () => {
    onSave({ leftAction: left, rightAction: right });
    onClose();
  };

  if (pickingFor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPickingFor(null)}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Album</Text>
          <View style={{ width: 60 }} />
        </View>
        {loadingAlbums ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 48 }} />
        ) : albums.length === 0 ? (
          <View style={styles.emptyAlbums}>
            <Text style={styles.emptyText}>No albums found.</Text>
          </View>
        ) : (
          <ScrollView>
            {albums.map((album) => (
              <TouchableOpacity key={album.id} style={styles.albumRow} onPress={() => pickAlbum(album)}>
                <Text style={styles.albumTitle}>{album.title}</Text>
                <Text style={styles.albumCount}>{album.assetCount} photos</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.back}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={save}>
          <Text style={styles.saveBtn}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ActionSection
          label="Swipe Left"
          color="#ff4444"
          action={left}
          onChange={(t) =>
            setLeft(t === 'album' ? { type: 'album', albumId: '', albumName: '' } : { type: t })
          }
          onPickAlbum={() => setPickingFor('left')}
        />
        <ActionSection
          label="Swipe Right"
          color="#44cc44"
          action={right}
          onChange={(t) =>
            setRight(t === 'album' ? { type: 'album', albumId: '', albumName: '' } : { type: t })
          }
          onPickAlbum={() => setPickingFor('right')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

type SectionProps = {
  label: string;
  color: string;
  action: SwipeAction;
  onChange: (type: ActionType) => void;
  onPickAlbum: () => void;
};

const ACTION_OPTIONS: { type: ActionType; label: string }[] = [
  { type: 'keep', label: 'Keep (skip)' },
  { type: 'delete', label: 'Delete' },
  { type: 'album', label: 'Move to Album' },
];

function ActionSection({ label, color, action, onChange, onPickAlbum }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
      {ACTION_OPTIONS.map((opt) => (
        <TouchableOpacity key={opt.type} style={styles.optRow} onPress={() => onChange(opt.type)}>
          <View style={[styles.radio, action.type === opt.type && { borderColor: color }]}>
            {action.type === opt.type && (
              <View style={[styles.radioDot, { backgroundColor: color }]} />
            )}
          </View>
          <Text style={styles.optLabel}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
      {action.type === 'album' && (
        <TouchableOpacity style={styles.albumPicker} onPress={onPickAlbum}>
          <Text style={styles.albumPickerText}>
            {action.albumName ? `Album: ${action.albumName}` : 'Tap to select an album →'}
          </Text>
        </TouchableOpacity>
      )}
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
  saveBtn: { color: '#4488ff', fontSize: 16, fontWeight: '700', textAlign: 'right', width: 60 },
  content: { padding: 20, gap: 20 },
  section: {
    backgroundColor: '#1c1c1c',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optLabel: { color: '#fff', fontSize: 15 },
  albumPicker: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  albumPickerText: { color: '#4488ff', fontSize: 15 },
  albumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  albumTitle: { color: '#fff', fontSize: 15 },
  albumCount: { color: '#666', fontSize: 13 },
  emptyAlbums: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#666', fontSize: 15 },
});
