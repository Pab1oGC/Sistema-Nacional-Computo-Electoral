import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/theme';

export type IndicatorState = 'off' | 'warn' | 'ok';

interface Props {
  icon: string;
  label: string;
  state: IndicatorState;
}

const STATE_COLORS: Record<IndicatorState, string> = {
  off:  Colors.indicatorOff,
  warn: Colors.indicatorWarn,
  ok:   Colors.indicatorOk,
};

export function QualityIndicator({ icon, label, state }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [state]);

  const color = STATE_COLORS[state];

  return (
    <Animated.View
      style={[
        styles.chip,
        { backgroundColor: color + '33', borderColor: color },
        { transform: [{ scale }] },
      ]}
    >
      <Text style={[styles.icon, { color }]}>{icon}</Text>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  icon:  { fontSize: 13 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});
