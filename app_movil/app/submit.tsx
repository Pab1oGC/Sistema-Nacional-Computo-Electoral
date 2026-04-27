import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSpring,
  withDelay, withSequence, Easing,
  FadeIn, FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius, Animation } from '../constants/theme';
import { Stepper, StepState } from '../components/Stepper';
import { FlagStripe } from '../components/FlagStripe';
import { BoliviaSeal } from '../components/BoliviaSeal';
import { useAppStore, ActaEstado } from '../store/appStore';

const { width, height } = Dimensions.get('window');
type Phase = 'uploading' | 'processing' | 'done';

const PHASE_DURATIONS = {
  uploading:  2500,
  processing: 3000,
};

export default function SubmitScreen() {
  const router = useRouter();
  const store  = useAppStore();

  const [phase,    setPhase]    = useState<Phase>('uploading');
  const [progress, setProgress] = useState(0);
  const [estado,   setEstado]   = useState<ActaEstado>(null);

  // Scan line animation
  const scanY   = useSharedValue(0);
  const scanOp  = useSharedValue(0);
  // Result scale
  const resultScale = useSharedValue(0.5);
  const resultOp    = useSharedValue(0);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value }],
    opacity: scanOp.value,
  }));

  const resultStyle = useAnimatedStyle(() => ({
    transform: [{ scale: resultScale.value }],
    opacity: resultOp.value,
  }));

  function getStepStates(): { state: StepState }[] {
    if (phase === 'uploading')   return [{ state: 'active' }, { state: 'pending' }, { state: 'pending' }];
    if (phase === 'processing')  return [{ state: 'done'   }, { state: 'active'  }, { state: 'pending' }];
    return                              [{ state: 'done'   }, { state: 'done'    }, { state: 'done'    }];
  }

  // Upload progress bar
  useEffect(() => {
    if (phase !== 'uploading') return;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / PHASE_DURATIONS.uploading) * 100);
      setProgress(p);
      if (p >= 100) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  // OCR scan animation
  useEffect(() => {
    if (phase !== 'processing') return;
    scanOp.value = withTiming(1, { duration: 300 });
    scanY.value = withRepeat(
      withTiming(180, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1, true
    );
  }, [phase]);

  // Phase transitions
  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase('processing');
    }, PHASE_DURATIONS.uploading);

    const t2 = setTimeout(() => {
      const result = store.getSimulatedEstado();
      setEstado(result);
      setPhase('done');
      Haptics.notificationAsync(
        result === 'VALIDADA'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );
      resultScale.value = withSpring(1, Animation.spring);
      resultOp.value    = withTiming(1, { duration: Animation.normal });

      // Add to historial
      store.addToHistorial({
        id:         Date.now().toString(),
        codigoMesa: store.codigoMesa,
        timestamp:  new Date(),
        estado:     result ?? 'RECHAZADA',
      });
    }, PHASE_DURATIONS.uploading + PHASE_DURATIONS.processing);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const stepStates = getStepStates();
  const steps = [
    { icon: '☁', label: 'Enviando',    state: stepStates[0].state },
    { icon: '🔍', label: 'OCR',        state: stepStates[1].state },
    { icon: '✓',  label: 'Resultado',  state: stepStates[2].state },
  ];

  function handleFinish() {
    store.setCapturedPhoto(null);
    router.replace('/setup');
  }

  function handleRetry() {
    store.setCapturedPhoto(null);
    router.replace('/camera');
  }

  return (
    <LinearGradient
      colors={[Colors.bg, Colors.surface]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={styles.container}
    >
      {/* Watermark */}
      <View style={styles.watermark} pointerEvents="none">
        <BoliviaSeal size={240} opacity={0.04} />
      </View>

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>
          {phase === 'done' ? 'Proceso completado' : 'Procesando acta...'}
        </Text>
        <FlagStripe height={2} marginVertical={8} />
      </Animated.View>

      {/* Stepper */}
      <Stepper steps={steps} />

      {/* Content by phase */}
      <View style={styles.content}>

        {/* Upload progress */}
        {phase === 'uploading' && (
          <Animated.View entering={FadeIn} style={styles.phaseBox}>
            <Text style={styles.phaseIcon}>☁</Text>
            <Text style={styles.phaseLabel}>Enviando imagen al servidor...</Text>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
          </Animated.View>
        )}

        {/* OCR scan */}
        {phase === 'processing' && store.capturedPhotoUri && (
          <Animated.View entering={FadeIn} style={styles.phaseBox}>
            <Text style={styles.phaseLabel}>Extrayendo datos del acta con OCR...</Text>
            <View style={styles.scanContainer}>
              <Image
                source={{ uri: store.capturedPhotoUri }}
                style={styles.scanPreview}
                resizeMode="cover"
              />
              <Animated.View style={[styles.scanLine, scanStyle]}>
                <LinearGradient
                  colors={['transparent', Colors.gold + 'CC', Colors.gold, Colors.gold + 'CC', 'transparent']}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </Animated.View>
        )}

        {/* Result */}
        {phase === 'done' && estado && (
          <Animated.View style={[styles.resultBox, resultStyle]}>
            {estado === 'VALIDADA' && (
              <>
                <View style={[styles.resultIcon, { backgroundColor: Colors.success + '22', borderColor: Colors.success }]}>
                  <Text style={styles.resultEmoji}>✅</Text>
                </View>
                <Text style={[styles.resultTitle, { color: Colors.success }]}>ACTA VALIDADA</Text>
                <Text style={styles.resultBody}>
                  ¡Acta registrada correctamente! Los datos han sido procesados y validados.
                </Text>
                <Text style={styles.mesaTag}>Mesa {store.codigoMesa}</Text>
                <FlagStripe height={2} marginVertical={12} />
                <TouchableOpacity onPress={handleFinish} activeOpacity={0.85}>
                  <LinearGradient
                    colors={[Colors.green, '#005A25']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.resultBtn}
                  >
                    <Text style={styles.resultBtnText}>Volver al inicio</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {estado === 'REVISION' && (
              <>
                <View style={[styles.resultIcon, { backgroundColor: Colors.warning + '22', borderColor: Colors.warning }]}>
                  <Text style={styles.resultEmoji}>⚠️</Text>
                </View>
                <Text style={[styles.resultTitle, { color: Colors.warning }]}>REVISIÓN MANUAL</Text>
                <Text style={styles.resultBody}>
                  Acta recibida. Algunos datos requieren verificación manual por el equipo electoral.
                </Text>
                <FlagStripe height={2} marginVertical={12} />
                <TouchableOpacity onPress={handleFinish} activeOpacity={0.85}>
                  <LinearGradient
                    colors={['#6B5B00', '#4A3D00']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.resultBtn}
                  >
                    <Text style={styles.resultBtnText}>Volver al inicio</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {estado === 'RECHAZADA' && (
              <>
                <View style={[styles.resultIcon, { backgroundColor: Colors.error + '22', borderColor: Colors.error }]}>
                  <Text style={styles.resultEmoji}>❌</Text>
                </View>
                <Text style={[styles.resultTitle, { color: Colors.error }]}>ACTA RECHAZADA</Text>
                <Text style={styles.resultBody}>
                  La imagen no pudo procesarse correctamente. Verifica que el acta esté bien iluminada y enfocada.
                </Text>
                <FlagStripe height={2} marginVertical={12} />
                <View style={styles.retryRow}>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={handleRetry}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.retryText}>↩ Reintentar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleFinish} style={{ flex: 1 }} activeOpacity={0.85}>
                    <LinearGradient
                      colors={[Colors.red, '#9A0B22']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.resultBtn}
                    >
                      <Text style={styles.resultBtnText}>Ir al inicio</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
  },
  watermark: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  phaseBox: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  phaseIcon: {
    fontSize: 48,
  },
  phaseLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.card,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  progressPct: {
    ...Typography.code,
    color: Colors.gold,
  },
  scanContainer: {
    width: width * 0.75,
    height: 200,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gold + '44',
  },
  scanPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
  },
  resultBox: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 4,
  },
  resultEmoji: {
    fontSize: 36,
  },
  resultTitle: {
    ...Typography.title,
    letterSpacing: 1,
  },
  resultBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  mesaTag: {
    ...Typography.code,
    color: Colors.gold,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  resultBtn: {
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 160,
  },
  resultBtnText: {
    ...Typography.subtitle,
    color: Colors.textPrimary,
  },
  retryRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  retryText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
