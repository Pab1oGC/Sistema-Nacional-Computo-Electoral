import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/theme';

export type StepState = 'pending' | 'active' | 'done';

interface Step {
  icon: string;
  label: string;
  state: StepState;
}

interface Props {
  steps: Step[];
}

function StepNode({ icon, label, state }: Step) {
  const isDone   = state === 'done';
  const isActive = state === 'active';

  const scale = useRef(new Animated.Value(isActive ? 1.15 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue:  isActive ? 1.15 : 1,
      tension:  120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [isActive]);

  const bgColor = isDone ? Colors.success : isActive ? Colors.red : Colors.indicatorOff;

  return (
    <View style={styles.node}>
      <Animated.View style={[styles.circle, { backgroundColor: bgColor, transform: [{ scale }] }]}>
        <Text style={styles.nodeIcon}>{isDone ? '✓' : icon}</Text>
      </Animated.View>
      <Text style={[styles.nodeLabel, isActive && { color: Colors.textPrimary }]}>
        {label}
      </Text>
    </View>
  );
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <View
      style={[
        styles.connector,
        { backgroundColor: filled ? Colors.success : Colors.indicatorOff },
      ]}
    />
  );
}

export function Stepper({ steps }: Props) {
  return (
    <View style={styles.row}>
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <StepNode {...step} />
          {i < steps.length - 1 && <Connector filled={steps[i].state === 'done'} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  node: { alignItems: 'center', gap: 6 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIcon:  { fontSize: 18, color: Colors.textPrimary },
  nodeLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
    maxWidth: 64,
  },
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginBottom: 20,
    borderRadius: 1,
  },
});
