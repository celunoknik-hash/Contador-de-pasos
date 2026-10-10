import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Rect, Circle, Text as SvgText } from 'react-native-svg';
import { useWalkWorld } from '../ui/context';
import { Screen } from '../ui/Screen';
import { Button, Card, Label } from '../ui/components';
import { parseCell } from '../domain/exploration';
import { useExploration } from './useExploration';

export function ExploreScreen() {
  const { c, model, repo } = useWalkWorld();
  const exploration = useExploration(repo, model.reload);
  const { stop } = exploration;
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  const center = exploration.localCell ?? (model.cells[0] ? parseCell(model.cells[0]) : null);
  const cells = center ? Array.from({ length: 25 }, (_, i) => ({ x: center.x + i % 5 - 2, y: center.y + 2 - Math.floor(i / 5) })) : [];
  const discovered = cells.filter(cell => model.cells.includes(`${cell.x}:${cell.y}`)).length;
  return <Screen><Label c={c} bold size={28}>Descubre tu entorno.</Label><Label c={c} muted>Mapa geográfico por sectores. El punto indica tu sector actual. Camina con la app abierta para descubrirlos.</Label>
    <Card c={c}>{center ? <View accessible accessibilityLabel={`${discovered} de 25 sectores visibles descubiertos`} style={{ aspectRatio: 1, width: '100%' }}><Svg width="100%" height="100%" viewBox="0 0 300 300">
      {cells.map((cell,i) => <Rect key={`${cell.x}:${cell.y}`} x={i % 5 * 60 + 3} y={Math.floor(i / 5) * 60 + 3} width={54} height={54} rx={8} fill={model.cells.includes(`${cell.x}:${cell.y}`) ? c.accent : c.soft} stroke={c.line} />)}
      {exploration.position && <Circle cx={150} cy={150} r={8} fill={c.text} stroke={c.card} strokeWidth={3} />}
      <SvgText x={150} y={18} textAnchor="middle" fill={c.text} fontSize={12}>N</SvgText>
    </Svg></View> : <View style={{ minHeight: 220, justifyContent: 'center', gap: 10 }}><Label c={c} bold>Tu mapa comienza aquí</Label><Label c={c} muted>Sin ubicaciones de muestra. Inicia una sesión para situar tu mapa en el mundo real.</Label></View>}
    <Label c={c} bold>{model.cells.length} sectores descubiertos</Label><Label c={c} muted size={13}>{center ? `${Math.round(discovered / 25 * 100)}% de esta ventana de 25 sectores. El área visible cambia al moverte.` : 'Los sectores se conservarán después de detener la sesión.'}</Label><Label c={c} muted size={12}>Cuadrícula sin calles; tamaño aproximado de 120 m proyectados; tamaño real variable según latitud. No mide un porcentaje del mundo entero.</Label></Card>
    <Card c={c}><Label c={c} muted>{exploration.message}</Label>
      {(!model.preferences.enabled || model.preferences.source !== 'sensor') && <Button c={c} disabled={model.busy} title="Activar sensor para explorar" onPress={() => void model.enable('sensor')} />}
      {exploration.running ? <Button c={c} title="Finalizar exploración" onPress={exploration.stop} /> : <Button c={c} disabled={exploration.busy || !model.preferences.enabled || model.preferences.source !== 'sensor'} title={exploration.busy ? 'Conectando ubicación…' : 'Iniciar exploración'} onPress={() => void exploration.start()} />}
      <Label c={c} muted size={12}>La ubicación se pide solo al iniciar. Al salir de esta pantalla o enviar WalkWorld a segundo plano se detiene la sesión. Guardamos sectores, sin recorridos ni puntos GPS exactos. En cuentas se sincronizan sectores privados.</Label></Card>
  </Screen>;
}
