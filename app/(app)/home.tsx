import { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, ScrollView,
  RefreshControl, useWindowDimensions, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { useGroups } from '../../src/context/GroupsContext'
import { createGroup, deleteGroup, GroupWithBalance } from '../../src/services/groupService'

// ── SVG icon helpers (web only — bell icon in header) ─────────────────────────
function SvgIcon({ paths, size = 19, color = '#A39C8B' }: {
  paths?: string[]; size?: number; color?: string
}) {
  if (Platform.OS !== 'web') return null
  const El: any = 'svg'; const P: any = 'path'
  return (
    <El width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}>
      {paths?.map((d, i) => <P key={i} d={d} />)}
    </El>
  )
}
const BELL = ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0']

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#F7F4EC', ink: '#14140F', lime: '#B7F84A', coral: '#FF6B4A',
  white: '#FFFFFF', muted1: '#8B8576', muted2: '#9A9484',
  border: '#EFE9DC', inputBorder: '#E7E1D2', onDark: '#8E968A',
  positive: '#1E7A46', negative: '#E0452A', amber: '#FEC84B', mutedTile: '#C9C3B4',
}

const SG7 = 'SpaceGrotesk_700Bold'
const PJ5 = 'PlusJakartaSans_500Medium'
const PJ6 = 'PlusJakartaSans_600SemiBold'
const PJ7 = 'PlusJakartaSans_700Bold'

function fmtCur(cur: string, n: number): string {
  if (cur === 'IDR') return 'Rp ' + Math.round(n).toLocaleString('id-ID')
  return cur + ' ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TILE_PALETTE = [
  { bg: '#B7F84A', text: '#14140F' }, { bg: '#FF6B4A', text: '#ffffff' },
  { bg: '#14140F', text: '#B7F84A' }, { bg: '#FEC84B', text: '#14140F' },
  { bg: '#C9C3B4', text: '#14140F' }, { bg: '#8B8576', text: '#ffffff' },
]

const CURRENCIES = [
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'USD', symbol: '$',  name: 'US Dollar' },
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,'
}

function chunkArray<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user } = useAuth()
  const { groups: contextGroups, loading, refresh: refreshGroups } = useGroups()
  const { width } = useWindowDimensions()
  const isWide = width >= 900

  const [refreshing, setRefreshing] = useState(false)
  const [hideBalance, setHideBalance] = useState(false)

  // create modal
  const [showCreate, setShowCreate] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [currency, setCurrency] = useState('IDR')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // delete mode — use a local filter for optimistic removal
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const groups = contextGroups.filter(g => !deletedIds.has(g.group.id))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshGroups()
    setRefreshing(false)
  }, [refreshGroups])

  // Balances are each in their group's own currency — never sum across currencies.
  const byCurrency: Record<string, { owed: number; owe: number }> = {}
  groups.forEach(g => {
    const cur = g.group.currency
    if (!byCurrency[cur]) byCurrency[cur] = { owed: 0, owe: 0 }
    if (g.myBalance > 0) byCurrency[cur].owed += g.myBalance
    else if (g.myBalance < 0) byCurrency[cur].owe += Math.abs(g.myBalance)
  })
  const balanceCurrencies = Object.keys(byCurrency).sort()
  const singleCur = balanceCurrencies.length <= 1 ? (balanceCurrencies[0] ?? 'IDR') : null

  const mask = (v: string) => hideBalance ? '••••••' : v

  const displayName = user?.display_name ?? ''
  const initial = displayName.charAt(0).toUpperCase()

  // ── Create group ─────────────────────────────────────────────────────────────
  async function handleCreate() {
    setCreateError('')
    if (!groupName.trim()) { setCreateError('Please enter a group name.'); return }
    setCreating(true)
    try {
      const g = await createGroup(groupName.trim(), currency)
      setShowCreate(false); setGroupName(''); setCurrency('IDR')
      await refreshGroups()
      router.push(`/(app)/group/${g.id}`)
    } catch (e: any) {
      setCreateError(e.message ?? 'Something went wrong.')
    } finally { setCreating(false) }
  }

  function openCreate() { setGroupName(''); setCurrency('IDR'); setCreateError(''); setShowCreate(true) }

  // ── Delete mode ──────────────────────────────────────────────────────────────
  function enterDeleteMode() { setDeleteMode(true); setSelectedIds(new Set()) }
  function cancelDeleteMode() { setDeleteMode(false); setSelectedIds(new Set()) }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function confirmDelete() {
    if (selectedIds.size === 0) return
    setDeleting(true)
    setDeletedIds(prev => new Set([...prev, ...selectedIds]))
    try {
      await Promise.all([...selectedIds].map(id => deleteGroup(id)))
    } catch {
      setDeletedIds(new Set())
    } finally {
      setDeleting(false)
      setDeleteMode(false)
      setSelectedIds(new Set())
      setDeletedIds(new Set())
      await refreshGroups()
    }
  }

  // ── Shared JSX blocks ────────────────────────────────────────────────────────
  const BalanceHero = (
    <View style={s.hero}>
      <View style={s.heroGlow} />
      <View style={s.heroTopRow}>
        <Text style={s.heroLabel}>Your total balance</Text>
        <TouchableOpacity style={s.hidePill} onPress={() => setHideBalance(h => !h)}>
          <Text style={s.hidePillText}>{hideBalance ? 'Show' : 'Hide'}</Text>
        </TouchableOpacity>
      </View>

      {singleCur ? (() => {
        const bc = byCurrency[singleCur] ?? { owed: 0, owe: 0 }
        const net = bc.owed - bc.owe
        const netStr = net > 0 ? `+ ${fmtCur(singleCur, net)}` : net < 0 ? `− ${fmtCur(singleCur, Math.abs(net))}` : fmtCur(singleCur, 0)
        return (
          <>
            <Text style={s.heroAmount}>{mask(netStr)}</Text>
            <View style={s.statPanel}>
              <View style={s.statCol}>
                <View style={s.statRow}>
                  <View style={[s.dot, { backgroundColor: C.lime }]} />
                  <Text style={s.statLabel}>Owed to you</Text>
                </View>
                <Text style={[s.statAmt, { color: C.lime }]}>{mask(fmtCur(singleCur, bc.owed))}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCol}>
                <View style={s.statRow}>
                  <View style={[s.dot, { backgroundColor: C.coral }]} />
                  <Text style={s.statLabel}>You owe</Text>
                </View>
                <Text style={[s.statAmt, { color: C.coral }]}>{mask(fmtCur(singleCur, bc.owe))}</Text>
              </View>
            </View>
          </>
        )
      })() : (
        <View style={s.multiCurWrap}>
          {balanceCurrencies.map(cur => {
            const bc = byCurrency[cur]
            const net = bc.owed - bc.owe
            const col = net > 0 ? C.lime : net < 0 ? C.coral : C.white
            const netStr = net > 0 ? `+ ${fmtCur(cur, net)}` : net < 0 ? `− ${fmtCur(cur, Math.abs(net))}` : fmtCur(cur, 0)
            return (
              <View key={cur} style={s.multiCurRow}>
                <Text style={s.multiCurCode}>{cur}</Text>
                <Text style={[s.multiCurAmt, { color: col }]}>{mask(netStr)}</Text>
              </View>
            )
          })}
          <Text style={s.multiCurNote}>Shown per currency — balances in different currencies aren't combined.</Text>
        </View>
      )}
    </View>
  )

  function GroupCard({ item, index }: { item: GroupWithBalance; index: number }) {
    const tile = TILE_PALETTE[index % TILE_PALETTE.length]
    const b = item.myBalance
    const bColor = b > 0 ? C.positive : b < 0 ? C.negative : C.muted2
    const bAmt = b !== 0 ? `${item.group.currency} ${Math.abs(b).toLocaleString()}` : 'Settled'
    const bLabel = b > 0 ? 'owes you' : b < 0 ? 'you owe' : 'all clear'
    const isSelected = selectedIds.has(item.group.id)

    return (
      <TouchableOpacity
        style={[s.groupCard, isWide && s.groupCardWeb, deleteMode && isSelected && s.groupCardSelected]}
        activeOpacity={0.75}
        onPress={() => {
          if (deleteMode) { toggleSelect(item.group.id) }
          else { router.push(`/(app)/group/${item.group.id}`) }
        }}
      >
        {deleteMode && (
          <View style={[s.selectCircle, isSelected && s.selectCircleOn]}>
            {isSelected && <Text style={s.selectCheck}>✓</Text>}
          </View>
        )}
        <View style={[s.groupTile, { backgroundColor: tile.bg }]}>
          <Text style={[s.groupTileText, { color: tile.text }]}>
            {item.group.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={s.groupInfo}>
          <Text style={s.groupName} numberOfLines={1}>{item.group.name}</Text>
          <Text style={s.groupMeta}>{item.memberCount} member{item.memberCount !== 1 ? 's' : ''}</Text>
        </View>
        {!deleteMode && (
          <View style={s.groupBalanceBox}>
            <Text style={[s.groupBalAmt, { color: bColor }]}>{mask(bAmt)}</Text>
            <Text style={s.groupBalLabel}>{bLabel}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  const GroupList = (
    <View>
      <View style={s.groupsHeader}>
        {deleteMode ? (
          <>
            <Text style={s.groupsTitle}>
              {selectedIds.size === 0 ? 'Select groups' : `${selectedIds.size} selected`}
            </Text>
            <View style={s.deleteActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={cancelDeleteMode}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.deleteConfirmBtn, selectedIds.size === 0 && s.deleteConfirmBtnOff, deleting && { opacity: 0.6 }]}
                onPress={confirmDelete}
                disabled={selectedIds.size === 0 || deleting}
              >
                <Text style={s.deleteConfirmText}>{deleting ? 'Removing…' : `Remove (${selectedIds.size})`}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={s.groupsTitle}>Your groups</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.addGroupBtn} onPress={openCreate}>
                <Text style={s.addGroupBtnText}>+ New</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.joinGroupBtn} onPress={() => router.push('/(app)/group/join/prompt')}>
                <Text style={s.joinGroupBtnText}>Join</Text>
              </TouchableOpacity>
              {groups.length > 0 && (
                <TouchableOpacity style={s.trashBtn} onPress={enterDeleteMode}>
                  <Text style={s.trashIcon}>🗑</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      {groups.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>No groups yet</Text>
          <Text style={s.emptySub}>Create a group or join one via invite code.</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/group/join/prompt')} style={s.joinLink}>
            <Text style={s.joinLinkText}>Join via invite code →</Text>
          </TouchableOpacity>
        </View>
      ) : isWide ? (
        <View>
          {chunkArray(groups, 4).map((row, ri) => (
            <View key={ri} style={s.groupRow}>
              {row.map((item, ci) => (
                <GroupCard key={item.group.id} item={item} index={ri * 4 + ci} />
              ))}
              {row.length < 4 && Array.from({ length: 4 - row.length }).map((_, fi) => (
                <View key={`fill-${fi}`} style={[s.groupCardWeb, { backgroundColor: 'transparent', borderWidth: 0 }]} />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View>
          {groups.map((item, i) => (
            <GroupCard key={item.group.id} item={item} index={i} />
          ))}
        </View>
      )}
    </View>
  )

  const CreateModal = (
    <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
      <View style={s.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowCreate(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <View>
              <Text style={s.sheetTitle}>New group</Text>
              <Text style={s.sheetSub}>Start splitting expenses together</Text>
            </View>
            <TouchableOpacity style={s.sheetX} onPress={() => setShowCreate(false)}>
              <Text style={{ color: C.muted1, fontSize: 20 }}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.fieldLabel}>Group name</Text>
          <TextInput
            style={s.fieldInput}
            placeholder="e.g. Weekend in Bandung"
            placeholderTextColor={C.muted2}
            value={groupName}
            onChangeText={setGroupName}
            autoFocus
          />

          <Text style={[s.fieldLabel, { marginTop: 22 }]}>Currency</Text>
          <View style={s.currencyGrid}>
            {CURRENCIES.map(c => (
              <TouchableOpacity
                key={c.code}
                style={[s.currencyItem, currency === c.code && s.currencyActive]}
                onPress={() => setCurrency(c.code)}
              >
                <Text style={s.currencySymbol}>{c.symbol}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.currencyCode}>{c.code}</Text>
                  <Text style={s.currencyName} numberOfLines={1}>{c.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {createError ? <Text style={s.errorText}>{createError}</Text> : null}

          <TouchableOpacity
            style={[s.createBtn, groupName.trim() ? s.createBtnOn : s.createBtnOff, creating && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={creating}
          >
            <Text style={s.createBtnText}>{creating ? 'Creating…' : 'Create group'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  if (loading) {
    return <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={C.lime} /></View>
  }

  // ── Web layout ───────────────────────────────────────────────────────────────
  if (isWide) {
    return (
      <View style={s.root}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.mainWebContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={s.webHeader}>
            <View>
              <Text style={s.greetingSub}>{greeting()}</Text>
              <Text style={s.greetingName}>{displayName}</Text>
            </View>
            <View style={s.greetingRight}>
              <TouchableOpacity style={s.bellBtn}>
                <SvgIcon paths={BELL} color={C.ink} size={18} />
                <View style={s.bellDot} />
              </TouchableOpacity>
              <TouchableOpacity style={s.avatarCircle} onPress={() => router.push('/(app)/profile' as any)}>
                <Text style={s.avatarText}>{initial}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {BalanceHero}
          {GroupList}
          <View style={{ height: 32 }} />
        </ScrollView>
        {CreateModal}
      </View>
    )
  }

  // ── Mobile layout ────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <View style={s.glowLime} />
      <View style={s.glowCoral} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.mainMobileContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.lime} />}
      >
        <View style={s.greetingRow}>
          <View>
            <Text style={s.greetingSub}>{greeting()}</Text>
            <Text style={s.greetingName}>{displayName}</Text>
          </View>
          <View style={s.greetingRight}>
            <TouchableOpacity style={s.bellBtn}>
              <Text style={{ fontSize: 16 }}>🔔</Text>
              <View style={s.bellDot} />
            </TouchableOpacity>
            <TouchableOpacity style={s.avatarCircle} onPress={() => router.push('/(app)/profile' as any)}>
              <Text style={s.avatarText}>{initial}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {BalanceHero}
        {GroupList}
        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navTabBtn}>
          <View style={[s.navIcon, { backgroundColor: C.ink }]} />
          <Text style={[s.navTabText, { color: C.ink }]}>Home</Text>
        </TouchableOpacity>
        <View style={s.fabWrap}>
          <TouchableOpacity style={s.fab} onPress={openCreate}>
            <Text style={s.fabText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.navTabBtn}>
          <View style={s.navRing} />
          <Text style={s.navTabText}>Activity</Text>
        </TouchableOpacity>
      </View>
      <View style={s.homeIndicator} />

      {CreateModal}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  glowLime:  { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: C.lime,  opacity: 0.18, top: -100,  left: -80,  pointerEvents: 'none' as any },
  glowCoral: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: C.coral, opacity: 0.12, bottom: -80, right: -60, pointerEvents: 'none' as any },

  mainMobileContent: { paddingHorizontal: 22, paddingTop: 56, paddingBottom: 8 },
  mainWebContent:    { paddingHorizontal: 44, paddingVertical: 34 },

  greetingRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greetingSub:   { fontFamily: PJ5, fontSize: 14, color: C.muted1 },
  greetingName:  { fontFamily: SG7, fontSize: 24, color: C.ink, letterSpacing: -0.4, marginTop: 2 },
  greetingRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  bellBtn:      { width: 44, height: 44, borderRadius: 14, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.inputBorder, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellDot:      { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral, borderWidth: 2, borderColor: C.white },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontFamily: SG7, fontSize: 18, color: C.ink },

  hero:         { backgroundColor: C.ink, borderRadius: 24, padding: 24, marginBottom: 26, overflow: 'hidden', position: 'relative' },
  heroGlow:     { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: C.lime, opacity: 0.22, top: -80, right: -50 },
  heroTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  heroLabel:    { fontFamily: PJ6, fontSize: 13, color: C.onDark },
  hidePill:     { backgroundColor: 'rgba(183,248,74,.14)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  hidePillText: { fontFamily: PJ7, fontSize: 12, color: C.lime },
  heroAmount:   { fontFamily: SG7, fontSize: 40, color: C.white, letterSpacing: -1, marginBottom: 18 },
  statPanel:    { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.06)', borderRadius: 16, padding: 4 },
  statCol:      { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
  statRow:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  statLabel:    { fontFamily: PJ6, fontSize: 12, color: C.onDark },
  statAmt:      { fontFamily: SG7, fontSize: 19 },
  multiCurWrap: { gap: 12, marginTop: 2 },
  multiCurRow:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  multiCurCode: { fontFamily: PJ7, fontSize: 15, color: C.white },
  multiCurAmt:  { fontFamily: SG7, fontSize: 24, letterSpacing: -0.4 },
  multiCurNote: { fontFamily: PJ5, fontSize: 11, color: C.onDark, marginTop: 6, lineHeight: 15 },
  statDivider:  { width: 1, backgroundColor: 'rgba(255,255,255,.1)', marginVertical: 6 },

  groupsHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  groupsTitle:   { fontFamily: SG7, fontSize: 18, color: C.ink },

  addGroupBtn:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.lime },
  addGroupBtnText: { fontFamily: PJ7, fontSize: 13, color: C.ink },
  joinGroupBtn:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.inputBorder },
  joinGroupBtnText: { fontFamily: PJ7, fontSize: 13, color: C.ink },

  trashBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.inputBorder, alignItems: 'center', justifyContent: 'center' },
  trashIcon: { fontSize: 16 },

  deleteActions:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cancelBtn:           { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.inputBorder },
  cancelBtnText:       { fontFamily: PJ6, fontSize: 13, color: C.ink },
  deleteConfirmBtn:    { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 10, backgroundColor: C.negative },
  deleteConfirmBtnOff: { backgroundColor: '#E8C4BD' },
  deleteConfirmText:   { fontFamily: PJ7, fontSize: 13, color: C.white },

  groupCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  groupCardWeb:      { flex: 1, minWidth: 0 },
  groupCardSelected: { borderColor: C.coral, backgroundColor: '#FFF5F3' },
  groupTile:         { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  groupTileText:     { fontFamily: SG7, fontSize: 19 },
  groupInfo:         { flex: 1, minWidth: 0 },
  groupName:         { fontFamily: PJ7, fontSize: 15, color: C.ink, marginBottom: 2 },
  groupMeta:         { fontFamily: PJ5, fontSize: 12.5, color: C.muted2 },
  groupBalanceBox:   { alignItems: 'flex-end', flexShrink: 0 },
  groupBalAmt:       { fontFamily: SG7, fontSize: 15 },
  groupBalLabel:     { fontFamily: PJ5, fontSize: 11.5, color: C.muted2, marginTop: 2 },

  selectCircle:   { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.muted2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  selectCircleOn: { borderColor: C.coral, backgroundColor: C.coral },
  selectCheck:    { color: C.white, fontSize: 13, fontFamily: PJ7, lineHeight: 16 },

  groupRow: { flexDirection: 'row', gap: 14, marginBottom: 14 },

  emptyBox:     { alignItems: 'center', paddingVertical: 40 },
  emptyTitle:   { fontFamily: PJ7, fontSize: 16, color: C.ink, marginBottom: 6 },
  emptySub:     { fontFamily: PJ5, fontSize: 13, color: C.muted2, textAlign: 'center', marginBottom: 16 },
  joinLink:     {},
  joinLinkText: { fontFamily: PJ6, fontSize: 13, color: C.ink, textDecorationLine: 'underline' },

  bottomNav:    { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, paddingBottom: 22, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  navTabBtn:    { alignItems: 'center', gap: 5, width: 48 },
  navIcon:      { width: 18, height: 18, borderRadius: 5 },
  navRing:      { width: 16, height: 16, borderRadius: 8, borderWidth: 2.4, borderColor: C.mutedTile },
  navTabText:   { fontFamily: PJ7, fontSize: 10.5, color: C.muted2 },
  fabWrap:      { width: 58, alignItems: 'center' },
  fab:          { width: 56, height: 56, borderRadius: 28, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginTop: -30, borderWidth: 4, borderColor: C.white, shadowColor: C.lime, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 10 },
  fabText:      { fontFamily: SG7, fontSize: 30, color: C.ink, lineHeight: 34 },
  homeIndicator:{ height: 8, backgroundColor: C.white },

  webHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },

  modalOverlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,15,.45)' },
  sheet:          { backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  sheetHandle:    { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D8D2C2', alignSelf: 'center', marginBottom: 18 },
  sheetHeader:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle:     { fontFamily: SG7, fontSize: 21, color: C.ink, letterSpacing: -0.4 },
  sheetSub:       { fontFamily: PJ5, fontSize: 13.5, color: C.muted1, marginTop: 3 },
  sheetX:         { width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.inputBorder, alignItems: 'center', justifyContent: 'center' },
  fieldLabel:     { fontFamily: PJ7, fontSize: 13, color: C.ink, marginBottom: 8 },
  fieldInput:     { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.inputBorder, borderRadius: 14, padding: 15, fontFamily: PJ6, fontSize: 15, color: C.ink },
  currencyGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  currencyItem:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 13, borderWidth: 1.5, borderColor: C.inputBorder, width: '47%' as any },
  currencyActive: { borderColor: C.ink },
  currencySymbol: { fontFamily: SG7, fontSize: 15, color: C.ink, width: 32 },
  currencyCode:   { fontFamily: PJ7, fontSize: 13, color: C.ink },
  currencyName:   { fontFamily: PJ5, fontSize: 11, color: C.muted2 },
  errorText:      { fontFamily: PJ5, fontSize: 13, color: '#E0452A', marginTop: 8, marginBottom: 4 },
  createBtn:      { marginTop: 26, borderRadius: 16, padding: 16, alignItems: 'center' },
  createBtnOn:    { backgroundColor: C.lime },
  createBtnOff:   { backgroundColor: '#D8E8B0' },
  createBtnText:  { fontFamily: SG7, fontSize: 16, color: C.ink },
})
