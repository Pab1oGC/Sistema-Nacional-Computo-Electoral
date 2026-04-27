import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Colors, Animation } from '../constants/theme';

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

  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      isDone ? Colors.success : isActive ? Colors.red : Colors.indicatorOff,
      { duration: Animation.normal }
    ),
    transform: [{ scale: withSpring(isActive ? 1.15 : 1, Animation.spring) }],
  }));

  return (
    <View style={styles.node}>
      <Animated.View style={[styles.circle, circleStyle]}>
        <Text style={styles.nodeIcon}>{isDone ? '✓' : icon}</Text>
      </Animated.View>
      <Text style={[styles.nodeLabel, isActive && { color: Colors.textPrimary }]}>
        {label}
      </Text>
    </View>
  );
}

function Connector({ filled }: { filled: boolean }) {
  const lineStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(filled ? Colors.success : Colors.indicatorOff, { duration: Animation.slow }),
  }));
  return <Animated.View style={[styles.connector, lineStyle]} />;
}

export function Stepper({ steps }: Props) {
  return (
    <View style={styles.row}>
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <StepNode {...step} />
          {i < steps.length - 1 && (
            <Connector filled={steps[i].state === 'done'} />
          )}
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
  node: {
    alignItems: 'center',
    gap: 6,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIcon: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
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
