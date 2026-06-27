import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SettingsScreen } from './screens/SettingsScreen';
import { SwipeScreen } from './screens/SwipeScreen';
import type { AppSettings } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  leftAction: { type: 'delete' },
  rightAction: { type: 'keep' },
};

export default function App() {
  const [screen, setScreen] = useState<'swipe' | 'settings'>('swipe');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {screen === 'swipe' ? (
        <SwipeScreen
          settings={settings}
          onOpenSettings={() => setScreen('settings')}
        />
      ) : (
        <SettingsScreen
          settings={settings}
          onSave={setSettings}
          onClose={() => setScreen('swipe')}
        />
      )}
    </GestureHandlerRootView>
  );
}
