import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../constants/theme';
import { BoliviaSeal } from '../components/BoliviaSeal';
import { FlagStripe } from '../components/FlagStripe';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  const sealScale   = useRef(new Animated.Value(0.3)).current;
  const sealOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(20)).current;
  const stripeWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sealOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(sealScale,   { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(textY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(800),
      Animated.timing(stripeWidth, {
        toValue: width * 0.6,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

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
      <View style={styles.watermark} pointerEvents="none">
        <BoliviaSeal size={280} opacity={0.04} />
      </View>

      <Animated.View style={[styles.sealWrapper, { opacity: sealOpacity, transform: [{ scale: sealScale }] }]}>
        <BoliviaSeal size={130} opacity={1} />
      </Animated.View>

      <Animated.View style={[styles.textBlock, { opacity: textOpacity, transform: [{ translateY: textY }] }]}>
        <Text style={styles.title}>RRV Bolivia</Text>
        <Text style={styles.subtitle}>Recuento Rápido de Votos</Text>

        <Animated.View style={[styles.stripeContainer, { width: stripeWidth }]}>
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
    marginVertical: 12,
  },
  caption: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
