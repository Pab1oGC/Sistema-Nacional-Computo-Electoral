import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { FlagStripe } from '../components/FlagStripe';
import { useAppStore } from '../store/appStore';

// ─── Constants ───────────────────────────────────────────────────────────────

const PARTIES = [
  { key: 'mas',   label: 'MAS-IPSP'  },
  { key: 'cc',    label: 'CC'        },
  { key: 'apb',   label: 'APB'       },
  { key: 'mnr',   label: 'MNR'       },
  { key: 'ucs',   label: 'UCS'       },
  { key: 'fpv',   label: 'FPV'       },
  { key: 'otros', label: 'OTROS'     },
];

type Phase = 'form' | 'submitting' | 'done' | 'offline';

// ─── Network check ───────────────────────────────────────────────────────────

async function checkIsOnline(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 3000);
    const res  = await fetch('https://connectivity-check.gstatic.com/generate_204', {
      method: 'HEAD',
      cache:  'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    return res.status === 204;
  } catch {
    return false;
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VoteRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.voteRow}>
      <Text style={styles.voteLabel}>{label}</Text>
      <TextInput
        style={styles.voteInput}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="0"
        placeholderTextColor={Colors.textSecondary}
        selectTextOnFocus
      />
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FormScreen() {
  const router = useRouter();
  const store  = useAppStore();

  const [phase,       setPhase]       = useState<Phase>('form');
  const [isOnline,    setIsOnline]    = useState<boolean | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [habilitados, setHabilitados] = useState('');
  const [blanco,      setBlanco]      = useState('');
  const [nulos,       setNulos]       = useState('');
  const [votos, setVotos]             = useState<Record<string, string>>(
    Object.fromEntries(PARTIES.map((p) => [p.key, '']))
  );

  // Result card animation
  const resultScale = useRef(new Animated.Value(0.5)).current;
  const resultOp    = useRef(new Animated.Value(0)).current;
  // Online banner slide
  const bannerY     = useRef(new Animated.Value(-40)).current;

  // Check connectivity on mount
  useEffect(() => {
    checkIsOnline().then((online) => {
      setIsOnline(online);
      if (!online) {
        Animated.spring(bannerY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start();
      }
    });
  }, []);

  const setVoto = useCallback(
    (key: string) => (val: string) => setVotos((prev) => ({ ...prev, [key]: val })),
    []
  );

  const totalPartidos = PARTIES.reduce((s, p) => s + (parseInt(votos[p.key]) || 0), 0);
  const totalBlanco   = parseInt(blanco) || 0;
  const totalNulos    = parseInt(nulos)  || 0;
  const totalEmitidos = totalPartidos + totalBlanco + totalNulos;
  const habNum        = parseInt(habilitados) || 0;
  const overLimit     = habNum > 0 && totalEmitidos > habNum;

  function validate(): boolean {
    if (!habilitados.trim() || habNum < 1) {
      Alert.alert('Habilitados', 'Ingresa el número de votantes habilitados en esta mesa.');
      return false;
    }
    if (totalEmitidos < 1) {
      Alert.alert('Votos', 'Debes ingresar al menos un voto en alguna categoría.');
      return false;
    }
    if (overLimit) {
      Alert.alert(
        'Error de validación',
        `Los votos emitidos (${totalEmitidos}) superan los habilitados (${habNum}).`
      );
      return false;
    }
    return true;
  }

  function animateResult() {
    Animated.parallel([
      Animated.spring(resultScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(resultOp,    { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const online = await checkIsOnline();
    setIsOnline(online);

    if (online) {
      // Simulate API call
      await new Promise<void>((r) => setTimeout(r, 2500));
      store.incrementCounter();
      const estado = store.getSimulatedEstado() ?? 'VALIDADA';
      store.addToHistorial({
        id:         Date.now().toString(),
        codigoMesa: store.codigoMesa,
        timestamp:  new Date(),
        estado,
        tipo:       'formulario',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitting(false);
      setPhase('done');
      animateResult();
    } else {
      await store.addToPendingQueue({
        codigoMesa:        store.codigoMesa,
        codigoRecinto:     store.codigoRecinto,
        codigoTerritorial: store.codigoTerritorial,
        habilitados,
        votos:             { ...votos, blanco, nulos },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setSubmitting(false);
      setPhase('offline');
      animateResult();
    }
  }

  function handleFinish() {
    router.replace('/setup');
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <LinearGradient
      colors={[Colors.bg, Colors.surface]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* Offline banner */}
      {isOnline === false && phase === 'form' && (
        <Animated.View style={[styles.offlineBanner, { transform: [{ translateY: bannerY }] }]}>
          <Text style={styles.offlineBannerText}>
            Sin conexión · Los datos se guardarán localmente
          </Text>
        </Animated.View>
      )}

      {/* ── RESULT PHASES ────────────────────────────────── */}
      {(phase === 'done' || phase === 'offline') && (
        <View style={styles.resultContainer}>
          <Animated.View style={[styles.resultBox, { opacity: resultOp, transform: [{ scale: resultScale }] }]}>
            {phase === 'done' ? (
              <>
                <View style={[styles.resultIcon, { backgroundColor: Colors.success + '22', borderColor: Colors.success }]}>
                  <Text style={styles.resultEmoji}>✅</Text>
                </View>
                <Text style={[styles.resultTitle, { color: Colors.success }]}>DATOS ENVIADOS</Text>
                <Text style={styles.resultBody}>
                  Los datos del acta han sido registrados y procesados correctamente.
                </Text>
                <Text style={styles.mesaTag}>Mesa {store.codigoMesa}</Text>
                <FlagStripe height={2} marginVertical={12} />
                <TouchableOpacity onPress={handleFinish} activeOpacity={0.85}>
                  <LinearGradient
                    colors={[Colors.green, '#005A25']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.resultBtn}
                  >
                    <Text style={styles.resultBtnText}>Volver al inicio</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.resultIcon, { backgroundColor: Colors.warning + '22', borderColor: Colors.warning }]}>
                  <Text style={styles.resultEmoji}>⏳</Text>
                </View>
                <Text style={[styles.resultTitle, { color: Colors.warning }]}>GUARDADO LOCALMENTE</Text>
                <Text style={styles.resultBody}>
                  Sin conexión. Los datos se enviarán automáticamente cuando haya señal.
                </Text>
                <Text style={styles.mesaTag}>Mesa {store.codigoMesa}</Text>
                <FlagStripe height={2} marginVertical={12} />
                <View style={styles.resultRow}>
                  <TouchableOpacity
                    style={styles.pendingBtn}
                    onPress={() => router.replace('/pending')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pendingBtnText}>Ver cola</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleFinish} style={{ flex: 1 }} activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#6B5B00', '#4A3D00']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.resultBtn}
                    >
                      <Text style={styles.resultBtnText}>Ir al inicio</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      )}

      {/* ── SUBMITTING ───────────────────────────────────── */}
      {phase === 'submitting' && (
        <View style={styles.resultContainer}>
          <View style={styles.loadingBox}>
            <Text style={styles.loadingIcon}>📡</Text>
            <Text style={styles.loadingText}>
              {isOnline === null ? 'Verificando conexión...' : 'Enviando datos al servidor...'}
            </Text>
          </View>
        </View>
      )}

      {/* ── FORM ─────────────────────────────────────────── */}
      {phase === 'form' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              isOnline === false && { paddingTop: Spacing.xxl + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Text style={styles.backText}>← Atrás</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Datos del Acta</Text>
              <Text style={styles.subtitle}>Mesa {store.codigoMesa}</Text>
              <FlagStripe height={2} marginVertical={12} />
            </View>

            {/* Mesa info chip */}
            <View style={styles.mesaChip}>
              <Text style={styles.mesaChipCode}>
                Mesa {store.codigoMesa} · Recinto {store.codigoRecinto}
              </Text>
              <Text style={styles.mesaChipSub} numberOfLines={1}>
                Territorial: {store.codigoTerritorial}
              </Text>
            </View>

            {/* Habilitados */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>HABILITADOS</Text>
              <TextInput
                style={styles.input}
                value={habilitados}
                onChangeText={setHabilitados}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="Total de votantes habilitados"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            {/* Party votes */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>VOTOS POR ORGANIZACIÓN</Text>
              {PARTIES.map((p) => (
                <VoteRow
                  key={p.key}
                  label={p.label}
                  value={votos[p.key]}
                  onChange={setVoto(p.key)}
                />
              ))}

              <View style={styles.divider} />

              <VoteRow label="Blancos"  value={blanco} onChange={setBlanco} />
              <VoteRow label="Nulos"    value={nulos}  onChange={setNulos}  />

              {/* Total */}
              <View style={[styles.totalRow, overLimit && styles.totalRowError]}>
                <Text style={styles.totalLabel}>TOTAL EMITIDOS</Text>
                <Text style={[styles.totalValue, overLimit && { color: Colors.error }]}>
                  {totalEmitidos} / {habNum || '—'}
                </Text>
              </View>
              {overLimit && (
                <Text style={styles.errorHint}>
                  ⚠ Los votos superan los habilitados
                </Text>
              )}
            </View>

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
              style={{ marginTop: Spacing.md, marginBottom: Spacing.xl }}
            >
              <LinearGradient
                colors={isOnline === false
                  ? ['#6B5B00', '#4A3D00']
                  : [Colors.red, '#9A0B22']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitBtn}
              >
                <Text style={styles.submitBtnText}>
                  {isOnline === false ? '💾 Guardar offline' : 'Enviar datos →'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  offlineBanner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: Colors.warning,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    paddingTop: 44,
  },
  offlineBannerText: {
    ...Typography.caption,
    color: '#000',
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.xxl + 8,
    gap: Spacing.md,
  },
  header: { gap: 4 },
  backBtn:  { marginBottom: Spacing.sm },
  backText: { ...Typography.caption, color: Colors.textSecondary },
  title:    { ...Typography.title, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },

  mesaChip: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(244,196,48,0.2)',
    gap: 4,
  },
  mesaChipCode: { ...Typography.code, color: Colors.gold, fontWeight: '700' },
  mesaChipSub:  { ...Typography.caption, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 4,
  },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244,196,48,0.25)',
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    letterSpacing: 1,
  },

  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  voteLabel: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  voteInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244,196,48,0.2)',
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 88,
    textAlign: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  totalRowError: { borderTopColor: Colors.error + '44' },
  totalLabel: { ...Typography.caption, color: Colors.textSecondary, letterSpacing: 1, fontWeight: '700' },
  totalValue: { ...Typography.codeL, color: Colors.gold },
  errorHint:  { ...Typography.caption, color: Colors.error, marginTop: 4 },

  submitBtn:     { borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { ...Typography.subtitle, color: Colors.textPrimary, letterSpacing: 0.5 },

  // Result / loading
  resultContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  loadingBox: { alignItems: 'center', gap: 16 },
  loadingIcon: { fontSize: 52 },
  loadingText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },

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
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, marginBottom: 4,
  },
  resultEmoji: { fontSize: 36 },
  resultTitle: { ...Typography.title, letterSpacing: 1 },
  resultBody:  { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  mesaTag: {
    ...Typography.code,
    color: Colors.gold,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  resultBtn:     { borderRadius: Radius.xl, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', minWidth: 160 },
  resultBtnText: { ...Typography.subtitle, color: Colors.textPrimary },
  resultRow:     { flexDirection: 'row', gap: 12, width: '100%', alignItems: 'center' },
  pendingBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
  },
  pendingBtnText: { ...Typography.body, color: Colors.warning, fontWeight: '600' },
});
