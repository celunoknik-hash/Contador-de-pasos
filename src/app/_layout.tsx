import React from 'react';
import { AccountProvider } from '../account/context';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StorageBoundary, WalkWorldProvider } from '../ui/context';
export default function RootLayout() {
  return <SafeAreaProvider><StorageBoundary><AccountProvider><WalkWorldProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack></WalkWorldProvider></AccountProvider></StorageBoundary></SafeAreaProvider>;
}
