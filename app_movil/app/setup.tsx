import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { BoliviaSeal } from '../components/BoliviaSeal';
import { FlagStripe } from '../components/FlagStripe';
import { useAppStore } from '../store/appStore';

const TERRITORIALES = [
  { codigo: '10101', label: 'La Paz — Murillo — La Paz' },
  { codigo: '20201', label: 'Cochabamba — Cercado — Cochabamba' },
  { codigo: '30301', label: 'Santa Cruz — Andrés Ibáñez — Santa Cruz' },
  { codigo: '40401', label: 'Oruro — Cercado — Oruro' },
  { codigo: '50501', label: 'Potosí — Tomás Frías — Potosí' },
  { codigo: '60601', label: 'Sucre — Oropeza — Sucre' },
  { codigo: '70701', label: 'Tarija — Cercado — Tarija' },
  { codigo: '80801', label: 'Trinidad — Cercado — Trinidad' },
  { codigo: '90901', label: 'Cobija — Nicolás Suárez — Cobija' },
];

export default function SetupScreen() {
  const router     = useRouter();
  const store      = useAppStore();

  const [mesa,       setMesa]       = useState(store.codigoMesa);
  const [recinto,    setRecinto]    = useState(store.codigoRecinto);
  const [territorial, setTerritorial] = useState(store.codigoTerritorial || TERRITORIALES[0].codigo);
  const [showPicker, setShowPicker] = useState(false);

  const selectedLabel = TERRITORIALES.find(t => t.codigo === territorial)?.label ?? territorial;

  function handleContinue() {
    if (!mesa.trim() || mesa.length < 4) {
      Alert.alert('Código de Mesa', 'Ingresa un código de mesa válido (mínimo 4 dígitos).');
      return;
    }
    if (!recinto.trim()) {
      Alert.alert('Código de Recinto', 'Ingresa el código de recinto.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    store.setMesaConfig(mesa.trim(), recinto.trim(), territorial);
    router.push('/camera');
  }

  return (
    <LinearGradient
      colors={[Colors.bg, Colors.surface]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* Watermark */}
      <View style={styles.watermark} pointerEvents="none">
        <BoliviaSeal size={260} opacity={0.05} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
            <BoliviaSeal size={70} opacity={1} />
            <Text style={styles.title}>Configuración de Mesa</Text>
            <Text style={styles.subtitle}>Ingresa los datos de tu mesa electoral</Text>
            <FlagStripe height={2} marginVertical={12} />
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.card}>
            <Text style={styles.fieldLabel}>CÓDIGO DE MESA</Text>
            <TextInput
              style={styles.input}
              value={mesa}
              onChangeText={setMesa}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Ej: 35001"
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>CÓDIGO DE RECINTO</Text>
            <TextInput
              style={styles.input}
              value={recinto}
              onChangeText={setRecinto}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Ej: 1042"
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>DISTRIBUCIÓN TERRITORIAL</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowPicker(!showPicker)}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerText} numberOfLines={1}>{selectedLabel}</Text>
              <Text style={styles.pickerArrow}>{showPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showPicker && (
              <View style={styles.dropdown}>
                {TERRITORIALES.map((t) => (
                  <TouchableOpacity
                    key={t.codigo}
                    style={[styles.dropItem, territorial === t.codigo && styles.dropItemActive]}
                    onPress={() => { setTerritorial(t.codigo); setShowPicker(false); }}
                  >
                    <Text style={[styles.dropText, territorial === t.codigo && { color: Colors.gold }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Info */}
          {store.codigoMesa ? (
            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.infoChip}>
              <Text style={styles.infoText}>
                Mesa guardada anteriormente: <Text style={{ color: Colors.gold }}>{store.codigoMesa}</Text>
              </Text>
            </Animated.View>
          ) : null}

          {/* Button */}
          <Animated.View entering={FadeInDown.delay(400).springify()} style={{ marginTop: Spacing.xl }}>
            <TouchableOpacity onPress={handleContinue} activeOpacity={0.85}>
              <LinearGradient
                colors={[Colors.red, '#9A0B22']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btn}
              >
                <Text style={styles.btnText}>Continuar →</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => router.push('/history')}
            >
              <Text style={styles.historyText}>Ver historial de envíos</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.xxl + 16,
  },
  watermark: {
    position: 'absolute',
    right: -60,
    top: '30%',
    opacity: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: 8,
  },
  title: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginTop: 12,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(248,196,48,0.25)',
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    letterSpacing: 1,
  },
  picker: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(248,196,48,0.25)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  pickerArrow: {
    color: Colors.gold,
    fontSize: 12,
    marginLeft: 8,
  },
  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  dropItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  dropItemActive: {
    backgroundColor: 'rgba(244,196,48,0.1)',
  },
  dropText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  infoChip: {
    backgroundColor: 'rgba(244,196,48,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(244,196,48,0.2)',
  },
  infoText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  btn: {
    borderRadius: Radius.xl,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: {
    ...Typography.subtitle,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  historyBtn: {
    alignItems: 'center',
    marginTop: Spacing.md,
    padding: Spacing.sm,
  },
  historyText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
