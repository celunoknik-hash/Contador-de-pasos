import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { finishAccountDeletion, openRepository } from '../data/local';
import { useActivity } from '../activity/useActivity';
import { useAccount } from '../account/context';
import { useSync } from '../account/useSync';
import { dark, light, Palette } from './theme';
interface WalkWorldContext { sync: ReturnType<typeof useSync>; repo: ReturnType<typeof openRepository>; model: ReturnType<typeof useActivity>; c: Palette; isDark: boolean }
const Context = createContext<WalkWorldContext | null>(null);
export function WalkWorldProvider({ children }: { children: React.ReactNode }) {
  const auth=useAccount();
  return auth.ready ? <AccountWorld key={auth.user?.id ?? 'guest'} userId={auth.user?.id}>{children}</AccountWorld> : <SafeAreaView style={{flex:1,justifyContent:'center',padding:28}}><Text>Cargando tus datos seguros…</Text></SafeAreaView>;
}
function AccountWorld({children,userId}:{children:React.ReactNode;userId?:string}) {
  const repo = useMemo(() => openRepository(userId), [userId]);
  const model = useActivity(repo);
  const sync=useSync(repo,userId,model.reload);
  useEffect(()=>()=>{if(userId)finishAccountDeletion(userId);},[userId]);
  const system = useColorScheme();
  const isDark = model.preferences.theme === 'dark' || (model.preferences.theme === 'system' && system === 'dark');
  return <Context.Provider value={{ repo, model, sync, c: isDark ? dark : light, isDark }}>{children}</Context.Provider>;
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
