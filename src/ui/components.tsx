import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle } from 'react-native-svg';
import { Palette } from './theme';
export const number = (n: number) => n.toLocaleString('es-CL');
export function Card({ c, children }: { c: Palette; children: React.ReactNode }) {
  return <View style={{ padding: 20, borderRadius: 26, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, gap: 16 }}>{children}</View>;
}
export function Label({ c, children, muted = false, size = 16, bold = false }: { c: Palette; children: React.ReactNode; muted?: boolean; size?: number; bold?: boolean }) {
  return <Text style={{ color: muted ? c.muted : c.text, fontSize: size, fontWeight: bold ? '600' : '400', letterSpacing: size >= 24 ? -0.8 : -0.2, fontVariant: ['tabular-nums'], lineHeight: size * (size >= 24 ? 1.2 : 1.45) }}>{children}</Text>;
}
export function Button({ title, onPress, c, secondary = false, disabled = false }: { title: string; onPress(): void; c: Palette; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 50, borderRadius: 16, padding: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: secondary ? c.soft : c.accent, opacity: disabled ? 0.55 : pressed ? 0.75 : 1 })}>
    <Text style={{ color: secondary ? c.text : c.onAccent, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
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
      <Circle cx={112} cy={112} r={94} fill="none" stroke={c.line} strokeWidth={5} />
      <Circle cx={112} cy={112} r={94} fill="none" stroke={c.accent} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${length} ${length}`} strokeDashoffset={length * (1 - fraction)} rotation={-90} origin="112,112" />
    </Svg>
    <Label c={c} muted size={13}>PASOS DE HOY</Label>
    <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: c.text, fontSize: 54, fontWeight: '300', letterSpacing: -2, fontVariant: ['tabular-nums'], maxWidth: 184 }}>{number(steps)}</Text>
    <Label c={c} muted size={14}>de {number(goal)} pasos</Label>
  </View>;
}
const styles = StyleSheet.create({ ring: { width: 224, height: 224, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 1 } });

export function SectionHeading({ c, eyebrow, title, subtitle }: { c: Palette; eyebrow: string; title: string; subtitle: string }) {
  return <View style={{ gap: 8, paddingTop: 6, paddingBottom: 6 }}><Text style={{ color: c.muted, fontSize: 11, letterSpacing: 1.8, fontWeight: '600' }}>{eyebrow.toUpperCase()}</Text><Label c={c} bold size={32}>{title}</Label><Label c={c} muted size={15}>{subtitle}</Label></View>;
}
export function Disclosure({ c, title, children }: { c: Palette; title: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={{ gap: 12 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, opacity: pressed ? 0.6 : 1 })}><View style={{ flex: 1 }}><Label c={c} size={14}>{title}</Label></View><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} /></Pressable>{expanded && children}</View>;
}
