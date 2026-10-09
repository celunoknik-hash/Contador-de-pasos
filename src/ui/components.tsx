import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Palette } from './theme';
export const number = (n: number) => n.toLocaleString('es-CL');
export function Card({ c, children }: { c: Palette; children: React.ReactNode }) {
  return <View style={{ padding: 20, borderRadius: 24, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, gap: 14 }}>{children}</View>;
}
export function Label({ c, children, muted = false, size = 16, bold = false }: { c: Palette; children: React.ReactNode; muted?: boolean; size?: number; bold?: boolean }) {
  return <Text style={{ color: muted ? c.muted : c.text, fontSize: size, fontWeight: bold ? '700' : '400', lineHeight: size * 1.45 }}>{children}</Text>;
}
export function Button({ title, onPress, c, secondary = false, disabled = false }: { title: string; onPress(): void; c: Palette; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, borderRadius: 15, padding: 13, justifyContent: 'center', alignItems: 'center', backgroundColor: secondary ? c.soft : '#087D5B', opacity: disabled ? 0.55 : pressed ? 0.75 : 1 })}>
    <Text style={{ color: secondary ? c.accent : '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
  </Pressable>;
}
export function Ring({ c, steps, goal }: { c: Palette; steps: number; goal: number }) {
  const [animated] = useState(() => new Animated.Value(0));
  const [fraction, setFraction] = React.useState(0);
  useEffect(() => {
    const sub = animated.addListener(({ value }) => setFraction(value));
    Animated.timing(animated, { toValue: Math.min(steps / goal, 1), duration: 500, useNativeDriver: false }).start();
    return () => { animated.removeListener(sub); animated.stopAnimation(); };
  }, [steps, goal, animated]);
  const length = 2 * Math.PI * 94;
  return <View accessible accessibilityLabel={`${number(steps)} pasos. Objetivo ${number(goal)}. ${Math.round(steps / goal * 100)} por ciento.`} style={styles.ring}>
    <Svg width={224} height={224} viewBox="0 0 224 224" style={StyleSheet.absoluteFill}>
      <Circle cx={112} cy={112} r={94} fill="none" stroke={c.line} strokeWidth={12} />
      <Circle cx={112} cy={112} r={94} fill="none" stroke={c.accent} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${length} ${length}`} strokeDashoffset={length * (1 - fraction)} rotation={-90} origin="112,112" />
    </Svg>
    <Label c={c} muted size={13}>PASOS DE HOY</Label>
    <Label c={c} bold size={40}>{number(steps)}</Label>
    <Label c={c} muted size={14}>de {number(goal)} pasos</Label>
  </View>;
}
const styles = StyleSheet.create({ ring: { width: 224, height: 224, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 1 } });
