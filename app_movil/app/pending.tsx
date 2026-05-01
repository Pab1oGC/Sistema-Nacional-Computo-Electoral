import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { FlagStripe } from '../components/FlagStripe';
import { useAppStore, PendingSubmission } from '../store/appStore';

// ─── Network check (same as form.tsx) ────────────────────────────────────────

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

// ─── Pending card ─────────────────────────────────────────────────────────────

function PendingCard({
  item,
  onSync,
  syncing,
}: {
  item: PendingSubmission;
  onSync: () => void;
  syncing: boolean;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const dt   = new Date(item.createdAt);
  const hora = dt.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  const fecha = dt.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const totalVotos = Object.values(item.votos).reduce((s, v) => s + (parseInt(v) || 0), 0);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.mesaCode}>Mesa {item.codigoMesa}</Text>
          <Text style={styles.timestamp}>{fecha} · {hora}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.metaItem}>
              Hab. <Text style={styles.metaValue}>{item.habilitados || '—'}</Text>
            </Text>
            <Text style={styles.metaItem}>
              Votos <Text style={styles.metaValue}>{totalVotos}</Text>
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={onSync}
          disabled={syncing}
          activeOpacity={0.8}
        >
          <Text style={styles.syncBtnText}>{syncing ? '...' : '↑'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PendingScreen() {
  const router  = useRouter();
  const store   = useAppStore();

  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncingAll, setSyncingAll] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  async function syncItem(item: PendingSubmission) {
    const online = await checkIsOnline();
    if (!online) {
      return false;
    }
    // Simulate API call
    await new Promise<void>((r) => setTimeout(r, 1500));
    store.incrementCounter();
    const estado = store.getSimulatedEstado() ?? 'VALIDADA';
    store.addToHistorial({
      id:         Date.now().toString() + item.id,
      codigoMesa: item.codigoMesa,
      timestamp:  new Date(),
      estado,
      tipo:       'formulario',
    });
    await store.removePendingItem(item.id);
    return true;
  }

  async function handleSyncOne(item: PendingSubmission) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSyncingIds((prev) => new Set([...prev, item.id]));
    const ok = await syncItem(item);
    setSyncingIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
    if (!ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessCount((c) => c + 1);
    }
  }

  async function handleSyncAll() {
    if (syncingAll) return;
    const online = await checkIsOnline();
    if (!online) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncingAll(true);
    const items = [...store.pendingQueue];
    let count = 0;
    for (const item of items) {
      setSyncingIds((prev) => new Set([...prev, item.id]));
      await syncItem(item);
      setSyncingIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
      count++;
    }
    setSuccessCount((c) => c + count);
    setSyncingAll(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  const isEmpty = store.pendingQueue.length === 0;

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
        <Text style={styles.title}>Envíos pendientes</Text>
        <Text style={styles.subtitle}>Sin conexión al momento de enviar</Text>
        <FlagStripe height={2} marginVertical={12} />

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: Colors.warning + '44' }]}>
            <Text style={[styles.statCount, { color: Colors.warning }]}>{store.pendingQueue.length}</Text>
            <Text style={styles.statLabel}>PENDIENTE{store.pendingQueue.length !== 1 ? 'S' : ''}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: Colors.success + '44' }]}>
            <Text style={[styles.statCount, { color: Colors.success }]}>{successCount}</Text>
            <Text style={styles.statLabel}>ENVIADO{successCount !== 1 ? 'S' : ''}</Text>
          </View>
        </View>
      </View>

      {isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>Todo enviado</Text>
          <Text style={styles.emptyBody}>No hay envíos pendientes en esta sesión</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={store.pendingQueue}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <PendingCard
                item={item}
                onSync={() => handleSyncOne(item)}
                syncing={syncingIds.has(item.id)}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />

          {/* Sync all button */}
          <View style={styles.syncAllBar}>
            <TouchableOpacity
              onPress={handleSyncAll}
              activeOpacity={0.85}
              disabled={syncingAll}
            >
              <LinearGradient
                colors={syncingAll
                  ? [Colors.surface, Colors.surface]
                  : [Colors.green, '#005A25']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.syncAllBtn}
              >
                <Text style={styles.syncAllText}>
                  {syncingAll
                    ? 'Sincronizando...'
                    : `Sincronizar todos (${store.pendingQueue.length})`
                  }
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: 0 },
  back:   { marginBottom: Spacing.sm },
  backText: { ...Typography.caption, color: Colors.textSecondary },
  title:    { ...Typography.title, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  statCount: { fontSize: 20, fontWeight: '700', fontFamily: 'monospace' },
  statLabel: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 2 },

  list: { padding: Spacing.lg, gap: 10, paddingBottom: 120 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardLeft:  { gap: 4, flex: 1 },
  mesaCode:  { fontFamily: 'monospace', fontSize: 18, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 1 },
  timestamp: { ...Typography.caption, color: Colors.textSecondary },
  cardMeta:  { flexDirection: 'row', gap: 16, marginTop: 4 },
  metaItem:  { ...Typography.caption, color: Colors.textSecondary },
  metaValue: { color: Colors.gold, fontWeight: '700' },

  syncBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },
  syncBtnDisabled: { backgroundColor: Colors.indicatorOff },
  syncBtnText: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },

  syncAllBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: Spacing.lg,
    paddingBottom: 40,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  syncAllBtn:  { borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  syncAllText: { ...Typography.subtitle, color: Colors.textPrimary, letterSpacing: 0.5 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: Spacing.xl },
  emptyIcon:  { fontSize: 52 },
  emptyTitle: { ...Typography.subtitle, color: Colors.textPrimary },
  emptyBody:  { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
});
