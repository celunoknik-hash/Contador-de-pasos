import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useWalkWorld } from './context';
export function Screen({ children }: { children: React.ReactNode }) {
  const { model, c } = useWalkWorld();
  return <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, paddingTop: 10, gap: 20, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    {model.error && <View accessibilityRole="alert" style={{ padding: 16, borderWidth: 1, borderColor: c.error, borderRadius: 16 }}><Text style={{ color: c.error, lineHeight: 22 }}>{model.error}</Text></View>}
    {children}
  </ScrollView>;
}
