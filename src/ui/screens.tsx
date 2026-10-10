import React, { useState } from 'react';
import { Alert, Linking, Pressable, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AccountCard } from '../account/AccountCard';
import { useActivity } from '../activity/useActivity';
import { healthSettings } from '../activity/healthConnect';
import { estimates, recentDays, validGoal } from '../domain/activity';
import { Button, Card, Label, number, Ring } from './components';
import { Palette } from './theme';
export type ActivityModel = ReturnType<typeof useActivity>;
type Props = { c: Palette; model: ActivityModel };
export function Home({ c, model }: Props) {
  const steps = model.today?.steps ?? 0;
  const goal = model.today?.goal ?? model.preferences.goal;
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
      <Label c={c} muted size={12}>Health Connect reemplaza la fuente del día; puede ajustar los pasos y retirar sus recompensas locales.</Label>
      <Button c={c} disabled={model.busy} secondary title="Conectar Health Connect" onPress={() => void model.enable('health-connect')} />
      {model.today && <Label c={c} muted size={12}>Última lectura: {new Date(model.today.updatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · {model.today.partial ? 'Parcial' : 'Health Connect'}</Label>}
    </Card>
    <WalletCard c={c} model={model} />
    <ChallengeCard c={c} challenge={model.challenges[0]} />
  </>;
}
function WalletCard({ c, model }: Props) {
  const base = model.wallet.movements;
  return <Card c={c}><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><Ionicons name="sparkles-outline" size={26} color={c.accent} /><Label c={c} bold size={28}>{number(model.remoteBalance ?? model.wallet.balance)}</Label><Label c={c} bold>WalkCoins</Label></View>
    <Label c={c} muted size={13}>{model.remoteBalance===undefined ? 'Saldo local' : 'Saldo sincronizado; los cambios sin conexión aparecen después de sincronizar'} · 100 pasos aceptados = 1 moneda, hasta 200 al día. Los desafíos añaden bonos.</Label>
    <Label c={c} muted size={12}>Solo virtuales, sin valor monetario ni conversión a dinero. Pendiente de validar el contador en un teléfono real.</Label>
    {model.today?.source === 'health-connect' && <Label c={c} muted size={13}>Health Connect cuenta para estadísticas. Sus totales aún no generan recompensas; cambiar de fuente retira las monedas locales de ese día.</Label>}
    {base.length === 0 && <Label c={c} muted size={12}>Camina con el sensor activo para obtener tus primeras monedas.</Label>}
  </Card>;
}
function ChallengeCard({ c, challenge }: { c: Palette; challenge: ActivityModel['challenges'][number] }) {
  const fraction = Math.min(challenge.progress / challenge.target, 1);
  return <Card c={c}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><Label c={c} bold>{challenge.title}</Label><Label c={c} bold size={14}>+{challenge.reward} WalkCoins</Label></View>
    <Label c={c} muted size={14}>{challenge.description}</Label>
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: challenge.target, now: challenge.progress }} style={{ height: 8, backgroundColor: c.line, borderRadius: 8, overflow: 'hidden' }}><View style={{ height: 8, width: `${fraction * 100}%`, backgroundColor: c.accent }} /></View>
    <Label c={c} muted size={13}>{number(challenge.progress)} / {number(challenge.target)}{challenge.id === 'three-days' ? ' días' : challenge.id === 'first-sector' ? ' sector' : ' pasos'} · {challenge.completed ? 'Completado · bono registrado' : challenge.eligible ? 'En progreso' : 'Sin recompensa: fuente pendiente de validar'}</Label>
  </Card>;
}
export function Challenges({ c, model }: Props) {
  return <><Label c={c} bold size={28}>Pequeñas metas,{ '\n' }grandes hábitos.</Label><Label c={c} muted>Los bonos se registran automáticamente, sin tener que reclamarlos. Los retos diarios se renuevan al cambiar de día.</Label>
    <WalletCard c={c} model={model} />
    {model.challenges.map(challenge => <ChallengeCard key={challenge.id} c={c} challenge={challenge} />)}

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
    <Card c={c}><Label c={c} bold size={26}>{number(total)} pasos</Label><Label c={c} muted>{estimate.kilometers.toFixed(2)} km aproximados acumulados</Label><Label c={c} muted size={13}>{model.days.length} días con registros</Label></Card>
    <Card c={c}><Label c={c} bold>Logros</Label>{model.challenges.find(ch => ch.id === 'three-days')?.completed ? <Label c={c}>🏅 Pequeños hábitos: tres objetivos consecutivos.</Label> : <Label c={c} muted size={14}>Cumple tres objetivos diarios consecutivos con el sensor para desbloquear tu primer logro.</Label>}</Card>
    <Card c={c}><Label c={c} bold>Movimientos locales de WalkCoins</Label>{model.wallet.movements.length === 0 ? <Label c={c} muted>Sin movimientos todavía.</Label> : model.wallet.movements.map(m => <View key={m.id} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10, gap: 3 }}><Label c={c} bold size={14}>{m.delta > 0 ? '+' : ''}{m.delta} · {m.label}</Label><Label c={c} muted size={12}>{m.date ?? 'Logro único'}{m.delta < 0 ? ' · ajuste por cambio de fuente o corrección' : ''}</Label></View>)}<Label c={c} muted size={12}>Últimos 50 movimientos. El saldo incluye todo el historial.</Label></Card>
    <Card c={c}><Label c={c} bold>Historial</Label>{model.days.length === 0 ? <Label c={c} muted>Aún no hay actividad. Activa el contador y comienza a caminar.</Label> : model.days.slice(0, 60).map(day => <View key={day.date} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12, gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Label c={c} bold size={14}>{day.date}</Label><Label c={c} bold>{number(day.steps)}</Label></View><Label c={c} muted size={12}>{day.partial ? 'Sensor · registro parcial' : 'Health Connect'} · meta {number(day.goal)}{day.anomalies > 0 ? ` · ${day.anomalies} lecturas descartadas` : ''}</Label>
    </View>)}</Card>
  </>;
}
export function Profile({ c, model }: Props) {
  const p = model.preferences;
  const base=JSON.stringify([p.name,p.goal,p.strideMeters,p.weightKg]);
  const initial={base,name:p.name,goal:String(p.goal),stride:String(p.strideMeters),weight:String(p.weightKg),dirty:false};
  const [draft,setDraft]=useState(initial);
  const form=draft.base===base || draft.dirty ? draft : initial;
  const {name,goal,stride,weight}=form;
  const change=(key:'name'|'goal'|'stride'|'weight',value:string)=>setDraft({...form,[key]:value,dirty:true});
  const [showPrivacy, setShowPrivacy] = useState(false);
  const save = () => {
    const g = Number(goal); const s = Number(stride.replace(',', '.')); const w = Number(weight.replace(',', '.'));
    if (!validGoal(g)) { Alert.alert('Revisa tu objetivo', 'Usa un número entero entre 500 y 50.000 pasos.'); return; }
    if (name.trim().length < 2 || name.trim().length > 30) { Alert.alert('Revisa tu nombre', 'Escribe entre 2 y 30 caracteres.'); return; }
    if (!Number.isFinite(s) || s < 0.2 || s > 1.5 || !Number.isFinite(w) || w < 20 || w > 300) { Alert.alert('Revisa tus estimaciones', 'Usa una longitud de paso entre 0,2 y 1,5 m y un peso entre 20 y 300 kg.'); return; }
    try { model.save({ ...p, name: name.trim(), goal: g, strideMeters: s, weightKg: w }); setDraft({...form,name:name.trim(),base:JSON.stringify([name.trim(),g,s,w]),dirty:false}); Alert.alert('Guardado', 'Tus preferencias se guardaron en el teléfono.'); }
    catch { Alert.alert('No se pudo guardar', 'Revisa el espacio disponible y vuelve a intentarlo.'); }
  };
  const field = (label: string, value: string, change: (s: string) => void, numeric = false) => <View style={{ gap: 6 }}><Label c={c} size={14} bold>{label}</Label><TextInput accessibilityLabel={label} value={value} onChangeText={change} maxLength={numeric ? 8 : 30} keyboardType={numeric ? 'decimal-pad' : 'default'} placeholderTextColor={c.muted} style={{ borderWidth: 1, borderColor: c.line, padding: 14, borderRadius: 13, fontSize: 16, color: c.text, minHeight: 48 }} /></View>;
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 62, height: 62, borderRadius: 24, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Label c={c} size={30}>{{walker: "🚶", forest: "🌳", ocean: "🌊", mountain: "⛰️"}[p.avatar]}</Label></View><View style={{ flex: 1 }}><Label c={c} bold size={24}>{p.name}</Label><Label c={c} muted size={13}>Perfil en este teléfono</Label></View></View>
    <AccountCard />
    <Card c={c}><Label c={c} bold>Tu ritmo</Label>{field('Nombre', name, value=>change('name',value))}{field('Objetivo diario (pasos)', goal, value=>change('goal',value), true)}{field('Longitud de paso estimada (m)', stride, value=>change('stride',value), true)}{field('Peso para estimar calorías (kg)', weight, value=>change('weight',value), true)}<Label c={c} muted size={12}>Distancia y calorías son aproximaciones. Puedes mantener los valores iniciales. Cambiar estas estimaciones recalcula el historial. Si hoy ya hay registros, su meta se conserva y el nuevo objetivo se aplica al próximo día.</Label><Button c={c} title="Guardar preferencias" onPress={save} /></Card>
    <Card c={c}><Label c={c} bold>Avatar</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{([['walker','🚶'],['forest','🌳'],['ocean','🌊'],['mountain','⛰️']] as const).map(([avatar,icon])=><Pressable key={avatar} accessibilityRole="radio" accessibilityLabel={`Avatar ${{walker:'Caminante',forest:'Bosque',ocean:'Océano',mountain:'Montaña'}[avatar]}`} accessibilityState={{checked:p.avatar===avatar}} onPress={()=>{try{model.save({...p,avatar});}catch{Alert.alert('Error','No se pudo guardar el avatar.');}}} style={{padding:14,minHeight:48,borderWidth:1,borderColor:p.avatar===avatar?c.accent:c.line,borderRadius:12}}><Label c={c} size={26}>{icon}</Label></Pressable>)}</View><Label c={c} bold>Apariencia</Label><View style={{ gap: 8 }}>{([['system', 'Según el teléfono'], ['light', 'Claro'], ['dark', 'Oscuro']] as const).map(([value, title]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: p.theme === value }} onPress={() => { try { model.save({ ...p, theme: value }); } catch { Alert.alert('Error', 'No se pudo guardar la apariencia.'); } }} style={{ minHeight: 48, padding: 13, backgroundColor: p.theme === value ? c.soft : c.card, borderWidth: 1, borderColor: c.line, borderRadius: 12, flexDirection: 'row', gap: 10 }}><Ionicons name={p.theme === value ? 'radio-button-on' : 'radio-button-off'} size={22} color={c.accent} /><Label c={c} size={15}>{title}</Label></Pressable>)}</View></Card>
    <Card c={c}><Label c={c} bold>Datos y permisos</Label><Label c={c} muted size={14}>Fuente: {p.source === 'sensor' ? 'sensor con app abierta' : 'Health Connect'}. {p.enabled ? 'Habilitada.' : 'Pausada.'}</Label><Button c={c} disabled={model.busy} title="Usar sensor del teléfono" onPress={() => void model.enable('sensor')} /><Button c={c} secondary disabled={model.busy} title="Conectar Health Connect" onPress={() => void model.enable('health-connect')} />
      {p.source === 'health-connect' && <Button c={c} secondary title="Gestionar permisos de Health Connect" onPress={() => void healthSettings().catch(e => Alert.alert('Health Connect', String(e.message)))} />}
      <Button c={c} secondary title="Abrir permisos de Android" onPress={() => void Linking.openSettings().catch(() => Alert.alert('Ajustes', 'Abre Ajustes → Aplicaciones → WalkWorld.'))} />
      <Button c={c} secondary title={showPrivacy ? 'Cerrar información de privacidad' : 'Privacidad y uso de datos'} onPress={() => setShowPrivacy(!showPrivacy)} />
      {showPrivacy && <Label c={c} muted size={14}>El modo invitado guarda datos en este teléfono. Al iniciar sesión se sincronizan perfil, pasos diarios, recompensas y sectores privados en Supabase. Health Connect requiere solo lectura de pasos; WalkWorld no escribe actividad. El GPS se usa únicamente en sesiones voluntarias de Explorar y se detiene al salir o pasar a segundo plano. No guardamos recorridos ni coordenadas exactas: los sectores pueden revelar zonas visitadas. No se solicitan contactos. Puedes revocar permisos en Android y eliminar tu cuenta desde esta pantalla.</Label>}
    </Card>
  </>;
}
