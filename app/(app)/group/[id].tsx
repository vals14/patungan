import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Share, ScrollView, Modal, TextInput, useWindowDimensions, Platform,
} from 'react-native'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../../src/context/AuthContext'
import { useGroups } from '../../../src/context/GroupsContext'
import { Group } from '../../../src/types/database'
import {
  getGroupById, getGroupMembers, getMemberDisplayName,
  addManualMember, updateMemberName, removeMember,
} from '../../../src/services/groupService'
import { getGroupExpenses } from '../../../src/services/expenseService'
import {
  computeMemberBalances, computeSettlementPlan, MemberBalance, SettlementTransfer,
} from '../../../src/services/balanceService'
import {
  getSettlements, recordSettlement, undoSettlement, PayMethod,
} from '../../../src/services/settlementService'
import { SettleSheet } from '../../../src/components/SettleSheet'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#F7F4EC', ink: '#14140F', lime: '#B7F84A', coral: '#FF6B4A',
  white: '#FFFFFF', muted1: '#8B8576', muted2: '#9A9484',
  border: '#EFE9DC', inputBorder: '#E7E1D2', onDark: '#8E968A',
  positive: '#1E7A46', negative: '#E0452A',
  amber: '#FEC84B', mutedTile: '#C9C3B4',
}
const SG7 = 'SpaceGrotesk_700Bold'
const PJ5 = 'PlusJakartaSans_500Medium'
const PJ6 = 'PlusJakartaSans_600SemiBold'
const PJ7 = 'PlusJakartaSans_700Bold'

const TILE_PALETTE = [
  { bg: '#B7F84A', text: '#14140F' }, { bg: '#FF6B4A', text: '#ffffff' },
  { bg: '#14140F', text: '#B7F84A' }, { bg: '#FEC84B', text: '#14140F' },
  { bg: '#C9C3B4', text: '#14140F' }, { bg: '#8B8576', text: '#ffffff' },
]

const CURRENCY_NAMES: Record<string, string> = {
  IDR: 'Rupiah', USD: 'Dollar', EUR: 'Euro', SGD: 'Dollar',
  MYR: 'Ringgit', GBP: 'Pound', AUD: 'Dollar', JPY: 'Yen', THB: 'Baht',
}

// ── SVG icon helper (web only) ────────────────────────────────────────────────
function SvgIcon({ paths, size = 19, color = '#A39C8B', cx, cy, r }: {
  paths?: string[]; size?: number; color?: string; cx?: number; cy?: number; r?: number
}) {
  if (Platform.OS !== 'web') return null
  const El: any = 'svg'; const P: any = 'path'; const Ci: any = 'circle'
  return (
    <El width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}>
      {paths?.map((d, i) => <P key={i} d={d} />)}
      {cx != null && <Ci cx={cx} cy={cy} r={r} />}
    </El>
  )
}
const ICO = {
  home:     ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5'],
  activity: ['M3 12h4l2.5 6 5-14L17 12h4'],
  profile:  ['M5.5 20a6.5 6.5 0 0 1 13 0'],
  link:     ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
             'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  logout:   ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
}

// Per-category icon + pastel tile background, matching the design mockups.
const CAT_STYLE: Record<string, { emoji: string; bg: string }> = {
  Food:          { emoji: '🍜', bg: '#FBDAD9' },
  Accommodation: { emoji: '🏠', bg: '#D9EFC6' },
  Transport:     { emoji: '🛵', bg: '#E6E3F0' },
  Activity:      { emoji: '🏄', bg: '#FCE7B6' },
  Shopping:      { emoji: '🛍️', bg: '#E4DDF6' },
  Other:         { emoji: '✦', bg: '#ECE6D7' },
}

function fmtShort(d: string) {
  try {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return d }
}

function fmtAmt(amount: number, currency: string) {
  if (currency === 'IDR') return 'Rp ' + Math.round(amount).toLocaleString('id-ID')
  return currency + ' ' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type TabKey = 'expenses' | 'balances' | 'settle'

// ── Component ─────────────────────────────────────────────────────────────────
export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, signOut } = useAuth()
  const { width } = useWindowDimensions()
  const isWide = width >= 900

  const { refresh: refreshGroups } = useGroups()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [myBalance, setMyBalance] = useState(0)
  const [memberBalances, setMemberBalances] = useState<MemberBalance[]>([])
  const [totalSpend, setTotalSpend] = useState(0)
  const [settlements, setSettlements] = useState<any[]>([])
  const [plan, setPlan] = useState<SettlementTransfer[]>([])
  const [settleTarget, setSettleTarget] = useState<SettlementTransfer | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<TabKey>('expenses')
  const [showMembersSheet, setShowMembersSheet] = useState(false)
  const [memberEditOpen, setMemberEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [manualName, setManualName] = useState('')
  const [addingManual, setAddingManual] = useState(false)
  const [toast, setToast] = useState('')

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [g, m, exps] = await Promise.all([
        getGroupById(id),
        getGroupMembers(id),
        getGroupExpenses(id),
      ])
      // Settlements are non-fatal: until migration 0005 retargets the FK, the join
      // hint errors — degrade to an empty list so balances still render.
      let setls: any[] = []
      try { setls = await getSettlements(id) } catch { setls = [] }
      setGroup(g)
      setMembers(m)
      setExpenses(exps)
      setSettlements(setls)

      // Compute net balances from the freshly loaded data so the balance card and
      // the Balances/Settle tabs always agree (one formula via balanceService).
      const memberLites = m.map((mm: any) => ({ id: mm.id, name: getMemberDisplayName(mm) }))
      const settleRows = setls.map((s: any) => ({
        from_user: s.from_member?.id, to_user: s.to_member?.id, amount: s.amount,
      }))
      const { members: bals, totalGroupSpend } = computeMemberBalances(memberLites, exps as any, settleRows)
      setMemberBalances(bals)
      setTotalSpend(totalGroupSpend)
      setPlan(computeSettlementPlan(bals))
      const myMemberId = m.find((mm: any) => mm.user?.id === user?.id)?.id
      setMyBalance(bals.find(b => b.memberId === myMemberId)?.net ?? 0)
    } catch {
      router.push('/(app)/home')
    } finally {
      setLoading(false)
    }
  }, [id, user?.id])

  // Refetch whenever the screen regains focus (e.g. returning from Add expense).
  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function handleShareInvite() {
    if (!group) return
    const text = `Join "${group.name}" on Patungan! Code: ${group.invite_code}`
    if (Platform.OS === 'web') {
      try { await (navigator as any).clipboard.writeText(text) } catch {}
      flash('Invite link copied!')
    } else {
      Share.share({ message: text })
    }
  }

  async function handleAddManual() {
    if (!manualName.trim()) { flash('Enter a name first'); return }
    setAddingManual(true)
    try {
      await addManualMember(id, manualName.trim())
      flash(manualName.trim() + ' added')
      setManualName('')
      await loadData()
    } catch (e: any) {
      flash(e.message ?? 'Could not add member')
    } finally {
      setAddingManual(false)
    }
  }

  function startEdit(member: any) {
    setEditingId(member.id)
    setEditingName(getMemberDisplayName(member))
  }

  async function saveEdit() {
    if (!editingName.trim() || !editingId) return
    try {
      await updateMemberName(editingId, editingName.trim())
      setEditingId(null)
      setEditingName('')
      await loadData()
      flash('Renamed')
    } catch (e: any) { flash(e.message) }
  }

  async function handleRemove(member: any) {
    try {
      await removeMember(member.id)
      await loadData()
      flash('Member removed')
    } catch (e: any) { flash(e.message) }
  }

  function closeMembersSheet() {
    setShowMembersSheet(false)
    setMemberEditOpen(false)
    setEditingId(null)
    setManualName('')
  }

  async function handleConfirmSettle(method: PayMethod) {
    if (!settleTarget) return
    try {
      await recordSettlement(id, settleTarget.fromMemberId, settleTarget.toMemberId, settleTarget.amount, method)
      setSettleTarget(null)
      flash('Payment recorded')
      await loadData()
      refreshGroups()
    } catch (e: any) { flash(e.message) }
  }

  async function handleUndo(settlementId: string) {
    try {
      await undoSettlement(settlementId)
      flash('Settlement undone')
      await loadData()
      refreshGroups()
    } catch (e: any) { flash(e.message) }
  }

  if (loading) {
    return <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={C.lime} /></View>
  }
  if (!group) return null

  const groupInitial = group.name.charAt(0).toUpperCase()
  const groupTile = TILE_PALETTE[0]
  const displayName = user?.display_name ?? ''
  const userInitial = displayName.charAt(0).toUpperCase()
  const balColor = myBalance > 0 ? C.lime : myBalance < 0 ? '#FF7A60' : C.onDark
  const balStr = myBalance !== 0
    ? `${myBalance > 0 ? '+ ' : '− '}${group.currency} ${Math.abs(myBalance).toLocaleString()}`
    : 'Settled up'

  // ── Members sheet ────────────────────────────────────────────────────────────
  const MembersSheet = (
    <Modal visible={showMembersSheet} transparent animationType="slide" onRequestClose={closeMembersSheet}>
      <View style={s.sheetOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeMembersSheet} />
        <View style={[s.sheet, isWide && s.sheetWide]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Add members</Text>
          <Text style={s.sheetSub}>Invite people to {group.name}</Text>

          {/* Members row header */}
          <View style={s.membersSectionHeader}>
            <Text style={s.membersSectionLabel}>MEMBERS · {members.length}</Text>
            <TouchableOpacity
              style={s.editPill}
              onPress={() => { setMemberEditOpen(p => !p); setEditingId(null) }}
            >
              <Text style={s.editPillText}>✏️ Edit</Text>
            </TouchableOpacity>
          </View>

          {!memberEditOpen ? (
            <View style={s.avatarRow}>
              {members.map((m, i) => {
                const t = TILE_PALETTE[i % TILE_PALETTE.length]
                return (
                  <View key={m.id} style={[s.avatarOverlap, { backgroundColor: t.bg }]}>
                    <Text style={[s.avatarOverlapText, { color: t.text }]}>
                      {getMemberDisplayName(m).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              {members.map((m, i) => {
                const t = TILE_PALETTE[i % TILE_PALETTE.length]
                const name = getMemberDisplayName(m)
                const isEditing = editingId === m.id
                const isCurrentUser = !!m.user_id && m.user_id === user?.id
                return (
                  <View key={m.id} style={[s.memberEditRow, isEditing && s.memberEditRowActive]}>
                    <View style={[s.memberAvatarSm, { backgroundColor: t.bg }]}>
                      <Text style={[s.memberAvatarSmText, { color: t.text }]}>
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    {isEditing ? (
                      <>
                        <TextInput
                          style={s.memberEditInput}
                          value={editingName}
                          onChangeText={setEditingName}
                          autoFocus
                          onSubmitEditing={saveEdit}
                        />
                        <TouchableOpacity style={s.saveBtn} onPress={saveEdit}>
                          <Text style={s.saveBtnText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.iconCircle} onPress={() => setEditingId(null)}>
                          <Text style={{ color: C.muted2, fontSize: 13 }}>✕</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={s.memberEditName} numberOfLines={1}>{name}</Text>
                        <TouchableOpacity style={s.iconCircle} onPress={() => startEdit(m)}>
                          <Text style={{ fontSize: 13 }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.iconCircle}
                          onPress={() => !isCurrentUser && handleRemove(m)}
                          disabled={isCurrentUser}
                        >
                          <Text style={{ color: isCurrentUser ? C.mutedTile : C.negative, fontSize: 13 }}>✕</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )
              })}
            </ScrollView>
          )}

          {/* Invite options — hidden when editing */}
          {!memberEditOpen && (
            <>
              <TouchableOpacity style={[s.inviteRow, { marginTop: 20 }]} onPress={handleShareInvite}>
                <View style={[s.inviteIcon, { backgroundColor: C.lime }]}><Text style={{ fontSize: 22 }}>🔗</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inviteTitle}>Share invite link</Text>
                  <Text style={s.inviteSub}>Anyone with the link can join</Text>
                </View>
                <Text style={s.inviteArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.inviteRow, { marginTop: 10 }]} onPress={() => flash('Contacts — coming soon')}>
                <View style={[s.inviteIcon, { backgroundColor: C.ink }]}><Text style={{ fontSize: 22 }}>👥</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inviteTitle}>Add from contacts</Text>
                  <Text style={s.inviteSub}>Search by name or phone number</Text>
                </View>
                <Text style={s.inviteArrow}>›</Text>
              </TouchableOpacity>

              <View style={[s.inviteRow, { marginTop: 10, flexDirection: 'column', gap: 12, alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                  <View style={[s.inviteIcon, { backgroundColor: C.amber }]}><Text style={{ fontSize: 22 }}>✏️</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.inviteTitle}>Add manually</Text>
                    <Text style={s.inviteSub}>Just a name — no email needed</Text>
                  </View>
                </View>
                <View style={s.manualRow}>
                  <TextInput
                    style={s.manualInput}
                    placeholder="Enter a name"
                    placeholderTextColor={C.muted2}
                    value={manualName}
                    onChangeText={setManualName}
                    onSubmitEditing={handleAddManual}
                  />
                  <TouchableOpacity
                    style={[s.manualAddBtn, addingManual && { opacity: 0.6 }]}
                    onPress={handleAddManual}
                    disabled={addingManual}
                  >
                    <Text style={s.manualAddBtnText}>{addingManual ? '…' : 'Add'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <TouchableOpacity onPress={closeMembersSheet} style={{ marginTop: 18, alignItems: 'center' }}>
            <Text style={{ fontFamily: PJ7, fontSize: 14, color: C.muted2 }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  // ── Segmented tab bar ────────────────────────────────────────────────────────
  const TABS: TabKey[] = ['expenses', 'balances', 'settle']
  const TabBar = (
    <View style={s.tabTrack}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab}
          style={[s.tabItem, activeTab === tab && s.tabItemActive]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[s.tabItemText, activeTab === tab && s.tabItemTextActive]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
    return (
      <View style={s.emptyTab}>
        <Text style={s.emptyTabIcon}>{icon}</Text>
        <Text style={s.emptyTabTitle}>{title}</Text>
        <Text style={s.emptyTabSub}>{sub}</Text>
      </View>
    )
  }

  const ExpenseList = (
    <View style={{ gap: isWide ? 12 : 10 }}>
      {expenses.length === 0 ? (
        <EmptyState icon="🧾" title="No expenses yet" sub="Tap + Add expense to record the first one." />
      ) : (
        expenses.map(exp => {
          const payer = exp.paid_by_member
          const isMe = !!payer?.user?.id && payer.user.id === user?.id
          const payerName = isMe ? 'You' : (payer?.user?.display_name ?? payer?.name ?? '?')
          const payerFirst = payerName.split(' ')[0]
          const payerIdx = members.findIndex(m => m.id === exp.paid_by)
          const tile = TILE_PALETTE[(payerIdx < 0 ? 0 : payerIdx) % TILE_PALETTE.length]
          const splitCount = (exp.expense_splits ?? []).length
          const catStyle = CAT_STYLE[exp.category] ?? CAT_STYLE.Other
          const showFx = exp.currency !== group.currency
          const fxLine = showFx
            ? `≈ ${fmtAmt(Number(exp.amount_in_group_currency ?? exp.total_amount), group.currency)}`
            : null
          const onPress = () => router.push({
            pathname: '/(app)/expense/new',
            params: { groupId: id, expenseId: exp.id },
          })

          if (isWide) {
            return (
              <TouchableOpacity key={exp.id} style={s.expCard} activeOpacity={0.85} onPress={onPress}>
                <View style={[s.expTile, { backgroundColor: catStyle.bg }]}>
                  <Text style={s.expTileEmoji}>{catStyle.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.expCardTitle} numberOfLines={1}>{exp.title}</Text>
                  <View style={s.expTitleMetaRow}>
                    <View style={s.catPill}><Text style={s.catPillText}>{exp.category}</Text></View>
                    <Text style={s.expDate}>{fmtShort(exp.date ?? exp.created_at?.split('T')[0])}</Text>
                  </View>
                </View>
                <View style={s.payerBlock}>
                  <View style={[s.payerAvatar, { backgroundColor: tile.bg }]}>
                    <Text style={[s.payerAvatarText, { color: tile.text }]}>{payerName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={s.paidByLabel}>Paid by</Text>
                    <Text style={s.payerName} numberOfLines={1}>{payerName}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                  <Text style={s.expCardAmt}>{fmtAmt(exp.total_amount, exp.currency)}</Text>
                  {fxLine && <Text style={s.expFx}>{fxLine}</Text>}
                </View>
              </TouchableOpacity>
            )
          }

          // Mobile
          return (
            <TouchableOpacity key={exp.id} style={s.expCardM} activeOpacity={0.85} onPress={onPress}>
              <View style={[s.expTile, { backgroundColor: catStyle.bg }]}>
                <Text style={s.expTileEmoji}>{catStyle.emoji}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.expCardTitle} numberOfLines={1}>{exp.title}</Text>
                <Text style={s.expMetaM} numberOfLines={1}>
                  {isMe ? 'You paid' : `${payerFirst} paid`} · {fmtShort(exp.date ?? exp.created_at?.split('T')[0])}
                </Text>
                <View style={[s.catPill, s.catPillM]}><Text style={s.catPillText}>{exp.category}</Text></View>
              </View>
              <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                <Text style={s.expCardAmtM}>{fmtAmt(exp.total_amount, exp.currency)}</Text>
                {fxLine && <Text style={s.expFx}>{fxLine}</Text>}
                <Text style={s.splitMeta}>split : {splitCount} members</Text>
              </View>
            </TouchableOpacity>
          )
        })
      )}
    </View>
  )

  // ── Balances tab: total spend + per-member share bar + net ──────────────────
  const BalancesContent = totalSpend === 0 ? (
    <EmptyState icon="⚖️" title="No balances yet" sub="Add expenses to see who owes whom." />
  ) : (
    <View style={{ gap: 10 }}>
      <View style={s.spendCard}>
        <Text style={s.spendLabel}>Total group spend</Text>
        <Text style={s.spendValue}>{fmtAmt(totalSpend, group.currency)}</Text>
      </View>
      {memberBalances.map((b, idx) => {
        const pct = totalSpend > 0 ? Math.round((b.paidTotal / totalSpend) * 100) : 0
        const t = TILE_PALETTE[idx % TILE_PALETTE.length]
        const netColor = b.net > 0 ? C.positive : b.net < 0 ? C.negative : C.muted1
        const netLabel = b.net > 0
          ? `gets back ${fmtAmt(Math.abs(b.net), group.currency)}`
          : b.net < 0
            ? `owes ${fmtAmt(Math.abs(b.net), group.currency)}`
            : 'settled up'
        return (
          <View key={b.memberId} style={s.balRow}>
            <View style={s.balRowTop}>
              <View style={s.balRowLeft}>
                <View style={[s.balAvatar, { backgroundColor: t.bg }]}>
                  <Text style={[s.balAvatarText, { color: t.text }]}>{b.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={s.balName} numberOfLines={1}>{b.name}</Text>
              </View>
              <Text style={[s.balNet, { color: netColor }]}>{netLabel}</Text>
            </View>
            <View style={s.barTrack}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
            <Text style={s.balPaid}>paid {fmtAmt(b.paidTotal, group.currency)} · {pct}% of spend</Text>
          </View>
        )
      })}
    </View>
  )

  // ── Settle tab: greedy settle-up plan + already-settled list with undo ───────
  const SettleContent = (plan.length === 0 && settlements.length === 0) ? (
    <EmptyState icon="✅" title="Nothing to settle" sub="All members are settled up." />
  ) : (
    <View style={{ gap: 10 }}>
      {plan.length > 0 && (
        <>
          <Text style={s.settleHeading}>Simplest way to settle up</Text>
          <Text style={s.settleSub}>{plan.length} transfer{plan.length !== 1 ? 's' : ''} to clear all debts</Text>
          {plan.map((t, idx) => (
            <View key={idx} style={s.settleRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.settleText} numberOfLines={1}>
                  <Text style={s.settleName}>{t.fromName}</Text>
                  <Text style={s.settleArrow}>  →  </Text>
                  <Text style={s.settleName}>{t.toName}</Text>
                </Text>
                <Text style={s.settleAmount}>{fmtAmt(t.amount, group.currency)}</Text>
              </View>
              <TouchableOpacity style={s.settleBtn} onPress={() => setSettleTarget(t)}>
                <Text style={s.settleBtnText}>Settle</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
      {settlements.length > 0 && (
        <View style={{ marginTop: plan.length > 0 ? 14 : 0, gap: 8 }}>
          <Text style={s.settleHeading}>Already settled</Text>
          {settlements.map((st: any) => {
            const fromN = st.from_member?.user?.display_name ?? st.from_member?.name ?? '?'
            const toN = st.to_member?.user?.display_name ?? st.to_member?.name ?? '?'
            return (
              <View key={st.id} style={s.settledRow}>
                <Text style={s.settledText} numberOfLines={1}>
                  {fromN} paid {toN} · {String(st.method).replace('_', ' ')}
                </Text>
                <TouchableOpacity onPress={() => handleUndo(st.id)}>
                  <Text style={s.undoText}>Undo</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )

  const TabContent = (
    <View style={{ flex: 1 }}>
      {activeTab === 'expenses' && ExpenseList}
      {activeTab === 'balances' && BalancesContent}
      {activeTab === 'settle' && SettleContent}
    </View>
  )

  const settleSheetEl = (
    <SettleSheet
      transfer={settleTarget}
      currency={group.currency}
      onClose={() => setSettleTarget(null)}
      onConfirm={handleConfirmSettle}
    />
  )

  // ── Toast ───────────────────────────────────────────────────────────────────
  const Toast = toast ? (
    <View style={s.toast} pointerEvents="none">
      <Text style={s.toastText}>{toast}</Text>
    </View>
  ) : null

  // ── Mobile layout ────────────────────────────────────────────────────────────
  if (!isWide) {
    return (
      <View style={s.root}>
        {Toast}

        {/* Header bar */}
        <View style={s.mobileHeader}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/(app)/home')}>
            <Text style={s.iconBtnText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => flash('Group settings')}>
            <Text style={[s.iconBtnText, { letterSpacing: 1 }]}>⋯</Text>
          </TouchableOpacity>
        </View>

        {/* Group identity row */}
        <View style={s.mobileGroupRow}>
          <View style={[s.groupTileLg, { backgroundColor: groupTile.bg }]}>
            <Text style={[s.groupTileLgText, { color: groupTile.text }]}>{groupInitial}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.mobileGroupName} numberOfLines={1}>{group.name}</Text>
            <View style={s.mobileGroupMeta}>
              <Text style={s.mobileGroupMetaText}>{members.length} members · {group.currency}</Text>
              <TouchableOpacity style={s.membersPill} onPress={() => setShowMembersSheet(true)}>
                <Text style={s.membersPillText}>+ Members</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Balance card */}
        <View style={s.balCard}>
          <View style={s.balCardGlow} />
          <View>
            <Text style={s.balCardLabel}>Your balance in this group</Text>
            <Text style={[s.balCardAmt, { color: balColor }]}>{balStr}</Text>
          </View>
          <TouchableOpacity style={s.currChip}>
            <Text style={s.currCode}>{group.currency}</Text>
            <Text style={s.currName}>{CURRENCY_NAMES[group.currency] ?? ''}</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={{ paddingHorizontal: 22, marginTop: 16 }}>{TabBar}</View>

        {/* Scrollable content */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 22, paddingBottom: 100 }}>
          {TabContent}
        </ScrollView>

        {/* Add expense bar (expenses tab only) */}
        {activeTab === 'expenses' && (
          <View style={s.addExpenseBar}>
            <TouchableOpacity style={s.addExpenseBtn} onPress={() => router.push({ pathname: '/(app)/expense/new', params: { groupId: id } })}>
              <Text style={s.addExpenseBtnText}>+ Add expense</Text>
            </TouchableOpacity>
          </View>
        )}

        {MembersSheet}
        {settleSheetEl}
      </View>
    )
  }

  // ── Web layout ───────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {Toast}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.mainWebContent}>

        {/* Top bar: breadcrumb + actions */}
        <View style={s.webTopBar}>
          <View style={s.breadcrumb}>
            <TouchableOpacity style={s.backBtnWeb} onPress={() => router.push('/(app)/home')}>
              <Text style={s.backBtnWebText}>←</Text>
            </TouchableOpacity>
            <Text style={s.breadcrumbText}>
              <Text style={s.breadcrumbLink} onPress={() => router.push('/(app)/home')}>Home</Text>
              {'  /  '}
              <Text style={s.breadcrumbCurrent}>{group.name}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity style={s.addExpBtnWeb} onPress={() => router.push({ pathname: '/(app)/expense/new', params: { groupId: id } })}>
              <Text style={s.addExpBtnWebText}>+ Add expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuBtnWeb} onPress={() => flash('Group settings')}>
              <Text style={[s.iconBtnText, { letterSpacing: 1, color: C.ink }]}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero card */}
        <View style={s.webHero}>
          <View style={s.heroGlow} />

          {/* Left: tile + name + avatars */}
          <View style={s.webHeroLeft}>
            <View style={[s.groupTileXl, { backgroundColor: groupTile.bg }]}>
              <Text style={[s.groupTileXlText, { color: groupTile.text }]}>{groupInitial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.webHeroName} numberOfLines={1}>{group.name}</Text>
              <Text style={s.webHeroMeta}>{members.length} members · {group.currency}</Text>
              <View style={s.webAvatarRow}>
                {members.slice(0, 6).map((m, i) => {
                  const t = TILE_PALETTE[i % TILE_PALETTE.length]
                  return (
                    <View key={m.id} style={[s.avatarOverlapWeb, { backgroundColor: t.bg }]}>
                      <Text style={[s.avatarOverlapText, { color: t.text, fontSize: 12 }]}>
                        {getMemberDisplayName(m).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )
                })}
                <TouchableOpacity
                  style={[s.membersPill, { marginLeft: 18 }]}
                  onPress={() => setShowMembersSheet(true)}
                >
                  <Text style={s.membersPillText}>+ Members</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Right: balance + currency chip */}
          <View style={s.webHeroRight}>
            <View>
              <Text style={s.balCardLabel}>Your balance in this group</Text>
              <Text style={[s.webHeroBalance, { color: balColor }]}>{balStr}</Text>
            </View>
            <TouchableOpacity style={s.currChip}>
              <Text style={s.currCode}>{group.currency}</Text>
              <Text style={s.currName}>{CURRENCY_NAMES[group.currency] ?? ''}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs + content */}
        <View style={{ marginTop: 26 }}>{TabBar}</View>
        <View style={{ marginTop: 18 }}>{TabContent}</View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {MembersSheet}
      {settleSheetEl}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Balances tab
  spendCard:   { backgroundColor: C.ink, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 4 },
  spendLabel:  { fontFamily: PJ6, fontSize: 12, color: C.onDark },
  spendValue:  { fontFamily: SG7, fontSize: 24, color: C.lime, letterSpacing: -0.4, marginTop: 4 },
  balRow:      { backgroundColor: C.white, borderRadius: 16, padding: 14 },
  balRowTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 },
  balRowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  balAvatar:   { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  balAvatarText: { fontFamily: SG7, fontSize: 13 },
  balName:     { fontFamily: PJ7, fontSize: 14, color: C.ink, flexShrink: 1 },
  balNet:      { fontFamily: SG7, fontSize: 13, flexShrink: 0 },
  barTrack:    { height: 8, borderRadius: 4, backgroundColor: C.bg, overflow: 'hidden' },
  barFill:     { height: 8, borderRadius: 4, backgroundColor: C.lime },
  balPaid:     { fontFamily: PJ5, fontSize: 12, color: C.muted1, marginTop: 8 },

  // Settle tab
  settleHeading: { fontFamily: PJ7, fontSize: 15, color: C.ink },
  settleSub:     { fontFamily: PJ5, fontSize: 13, color: C.muted1, marginTop: -4, marginBottom: 2 },
  settleRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 },
  settleText:    { fontFamily: PJ6, fontSize: 14, color: C.ink },
  settleName:    { fontFamily: PJ7, fontSize: 14, color: C.ink },
  settleArrow:   { fontFamily: PJ6, fontSize: 14, color: C.muted1 },
  settleAmount:  { fontFamily: SG7, fontSize: 15, color: C.ink, marginTop: 3 },
  settleBtn:     { backgroundColor: C.lime, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, flexShrink: 0 },
  settleBtnText: { fontFamily: SG7, fontSize: 14, color: C.ink },
  settledRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: C.white, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  settledText:   { fontFamily: PJ6, fontSize: 13, color: C.muted1, flex: 1, minWidth: 0 },
  undoText:      { fontFamily: PJ7, fontSize: 13, color: C.coral, flexShrink: 0 },

  // Toast
  toast:     { position: 'absolute', top: 28, left: '50%' as any, transform: [{ translateX: -100 }], zIndex: 80, backgroundColor: C.ink, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 30 },
  toastText: { fontFamily: PJ6, fontSize: 13.5, color: C.bg },

  // ── Mobile header ──────────────────────────────────────────────────────────
  mobileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 56, paddingBottom: 8 },
  iconBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.inputBorder, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontFamily: SG7, fontSize: 18, color: C.ink },

  // ── Group identity row (mobile) ────────────────────────────────────────────
  mobileGroupRow:  { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 22, marginTop: 14 },
  groupTileLg:     { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  groupTileLgText: { fontFamily: SG7, fontSize: 22 },
  mobileGroupName: { fontFamily: SG7, fontSize: 22, color: C.ink, letterSpacing: -0.4 },
  mobileGroupMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  mobileGroupMetaText: { fontFamily: PJ5, fontSize: 13, color: C.muted2 },

  // + Members pill
  membersPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.lime, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, flexShrink: 0 },
  membersPillText: { fontFamily: PJ7, fontSize: 11, color: C.ink },

  // ── Balance card ──────────────────────────────────────────────────────────
  balCard:      { backgroundColor: C.ink, borderRadius: 18, padding: 16, marginHorizontal: 22, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', position: 'relative' },
  balCardGlow:  { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: C.lime, opacity: 0.2, top: -60, right: -40 },
  balCardLabel: { fontFamily: PJ6, fontSize: 12, color: C.onDark },
  balCardAmt:   { fontFamily: SG7, fontSize: 24, letterSpacing: -0.6, marginTop: 4 },
  currChip:     { backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignItems: 'center', minWidth: 61 },
  currCode:     { fontFamily: SG7, fontSize: 13, color: C.white, lineHeight: 16 },
  currName:     { fontFamily: PJ5, fontSize: 10, color: C.onDark, marginTop: 1, lineHeight: 12 },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabTrack:        { flexDirection: 'row', gap: 4, backgroundColor: '#ECE6D7', borderRadius: 13, padding: 4 },
  tabItem:         { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive:   { backgroundColor: C.white, shadowColor: C.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, borderBottomColor: C.coral },
  tabItemText:     { fontFamily: PJ6, fontSize: 13.5, color: C.muted2 },
  tabItemTextActive: { color: C.ink },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyTab:      { alignItems: 'center', paddingVertical: 48 },
  emptyTabIcon:  { fontSize: 36, marginBottom: 12 },
  emptyTabTitle: { fontFamily: PJ7, fontSize: 15, color: C.ink, marginBottom: 6 },
  emptyTabSub:   { fontFamily: PJ5, fontSize: 13, color: C.muted2, textAlign: 'center' },

  // ── Expense cards (shared) ────────────────────────────────────────────────
  expTile:      { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  expTileEmoji: { fontSize: 24 },
  expCardTitle: { fontFamily: PJ7, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
  catPill:      { alignSelf: 'flex-start', backgroundColor: '#FCE2D9', paddingHorizontal: 11, paddingVertical: 4, borderRadius: 20 },
  catPillText:  { fontFamily: PJ6, fontSize: 12.5, color: '#26201D' },
  expFx:        { fontFamily: PJ5, fontSize: 11, color: C.muted2, marginTop: 2 },

  // Web expense card
  expCard:        { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.white, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 },
  expTitleMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 7 },
  expDate:        { fontFamily: PJ5, fontSize: 14, color: C.muted2 },
  payerBlock:     { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, width: 160 },
  payerAvatar:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  payerAvatarText:{ fontFamily: SG7, fontSize: 14 },
  paidByLabel:    { fontFamily: PJ5, fontSize: 12, color: C.muted2 },
  payerName:      { fontFamily: PJ7, fontSize: 14, color: C.ink, marginTop: 1 },
  expCardAmt:     { fontFamily: SG7, fontSize: 19, color: C.ink, letterSpacing: -0.4 },

  // Mobile expense card
  expCardM:     { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: C.white, borderRadius: 18, padding: 14, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8 },
  expMetaM:     { fontFamily: PJ5, fontSize: 12.5, color: C.muted2, marginTop: 3, marginBottom: 8 },
  catPillM:     { paddingHorizontal: 10, paddingVertical: 3 },
  expCardAmtM:  { fontFamily: SG7, fontSize: 16, color: C.ink, letterSpacing: -0.3 },
  splitMeta:    { fontFamily: PJ5, fontSize: 11.5, color: C.muted2, marginTop: 5 },

  // ── Add expense bar (mobile) ──────────────────────────────────────────────
  addExpenseBar: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 8, backgroundColor: C.bg },
  addExpenseBtn: { height: 54, borderRadius: 16, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', shadowColor: C.lime, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 14 },
  addExpenseBtnText: { fontFamily: SG7, fontSize: 16, color: C.ink },

  // ── Members sheet ─────────────────────────────────────────────────────────
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,15,.45)' },
  sheet:        { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  sheetWide:    { borderRadius: 24, marginHorizontal: 'auto' as any, width: 460, marginBottom: 40, alignSelf: 'center' as any },
  sheetHandle:  { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D8D1C0', alignSelf: 'center', marginBottom: 18 },
  sheetTitle:   { fontFamily: SG7, fontSize: 20, color: C.ink, letterSpacing: -0.4, textAlign: 'center' },
  sheetSub:     { fontFamily: PJ5, fontSize: 13, color: C.muted1, marginTop: 5, textAlign: 'center' },
  membersSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  membersSectionLabel:  { fontFamily: PJ7, fontSize: 11, color: C.muted2, letterSpacing: 0.6, textTransform: 'uppercase' as any },
  editPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EDF7D6', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  editPillText: { fontFamily: PJ7, fontSize: 12, color: C.ink },
  avatarRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  avatarOverlap:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: C.bg },
  avatarOverlapText: { fontFamily: SG7, fontSize: 14 },
  // editable member rows
  memberEditRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.inputBorder, borderRadius: 13, marginBottom: 6 },
  memberEditRowActive: { borderColor: C.ink },
  memberAvatarSm:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  memberAvatarSmText:  { fontFamily: SG7, fontSize: 13 },
  memberEditName:      { flex: 1, fontFamily: PJ6, fontSize: 13.5, color: C.ink },
  memberEditInput:     { flex: 1, height: 36, borderWidth: 1.5, borderColor: C.inputBorder, borderRadius: 10, paddingHorizontal: 10, fontFamily: PJ6, fontSize: 13.5, color: C.ink, backgroundColor: C.bg },
  saveBtn:      { flexShrink: 0, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, backgroundColor: C.ink },
  saveBtnText:  { fontFamily: PJ7, fontSize: 12.5, color: C.white },
  iconCircle:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.inputBorder, backgroundColor: C.bg, flexShrink: 0 },
  // invite options
  inviteRow:    { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.inputBorder, borderRadius: 18, padding: 17 },
  inviteIcon:   { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inviteTitle:  { fontFamily: PJ7, fontSize: 15, color: C.ink },
  inviteSub:    { fontFamily: PJ5, fontSize: 12.5, color: C.muted2, marginTop: 2 },
  inviteArrow:  { fontSize: 18, color: C.muted2, flexShrink: 0 },
  manualRow:    { flexDirection: 'row', gap: 9 },
  manualInput:  { flex: 1, height: 46, borderWidth: 1.5, borderColor: C.inputBorder, borderRadius: 13, paddingHorizontal: 15, fontFamily: PJ6, fontSize: 14.5, color: C.ink, backgroundColor: C.bg },
  manualAddBtn: { flexShrink: 0, height: 46, paddingHorizontal: 20, borderRadius: 13, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  manualAddBtnText: { fontFamily: PJ7, fontSize: 14.5, color: C.white },

  // ── Web main content ──────────────────────────────────────────────────────
  mainWebContent: { paddingHorizontal: 44, paddingVertical: 30 },

  // top bar
  webTopBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  breadcrumb:    { flexDirection: 'row', alignItems: 'center', gap: 13, minWidth: 0 },
  backBtnWeb:    { width: 42, height: 42, borderRadius: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backBtnWebText:{ fontFamily: SG7, fontSize: 19, color: C.ink },
  breadcrumbText:{ fontFamily: PJ6, fontSize: 14, color: C.muted2 },
  breadcrumbLink:{ color: C.muted2 },
  breadcrumbCurrent: { color: C.ink },
  addExpBtnWeb:  { flexDirection: 'row', alignItems: 'center', gap: 7, height: 46, paddingHorizontal: 18, borderRadius: 14, backgroundColor: C.ink },
  addExpBtnWebText: { fontFamily: PJ7, fontSize: 14.5, color: C.white },
  menuBtnWeb:    { width: 46, height: 46, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

  // web hero
  webHero:      { backgroundColor: C.ink, borderRadius: 24, padding: 30, paddingHorizontal: 34, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 26, overflow: 'hidden', position: 'relative' },
  heroGlow:     { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: C.lime, opacity: 0.22, top: -150, right: -50, pointerEvents: 'none' as any },
  webHeroLeft:  { flexDirection: 'row', alignItems: 'center', gap: 18, flex: 1, minWidth: 260 },
  groupTileXl:  { width: 66, height: 66, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  groupTileXlText: { fontFamily: SG7, fontSize: 30 },
  webHeroName:  { fontFamily: SG7, fontSize: 30, color: C.white, letterSpacing: -0.6 },
  webHeroMeta:  { fontFamily: PJ5, fontSize: 14, color: C.onDark, marginTop: 3 },
  webAvatarRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13 },
  avatarOverlapWeb:  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: C.ink },
  webHeroRight: { alignItems: 'flex-start', gap: 6, marginLeft: 'auto' as any },
  webHeroBalance: { fontFamily: SG7, fontSize: 42, letterSpacing: -1, marginTop: 6 },
})
