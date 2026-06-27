import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { usePhotoStore } from './store/photoStore';
import { DeleteQueueScreen } from './screens/DeleteQueueScreen';
import { BurstDetailScreen } from './screens/BurstDetailScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SwipeScreen } from './screens/SwipeScreen';
import type { AppSettings, PhotoGroup } from './types';

type Screen = 'library' | 'swipe' | 'deleteQueue' | 'settings' | 'burstDetail';

const DEFAULT_SETTINGS: AppSettings = {
  leftAction: { type: 'delete' },
  rightAction: { type: 'keep' },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('library');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [selectedGroup, setSelectedGroup] = useState<PhotoGroup | null>(null);

  useEffect(() => {
    usePhotoStore.getState().initPermissions();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {screen === 'library' && (
        <LibraryScreen
          onStartSwiping={() => setScreen('swipe')}
          onOpenBurst={(group) => { setSelectedGroup(group); setScreen('burstDetail'); }}
        />
      )}
      {screen === 'swipe' && (
        <SwipeScreen
          settings={settings}
          onOpenSettings={() => setScreen('settings')}
          onOpenLibrary={() => setScreen('library')}
          onOpenDeleteQueue={() => setScreen('deleteQueue')}
        />
      )}
      {screen === 'deleteQueue' && (
        <DeleteQueueScreen onClose={() => setScreen('swipe')} />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onSave={setSettings}
          onClose={() => setScreen('swipe')}
        />
      )}
      {screen === 'burstDetail' && selectedGroup && (
        <BurstDetailScreen
          group={selectedGroup}
          onClose={() => setScreen('library')}
          onStartSwiping={() => setScreen('swipe')}
        />
      )}
    </GestureHandlerRootView>
  );
}
