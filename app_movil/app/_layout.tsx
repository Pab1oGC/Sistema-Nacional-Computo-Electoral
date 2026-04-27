import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useAppStore } from '../store/appStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const loadSavedMesa = useAppStore((s) => s.loadSavedMesa);

  useEffect(() => {
    loadSavedMesa().then(() => SplashScreen.hideAsync());
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="setup"   options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="camera"  options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="review"  options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="submit"  options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
