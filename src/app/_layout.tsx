import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StorageBoundary, WalkWorldProvider } from '../ui/context';
export default function RootLayout() {
  return <SafeAreaProvider><StorageBoundary><WalkWorldProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack></WalkWorldProvider></StorageBoundary></SafeAreaProvider>;
}
