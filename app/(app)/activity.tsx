import { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { getActivityFeed, ActivityItem } from '../../src/services/activityService'
import { Colors, Radii, Spacing } from '../../src/theme'

const CAT_STYLE: Record<string, { emoji: string; bg: string }> = {
  Food: { emoji: '🍜', bg: '#FBDAD9' },
  Accommodation: { emoji: '🏠', bg: '#D9EFC6' },
  Transport: { emoji: '🛵', bg: '#E6E3F0' },
  Activity: { emoji: '🏄', bg: '#FCE7B6' },
  Shopping: { emoji: '🛍️', bg: '#E4DDF6' },
  Other: { emoji: '✦', bg: '#ECE6D7' },
}

function fmtAmt(currency: string, n: number): string {
  if (currency === 'IDR') return 'Rp ' + Math.round(n).toLocaleString('id-ID')
  return currency + ' ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7); if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ActivityScreen() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await getActivityFeed())
    } catch {
      /* leave whatever is there */
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  function openItem(item: ActivityItem) {
    if (item.kind === 'expense' && item.expenseId) {
      router.push(
        item.itemized
          ? { pathname: '/(app)/expense/review', params: { groupId: item.groupId, expenseId: item.expenseId } }
          : { pathname: '/(app)/expense/new', params: { groupId: item.groupId, expenseId: item.expenseId } }
      )
    } else {
      router.push(`/(app)/group/${item.groupId}`)
    }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Activity</Text>
        <Text style={s.subtitle}>Recent expenses and settlements across your groups</Text>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={Colors.lime} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyIcon}>🕘</Text>
          <Text style={s.emptyTitle}>No activity yet</Text>
          <Text style={s.emptySub}>Expenses and settlements will show up here.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        >
          {items.map(item => {
            if (item.kind === 'expense') {
              const cat = CAT_STYLE[item.category ?? 'Other'] ?? CAT_STYLE.Other
              return (
                <TouchableOpacity key={item.key} style={s.row} activeOpacity={0.75} onPress={() => openItem(item)}>
                  <View style={[s.tile, { backgroundColor: cat.bg }]}><Text style={s.tileEmoji}>{cat.emoji}</Text></View>
                  <View style={s.mid}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      <Text style={s.actor}>{item.actor}</Text> added “{item.title}”
                    </Text>
                    <Text style={s.rowMeta} numberOfLines={1}>{item.groupName} · {ago(item.at)}</Text>
                  </View>
                  <Text style={s.amount}>{fmtAmt(item.currency, item.amount)}</Text>
                </TouchableOpacity>
              )
            }
            return (
              <TouchableOpacity key={item.key} style={s.row} activeOpacity={0.75} onPress={() => openItem(item)}>
                <View style={[s.tile, { backgroundColor: '#D9EFC6' }]}><Text style={s.tileEmoji}>💸</Text></View>
                <View style={s.mid}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    <Text style={s.actor}>{item.fromName}</Text> paid <Text style={s.actor}>{item.toName}</Text>
                  </Text>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {item.groupName} · {String(item.method).replace('_', ' ')} · {ago(item.at)}
                  </Text>
                </View>
                <Text style={s.amount}>{fmtAmt(item.currency, item.amount)}</Text>
              </TouchableOpacity>
            )
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: Spacing.screenH, paddingTop: 56, paddingBottom: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: Colors.ink, letterSpacing: -0.6 },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13.5, color: Colors.textMuted, marginTop: 4 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 34, marginBottom: 10 },
  emptyTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  emptySub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13.5, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },

  content: { paddingHorizontal: Spacing.screenH, paddingTop: 6, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: Colors.card, borderRadius: Radii.card, padding: 14 },
  tile: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tileEmoji: { fontSize: 20 },
  mid: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14.5, color: Colors.ink },
  actor: { fontFamily: 'PlusJakartaSans_700Bold', color: Colors.ink },
  rowMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: Colors.textMuted, marginTop: 3 },
  amount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: Colors.ink, flexShrink: 0 },
})
