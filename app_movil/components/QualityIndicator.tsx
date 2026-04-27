import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Colors, Animation } from '../constants/theme';

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
  const color = STATE_COLORS[state];

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(color + '33', { duration: Animation.normal }),
    borderColor:     withTiming(color,        { duration: Animation.normal }),
  }));

  const textStyle = useAnimatedStyle(() => ({
    color: withTiming(color, { duration: Animation.normal }),
  }));

  return (
    <Animated.View style={[styles.chip, animStyle]}>
      <Animated.Text style={[styles.icon, textStyle]}>{icon}</Animated.Text>
      <Animated.Text style={[styles.label, textStyle]}>{label}</Animated.Text>
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
  icon: {
    fontSize: 13,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
