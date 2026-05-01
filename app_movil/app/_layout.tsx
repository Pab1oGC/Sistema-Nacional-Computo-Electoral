import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAppStore } from '../store/appStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const loadSavedMesa = useAppStore((s) => s.loadSavedMesa);

  useEffect(() => {
    loadSavedMesa().then(() => SplashScreen.hideAsync());
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="setup"   options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="camera"  options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="review"  options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="submit"  options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="form"    options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="pending" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </View>
  );
}
