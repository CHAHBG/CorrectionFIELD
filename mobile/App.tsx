// =====================================================
//  FieldCorrect Mobile — App Entry Point
// =====================================================

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import RootNavigator from './src/navigation/RootNavigator';
import { localDB } from './src/infra/db/LocalDB';
import { syncEngine } from './src/infra/sync/SyncEngine';
import { useProjectStore } from './src/stores/projectStore';
import { useLayerStore } from './src/stores/layerStore';

function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // 1. Initialize local database (runs migrations)
        await localDB.init();

        // 2. Initialize auth state
        await useProjectStore.getState().init();

        // 3. Load layers into store
        await useLayerStore.getState().loadLayers();

        // 4. Start background sync (non-blocking)
        try {
          syncEngine.start();
        } catch (syncErr) {
          console.warn('[App] sync start failed (non-fatal)', syncErr);
        }
      } catch (e) {
        console.error('[App] startup error', e);
      } finally {
        setReady(true);
      }
    })();

    return () => {
      syncEngine.stop();
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default App;
