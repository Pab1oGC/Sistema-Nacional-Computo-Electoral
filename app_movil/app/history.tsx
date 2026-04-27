import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { FlagStripe } from '../components/FlagStripe';
import { useAppStore, ActaHistorial } from '../store/appStore';

const ESTADO_CONFIG = {
  VALIDADA:  { color: Colors.success, bg: Colors.success  + '22', label: 'VALIDADA'  },
  REVISION:  { color: Colors.warning, bg: Colors.warning  + '22', label: 'REVISIÓN'  },
  RECHAZADA: { color: Colors.error,   bg: Colors.error    + '22', label: 'RECHAZADA' },
} as const;

function ActaCard({ item, index }: { item: ActaHistorial; index: number }) {
  const cfg = ESTADO_CONFIG[item.estado];
  const hora = item.timestamp.toLocaleTimeString('es-BO', {
    hour: '2-digit', minute: '2-digit',
  });
  const fecha = item.timestamp.toLocaleDateString('es-BO', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View style={[styles.card, { borderLeftColor: cfg.color }]}>
        <View style={styles.cardLeft}>
          <Text style={styles.mesaCode}>{item.codigoMesa}</Text>
          <Text style={styles.timestamp}>{fecha} · {hora}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const router   = useRouter();
  const historial = useAppStore((s) => s.historial);

  const totals = {
    VALIDADA:  historial.filter(a => a.estado === 'VALIDADA').length,
    REVISION:  historial.filter(a => a.estado === 'REVISION').length,
    RECHAZADA: historial.filter(a => a.estado === 'RECHAZADA').length,
  };

  return (
    <LinearGradient
      colors={[Colors.bg, Colors.surface]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Historial de envíos</Text>
        <Text style={styles.subtitle}>Esta sesión</Text>
        <FlagStripe height={2} marginVertical={12} />

        {/* Stats */}
        <View style={styles.statsRow}>
          {Object.entries(totals).map(([estado, count]) => {
            const cfg = ESTADO_CONFIG[estado as keyof typeof ESTADO_CONFIG];
            return (
              <View key={estado} style={[styles.statCard, { borderColor: cfg.color + '44' }]}>
                <Text style={[styles.statCount, { color: cfg.color }]}>{count}</Text>
                <Text style={styles.statLabel}>{cfg.label}</Text>
              </View>
            );
          })}
          <View style={[styles.statCard, { borderColor: Colors.textSecondary + '44' }]}>
            <Text style={[styles.statCount, { color: Colors.textPrimary }]}>{historial.length}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
        </View>
      </View>

      {/* List */}
      {historial.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Sin envíos aún</Text>
          <Text style={styles.emptyBody}>
            Las actas que envíes aparecerán aquí
          </Text>
        </View>
      ) : (
        <FlatList
          data={historial}
          keyExtractor={(i) => i.id}
          renderItem={({ item, index }) => <ActaCard item={item} index={index} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 0,
  },
  back: {
    marginBottom: Spacing.sm,
  },
  backText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  title: {
    ...Typography.title,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  statCount: {
    ...Typography.codeL,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  list: {
    padding: Spacing.lg,
    gap: 10,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardLeft: {
    gap: 4,
  },
  mesaCode: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  timestamp: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 52,
  },
  emptyTitle: {
    ...Typography.subtitle,
    color: Colors.textPrimary,
  },
  emptyBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
