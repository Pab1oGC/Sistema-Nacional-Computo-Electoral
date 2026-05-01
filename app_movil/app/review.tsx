import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { FlagStripe } from '../components/FlagStripe';
import { useAppStore } from '../store/appStore';

export default function ReviewScreen() {
  const router = useRouter();
  const store  = useAppStore();

  const imgScale   = useRef(new Animated.Value(0.85)).current;
  const imgOpacity = useRef(new Animated.Value(0)).current;
  const btnY       = useRef(new Animated.Value(40)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(imgScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(imgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(btnY,    { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
        Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  function handleConfirm() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    store.incrementCounter();
    router.push('/submit');
  }

  function handleRetry() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.setCapturedPhoto(null);
    router.back();
  }

  useEffect(() => {
    if (!store.capturedPhotoUri) router.replace('/camera');
  }, [store.capturedPhotoUri]);

  if (!store.capturedPhotoUri) return null;

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: imgOpacity, transform: [{ scale: imgScale }] }]}>
        <Image
          source={{ uri: store.capturedPhotoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Top bar */}
      <BlurView intensity={50} tint="dark" style={styles.topBar}>
        <View style={styles.topBarContent}>
          <Text style={styles.topTitle}>Revisar foto</Text>
          <Text style={styles.topSub}>Mesa {store.codigoMesa}</Text>
        </View>
      </BlurView>

      {/* Bottom actions */}
      <Animated.View style={[styles.bottomBar, { opacity: btnOpacity, transform: [{ translateY: btnY }] }]}>
        <BlurView intensity={60} tint="dark" style={styles.bottomBlur}>
          <Text style={styles.reviewHint}>
            Asegúrate de que el acta sea legible y esté completa
          </Text>
          <FlagStripe height={2} marginVertical={12} />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
              <Text style={styles.retryText}>↩ Repetir</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} activeOpacity={0.85} style={{ flex: 1 }}>
              <LinearGradient
                colors={[Colors.red, '#9A0B22']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmBtn}
              >
                <Text style={styles.confirmText}>Confirmar y enviar →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 52, paddingBottom: 16,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  topBarContent: { paddingHorizontal: Spacing.lg, gap: 2 },
  topTitle: { ...Typography.subtitle, color: Colors.textPrimary },
  topSub:   { ...Typography.caption,  color: Colors.textSecondary },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomBlur: {
    padding: Spacing.lg,
    paddingBottom: 40,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  reviewHint: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  actions:    { flexDirection: 'row', gap: 12, alignItems: 'center' },
  retryBtn: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  retryText:   { ...Typography.body,    color: Colors.textSecondary, fontWeight: '600' },
  confirmBtn:  { borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center' },
  confirmText: { ...Typography.subtitle, color: Colors.textPrimary },
});
