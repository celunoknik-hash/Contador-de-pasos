import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View, type ColorValue } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWalkWorld } from '../../ui/context';
export default function TabsLayout() {
  const { c, isDark } = useWalkWorld();
  const insets = useSafeAreaInsets();
  const icon = (name: React.ComponentProps<typeof Ionicons>['name']) => function TabIcon({ color, size }: { color: ColorValue; size: number }) { return <Ionicons name={name} color={color} size={size} />; };
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.background }}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <Tabs screenOptions={{
      header: () => <View style={{ paddingHorizontal: 22, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.background }}><Ionicons name="earth-outline" size={24} color={c.accent} /><Text style={{ fontSize: 21, fontWeight: '800', color: c.text }}>WalkWorld</Text></View>,
      sceneStyle: { backgroundColor: c.background },
      tabBarActiveTintColor: c.accent, tabBarInactiveTintColor: c.muted,
      tabBarLabelStyle: { fontSize: 11 }, tabBarItemStyle: { minHeight: 48 },
      tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line, height: 64 + insets.bottom, paddingTop: 7, paddingBottom: Math.max(insets.bottom, 7) },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explorar', tabBarIcon: icon('compass-outline') }} />
      <Tabs.Screen name="challenges" options={{ title: 'Desafíos', tabBarIcon: icon('trophy-outline') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progreso', tabBarIcon: icon('stats-chart-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  </SafeAreaView>;
}
