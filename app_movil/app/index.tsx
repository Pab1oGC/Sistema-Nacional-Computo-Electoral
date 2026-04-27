import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Animation } from '../constants/theme';
import { BoliviaSeal } from '../components/BoliviaSeal';
import { FlagStripe } from '../components/FlagStripe';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  const sealScale   = useSharedValue(0.3);
  const sealOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY       = useSharedValue(20);
  const stripeWidth = useSharedValue(0);

  const sealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sealScale.value }],
    opacity: sealOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  const stripeStyle = useAnimatedStyle(() => ({
    width: stripeWidth.value,
  }));

  useEffect(() => {
    sealOpacity.value = withTiming(1, { duration: Animation.slow });
    sealScale.value   = withSpring(1, Animation.spring);

    textOpacity.value = withDelay(600, withTiming(1, { duration: Animation.slow }));
    textY.value       = withDelay(600, withSpring(0, Animation.spring));

    stripeWidth.value = withDelay(800, withTiming(width * 0.6, { duration: Animation.slow }));

    const timer = setTimeout(() => router.replace('/setup'), 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={[Colors.bg, Colors.surface]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={styles.container}
    >
      {/* Background seal watermark */}
      <View style={styles.watermark} pointerEvents="none">
        <BoliviaSeal size={280} opacity={0.04} />
      </View>

      <Animated.View style={[styles.sealWrapper, sealStyle]}>
        <BoliviaSeal size={130} opacity={1} />
      </Animated.View>

      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.title}>RRV Bolivia</Text>
        <Text style={styles.subtitle}>Recuento Rápido de Votos</Text>

        <Animated.View style={[styles.stripeContainer, stripeStyle]}>
          <FlagStripe height={3} marginVertical={0} />
        </Animated.View>

        <Text style={styles.caption}>Sistema Nacional de Cómputo Electoral</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  watermark: {
    position: 'absolute',
    alignSelf: 'center',
    top: '25%',
  },
  sealWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...Typography.display,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.subtitle,
    color: Colors.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stripeContainer: {
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginVertical: 12,
  },
  caption: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
