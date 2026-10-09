import React, { useState } from 'react';
import { Alert, Linking, Pressable, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useActivity } from '../activity/useActivity';
import { healthSettings } from '../activity/healthConnect';
import { estimates, recentDays, validGoal } from '../domain/activity';
import { Button, Card, Label, number, Ring } from './components';
import { Palette } from './theme';
export type ActivityModel = ReturnType<typeof useActivity>;
type Props = { c: Palette; model: ActivityModel };
export function Home({ c, model }: Props) {
  const steps = model.today?.steps ?? 0;
  const goal = model.preferences.goal;
  const estimate = estimates(steps, model.preferences.strideMeters, model.preferences.weightKg);
  return <>
    <View style={{ gap: 6 }}><Label c={c} muted size={14}>HOLA, {model.preferences.name.toUpperCase()}</Label><Label c={c} bold size={28}>Tu mundo empieza{ '\n' }con un paso.</Label><Label c={c} muted>Cada paso cuenta. Camina a tu ritmo.</Label></View>
    <Card c={c}><Ring c={c} steps={steps} goal={goal} /><View style={{ alignItems: 'center', gap: 4 }}><Label c={c} bold>{Math.round(steps / goal * 100)}% de tu objetivo</Label><Label c={c} muted size={13}>{steps >= goal ? '¡Objetivo alcanzado!' : `Te faltan ${number(goal - steps)} pasos`}</Label></View>
      <View style={{ height: 1, backgroundColor: c.line }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}><View><Label c={c} bold size={22}>{estimate.kilometers.toFixed(2)} km</Label><Label c={c} muted size={12}>Distancia aproximada</Label></View><View><Label c={c} bold size={22}>{number(estimate.calories)} kcal</Label><Label c={c} muted size={12}>Energía aproximada</Label></View></View>
    </Card>
    <Card c={c}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="footsteps-outline" size={22} color={c.accent} /><Label c={c} bold>Tu contador</Label></View>
      <Label c={c} muted size={14}>{model.status}</Label>
      <Label c={c} muted size={13}>{model.preferences.source === 'sensor' ? 'Registro parcial: no incluye pasos dados con la app cerrada o en segundo plano.' : 'Lee los pasos guardados en Health Connect. Si ninguna fuente registra pasos, el total puede permanecer en cero.'}</Label>
      {model.preferences.enabled ? <><Button c={c} secondary title="Pausar contador" onPress={model.pause} />{model.preferences.source === 'health-connect' && <Button c={c} title="Actualizar pasos" onPress={() => void model.refresh()} />}</> : <Button c={c} disabled={model.busy} title={model.busy ? 'Conectando…' : 'Activar sensor del teléfono'} onPress={() => void model.enable('sensor')} />}
      <Button c={c} disabled={model.busy} secondary title="Conectar Health Connect" onPress={() => void model.enable('health-connect')} />
      {model.today && <Label c={c} muted size={12}>Última lectura: {new Date(model.today.updatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · {model.today.partial ? 'Parcial' : 'Health Connect'}</Label>}
    </Card>
    <Card c={c}><Label c={c} bold>Tu próxima aventura</Label><Label c={c} muted size={14}>Tu actividad real ya queda guardada. WalkCoins y desafíos aún no están disponibles. Mientras tanto, avanza hacia tu objetivo diario.</Label></Card>
  </>;
}
export function Progress({ c, model }: Props) {
  const week = recentDays().map(date => ({ date, activity: model.days.find(d => d.date === date) }));
  const total = model.days.reduce((sum, day) => sum + day.steps, 0);
  const estimate = estimates(total, model.preferences.strideMeters, model.preferences.weightKg);
  const max = Math.max(model.preferences.goal, ...week.map(day => day.activity?.steps ?? 0));
  return <>
    <Label c={c} bold size={28}>Cada día suma.</Label><Label c={c} muted>Tu actividad registrada, a tu propio ritmo.</Label>
    <Card c={c}><Label c={c} bold>Últimos 7 días</Label><View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', justifyContent: 'space-between' }}>
      {week.map(day => <View accessible accessibilityLabel={`${day.date}: ${day.activity ? `${day.activity.steps} pasos` : 'sin datos'}`} key={day.date} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
        <View style={{ height: 116, width: '100%', backgroundColor: c.soft, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' }}><View style={{ height: 116 * ((day.activity?.steps ?? 0) / max), backgroundColor: c.accent, borderRadius: 8 }} /></View>
        <Label c={c} muted size={11}>{day.date.slice(-2)}</Label>
      </View>)}
    </View><Label c={c} muted size={12}>Las barras vacías pueden indicar días sin registros.</Label></Card>
    <Card c={c}><Label c={c} bold size={26}>{number(total)} pasos</Label><Label c={c} muted>{estimate.kilometers.toFixed(2)} km aproximados acumulados</Label><Label c={c} muted size={13}>{model.days.length} días con registros locales</Label></Card>
    <Card c={c}><Label c={c} bold>Historial</Label>{model.days.length === 0 ? <Label c={c} muted>Aún no hay actividad. Activa el contador y comienza a caminar.</Label> : model.days.slice(0, 60).map(day => <View key={day.date} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12, gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Label c={c} bold size={14}>{day.date}</Label><Label c={c} bold>{number(day.steps)}</Label></View><Label c={c} muted size={12}>{day.partial ? 'Sensor · registro parcial' : 'Health Connect'} · meta {number(day.goal)}{day.anomalies > 0 ? ` · ${day.anomalies} lecturas descartadas` : ''}</Label>
    </View>)}</Card>
  </>;
}
export function Later({ c, kind }: { c: Palette; kind: 'map' | 'challenges' }) {
  const isMap = kind === 'map';
  return <><View style={{ backgroundColor: c.soft, width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={isMap ? 'compass-outline' : 'trophy-outline'} color={c.accent} size={38} /></View>
    <Label c={c} bold size={28}>{isMap ? 'El mundo te espera.' : 'Un paso, una nueva meta.'}</Label><Card c={c}><Label c={c} bold>{isMap ? 'Exploración · próximamente' : 'Desafíos · próximamente'}</Label><Label c={c} muted>{isMap ? 'La exploración aún no está disponible. Permitirá descubrir sectores durante sesiones de caminata voluntarias.' : 'Los desafíos se implementarán con condiciones verificables y recompensas sin duplicados. Por ahora, puedes cumplir tu objetivo personal desde Inicio.'}</Label><Label c={c} muted size={13}>{isMap ? 'No solicitamos tu ubicación ni registramos recorridos.' : 'Aún no se emiten WalkCoins. Son una moneda virtual sin valor monetario.'}</Label></Card></>;
}
export function Profile({ c, model }: Props) {
  const p = model.preferences;
  const [name, setName] = useState(p.name);
  const [goal, setGoal] = useState(String(p.goal));
  const [stride, setStride] = useState(String(p.strideMeters));
  const [weight, setWeight] = useState(String(p.weightKg));
  const [showPrivacy, setShowPrivacy] = useState(false);
  const save = () => {
    const g = Number(goal); const s = Number(stride.replace(',', '.')); const w = Number(weight.replace(',', '.'));
    if (!validGoal(g)) { Alert.alert('Revisa tu objetivo', 'Usa un número entero entre 500 y 50.000 pasos.'); return; }
    if (name.trim().length < 2 || name.trim().length > 30) { Alert.alert('Revisa tu nombre', 'Escribe entre 2 y 30 caracteres.'); return; }
    if (!Number.isFinite(s) || s < 0.2 || s > 1.5 || !Number.isFinite(w) || w < 20 || w > 300) { Alert.alert('Revisa tus estimaciones', 'Usa una longitud de paso entre 0,2 y 1,5 m y un peso entre 20 y 300 kg.'); return; }
    try { model.save({ ...p, name: name.trim(), goal: g, strideMeters: s, weightKg: w }); Alert.alert('Guardado', 'Tus preferencias se guardaron en el teléfono.'); }
    catch { Alert.alert('No se pudo guardar', 'Revisa el espacio disponible y vuelve a intentarlo.'); }
  };
  const field = (label: string, value: string, change: (s: string) => void, numeric = false) => <View style={{ gap: 6 }}><Label c={c} size={14} bold>{label}</Label><TextInput accessibilityLabel={label} value={value} onChangeText={change} maxLength={numeric ? 8 : 30} keyboardType={numeric ? 'decimal-pad' : 'default'} placeholderTextColor={c.muted} style={{ borderWidth: 1, borderColor: c.line, padding: 14, borderRadius: 13, fontSize: 16, color: c.text, minHeight: 48 }} /></View>;
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 62, height: 62, borderRadius: 24, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person-outline" size={30} color={c.accent} /></View><View style={{ flex: 1 }}><Label c={c} bold size={24}>{p.name}</Label><Label c={c} muted size={13}>Perfil en este teléfono</Label></View></View>
    <Card c={c}><Label c={c} bold>Tu ritmo</Label>{field('Nombre', name, setName)}{field('Objetivo diario (pasos)', goal, setGoal, true)}{field('Longitud de paso estimada (m)', stride, setStride, true)}{field('Peso para estimar calorías (kg)', weight, setWeight, true)}<Label c={c} muted size={12}>Distancia y calorías son aproximaciones. Puedes mantener los valores iniciales. Cambiar estos valores recalcula las estimaciones del historial.</Label><Button c={c} title="Guardar preferencias" onPress={save} /></Card>
    <Card c={c}><Label c={c} bold>Apariencia</Label><View style={{ gap: 8 }}>{([['system', 'Según el teléfono'], ['light', 'Claro'], ['dark', 'Oscuro']] as const).map(([value, title]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: p.theme === value }} onPress={() => { try { model.save({ ...p, theme: value }); } catch { Alert.alert('Error', 'No se pudo guardar la apariencia.'); } }} style={{ minHeight: 48, padding: 13, backgroundColor: p.theme === value ? c.soft : c.card, borderWidth: 1, borderColor: c.line, borderRadius: 12, flexDirection: 'row', gap: 10 }}><Ionicons name={p.theme === value ? 'radio-button-on' : 'radio-button-off'} size={22} color={c.accent} /><Label c={c} size={15}>{title}</Label></Pressable>)}</View></Card>
    <Card c={c}><Label c={c} bold>Datos y permisos</Label><Label c={c} muted size={14}>Fuente: {p.source === 'sensor' ? 'sensor con app abierta' : 'Health Connect'}. {p.enabled ? 'Habilitada.' : 'Pausada.'}</Label><Button c={c} disabled={model.busy} title="Usar sensor del teléfono" onPress={() => void model.enable('sensor')} /><Button c={c} secondary disabled={model.busy} title="Conectar Health Connect" onPress={() => void model.enable('health-connect')} />
      {p.source === 'health-connect' && <Button c={c} secondary title="Gestionar permisos de Health Connect" onPress={() => void healthSettings().catch(e => Alert.alert('Health Connect', String(e.message)))} />}
      <Button c={c} secondary title="Abrir permisos de Android" onPress={() => void Linking.openSettings().catch(() => Alert.alert('Ajustes', 'Abre Ajustes → Aplicaciones → WalkWorld.'))} />
      <Button c={c} secondary title={showPrivacy ? 'Cerrar información de privacidad' : 'Privacidad y uso de datos'} onPress={() => setShowPrivacy(!showPrivacy)} />
      {showPrivacy && <Label c={c} muted size={14}>Esta fase guarda pasos, objetivos y preferencias solo en el teléfono. No los envía a Supabase. Health Connect requiere solo lectura de pasos; WalkWorld no escribe actividad. No se usa GPS ni se solicitan contactos. Pausar detiene las lecturas de WalkWorld; puedes revocar sus permisos en Android. Las cuentas y la sincronización en la nube aún no están disponibles.</Label>}
    </Card>
  </>;
}
