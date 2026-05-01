import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Modal, ScrollView, Animated, Easing,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { QualityIndicator, IndicatorState } from '../components/QualityIndicator';
import { FlagStripe } from '../components/FlagStripe';
import { useAppStore } from '../store/appStore';

const { width } = Dimensions.get('window');
const FRAME_W = width * 0.88;
const FRAME_H = FRAME_W * 1.41;

type Hint = 'coloca' | 'acerca' | 'horizontal' | 'listo';

const HINT_TEXT: Record<Hint, string> = {
  coloca:     'Coloca el acta dentro del marco',
  acerca:     'Acércate un poco más',
  horizontal: 'Mantén la cámara horizontal',
  listo:      'Listo para capturar ✓',
};

export default function CameraScreen() {
  const router    = useRouter();
  const store     = useAppStore();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [luz,       setLuz]       = useState(30);
  const [foco,      setFoco]      = useState(20);
  const [angulo,    setAngulo]    = useState(40);
  const [hint,      setHint]      = useState<Hint>('coloca');
  const [ready,     setReady]     = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [showGuide, setShowGuide] = useState(!store.guideShown);
  const [guidePage, setGuidePage] = useState(0);

  // Pulse animation for frame
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  // Ring rotation
  const rotationAnim = useRef(new Animated.Value(0)).current;
  // Button scale
  const btnScale = useRef(new Animated.Value(1)).current;

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Pulse loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Ring spin when ready
  useEffect(() => {
    if (ready) {
      const loop = Animated.loop(
        Animated.timing(rotationAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
      );
      loop.start();
      return () => loop.stop();
    } else {
      rotationAnim.setValue(0);
    }
  }, [ready]);

  // Simulate quality climbing
  useEffect(() => {
    const id = setInterval(() => {
      setLuz(v    => Math.min(95, v + Math.random() * 6 - 1));
      setFoco(v   => Math.min(95, v + Math.random() * 5 - 0.5));
      setAngulo(v => Math.min(95, v + Math.random() * 5 - 1));
    }, 800);
    return () => clearInterval(id);
  }, []);

  // Update hint & ready
  useEffect(() => {
    const luzOk    = luz    > 60;
    const focoOk   = foco   > 75;
    const anguloOk = angulo > 50;
    const allOk    = luzOk && focoOk && anguloOk;

    if (allOk)         setHint('listo');
    else if (!luzOk)   setHint('acerca');
    else if (!focoOk)  setHint('coloca');
    else               setHint('horizontal');

    if (allOk !== ready) {
      setReady(allOk);
      if (allOk) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [luz, foco, angulo]);

  const indState = (val: number, okT: number, warnT: number): IndicatorState =>
    val > okT ? 'ok' : val > warnT ? 'warn' : 'off';

  const handleCapture = useCallback(async () => {
    if (!ready || capturing || !cameraRef.current) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.88, duration: 100, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
    ]).start();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (photo?.uri) {
        store.setCapturedPhoto(photo.uri);
        router.push('/review');
      }
    } catch {
      setCapturing(false);
    }
  }, [ready, capturing]);

  const handleGuideClose = () => {
    store.markGuideShown();
    setShowGuide(false);
  };

  if (!permission) return <View style={styles.permContainer} />;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permTitle}>Acceso a la cámara</Text>
        <Text style={styles.permBody}>
          Para fotografiar el acta necesitamos acceso a tu cámara.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Conceder permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Frame guide */}
      <View style={styles.overlay} pointerEvents="none">
        <Animated.View style={[styles.frame, { opacity: pulseAnim }]}>
          {([
            { top: -2,   left: -2  },
            { top: -2,   right: -2 },
            { bottom: -2, left: -2 },
            { bottom: -2, right: -2 },
          ] as const).map((pos, i) => (
            <View key={i} style={[styles.corner, pos]} />
          ))}
        </Animated.View>
      </View>

      {/* Hint */}
      <View style={styles.hintContainer} pointerEvents="none">
        <BlurView intensity={40} tint="dark" style={styles.hintBlur}>
          <Text style={styles.hintText}>{HINT_TEXT[hint]}</Text>
        </BlurView>
      </View>

      {/* Indicators */}
      <View style={styles.indicators}>
        <QualityIndicator icon="☀" label="Luz"    state={indState(luz, 60, 35)} />
        <QualityIndicator icon="◎" label="Foco"   state={indState(foco, 75, 45)} />
        <QualityIndicator icon="⬛" label="Ángulo" state={indState(angulo, 50, 30)} />
      </View>

      {/* Bottom bar */}
      <BlurView intensity={50} tint="dark" style={styles.bottomBar}>
        <Text style={styles.mesaLabel}>Mesa{'\n'}{store.codigoMesa}</Text>

        <View style={styles.captureWrapper}>
          {ready && (
            <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]}>
              <LinearGradient
                colors={[Colors.gold, Colors.red, Colors.green, Colors.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[styles.captureBtn, ready && styles.captureBtnReady]}
              onPress={handleCapture}
              disabled={!ready || capturing}
              activeOpacity={0.9}
            >
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Atrás</Text>
        </TouchableOpacity>
      </BlurView>

      {/* Guide modal */}
      <Modal visible={showGuide} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <BlurView intensity={60} tint="dark" style={styles.modalCard}>
            <Text style={styles.modalTitle}>Guía de captura óptima</Text>
            <FlagStripe height={2} marginVertical={8} />
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setGuidePage(Math.round(e.nativeEvent.contentOffset.x / (width * 0.8)))
              }
              style={{ width: width * 0.8 }}
            >
              {[
                { icon: '📋', title: 'Superficie plana',      body: 'Coloca el acta sobre una mesa firme. No la sostengas en el aire.' },
                { icon: '💡', title: 'Buena iluminación',     body: 'Usa luz natural o artificial directa. Evita sombras sobre el acta.' },
                { icon: '📐', title: 'Encuadre completo',     body: 'El acta entera debe estar visible dentro del marco, sin cortar bordes.' },
              ].map((step, i) => (
                <View key={i} style={styles.guidePage}>
                  <Text style={styles.guideIcon}>{step.icon}</Text>
                  <Text style={styles.guideStepTitle}>{step.title}</Text>
                  <Text style={styles.guideStepBody}>{step.body}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.dots}>
              {[0, 1, 2].map(i => (
                <View key={i} style={[styles.dot, guidePage === i && styles.dotActive]} />
              ))}
            </View>
            <TouchableOpacity onPress={handleGuideClose} style={styles.guideBtn}>
              <LinearGradient
                colors={[Colors.red, '#9A0B22']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.guideBtnGrad}
              >
                <Text style={styles.guideBtnText}>Entendido, capturar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: FRAME_W,
    height: FRAME_H,
    borderWidth: 2,
    borderColor: Colors.gold,
    borderRadius: Radius.lg,
  },
  corner: {
    position: 'absolute',
    width: 20, height: 20,
    borderColor: Colors.gold,
    borderWidth: 3,
    borderRadius: 3,
  },
  hintContainer: { position: 'absolute', top: 56, alignSelf: 'center' },
  hintBlur: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hintText: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' },
  indicators: { position: 'absolute', right: 12, top: '30%', gap: 10 },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingBottom: 40, paddingTop: 20,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  mesaLabel: { ...Typography.caption, color: Colors.textSecondary, width: 80, textAlign: 'left' },
  captureWrapper: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 84, height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    opacity: 0.8,
  },
  captureBtn: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: Colors.indicatorOff,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  captureBtnReady: { backgroundColor: Colors.red, borderColor: Colors.gold },
  captureBtnInner: {
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  backBtn: { width: 80, alignItems: 'flex-end' },
  backText: { ...Typography.caption, color: Colors.textSecondary },
  permContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: 16,
  },
  permTitle: { ...Typography.title, color: Colors.textPrimary, textAlign: 'center' },
  permBody:  { ...Typography.body,  color: Colors.textSecondary, textAlign: 'center' },
  permBtn:   { backgroundColor: Colors.red, borderRadius: Radius.xl, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  permBtnText: { ...Typography.subtitle, color: Colors.textPrimary },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  modalCard: {
    width: width * 0.9,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { ...Typography.subtitle, color: Colors.textPrimary },
  guidePage: {
    width: width * 0.8,
    alignItems: 'center',
    padding: Spacing.lg,
    gap: 12,
  },
  guideIcon:      { fontSize: 56 },
  guideStepTitle: { ...Typography.subtitle, color: Colors.textPrimary },
  guideStepBody:  { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  dots:    { flexDirection: 'row', gap: 6, marginTop: 8 },
  dot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.indicatorOff },
  dotActive: { backgroundColor: Colors.gold, width: 16 },
  guideBtn: { width: '100%', marginTop: Spacing.md },
  guideBtnGrad: { borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center' },
  guideBtnText: { ...Typography.subtitle, color: Colors.textPrimary },
});
