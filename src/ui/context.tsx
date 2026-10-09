import React, { createContext, useContext, useMemo } from 'react';
import { Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { openRepository } from '../data/local';
import { useActivity } from '../activity/useActivity';
import { dark, light, Palette } from './theme';
interface WalkWorldContext { model: ReturnType<typeof useActivity>; c: Palette; isDark: boolean }
const Context = createContext<WalkWorldContext | null>(null);
export function WalkWorldProvider({ children }: { children: React.ReactNode }) {
  const repo = useMemo(() => openRepository(), []);
  const model = useActivity(repo);
  const system = useColorScheme();
  const isDark = model.preferences.theme === 'dark' || (model.preferences.theme === 'system' && system === 'dark');
  return <Context.Provider value={{ model, c: isDark ? dark : light, isDark }}>{children}</Context.Provider>;
}
export function useWalkWorld() {
  const context = useContext(Context);
  if (!context) throw new Error('WalkWorldProvider no disponible.');
  return context;
}
export class StorageBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? <SafeAreaView style={{ flex: 1, padding: 28, justifyContent: 'center' }}><Text style={{ fontSize: 24, fontWeight: '700' }}>No se pudo abrir WalkWorld</Text><Text style={{ marginTop: 16 }}>Revisa el espacio disponible y reinicia la aplicación. No se mostrarán datos inventados si falla el almacenamiento.</Text></SafeAreaView> : this.props.children;
  }
}
