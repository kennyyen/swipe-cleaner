import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PhotoLibraryProvider } from './context/PhotoLibraryContext';
import { DeleteQueueScreen } from './screens/DeleteQueueScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SwipeScreen } from './screens/SwipeScreen';
import type { AppSettings } from './types';

type Screen = 'library' | 'swipe' | 'deleteQueue' | 'settings';

const DEFAULT_SETTINGS: AppSettings = {
  leftAction: { type: 'delete' },
  rightAction: { type: 'keep' },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('library');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <PhotoLibraryProvider>
        {screen === 'library' && (
          <LibraryScreen onStartSwiping={() => setScreen('swipe')} />
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
      </PhotoLibraryProvider>
    </GestureHandlerRootView>
  );
}
