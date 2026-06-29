import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, useWindowDimensions, Platform, Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Radii, Spacing, Shadows } from '../../../src/theme'
import { Avatar } from '../../../src/components/Avatar'
import { Toast } from '../../../src/components/Toast'
import { getGroupMembers } from '../../../src/services/groupService'
import {
  createSimpleExpense, updateSimpleExpense, getExpenseById, deleteExpense,
} from '../../../src/services/expenseService'
import { getExchangeRate } from '../../../src/services/ratesService'
import { supabase } from '../../../src/lib/supabase'
import { ExpenseCategory } from '../../../src/types/database'
import { useGroups } from '../../../src/context/GroupsContext'

const CURRENCIES = [
  { code: 'IDR', sym: 'Rp', rate: 1, name: 'Indonesian Rupiah' },
  { code: 'USD', sym: '$', rate: 16000, name: 'US Dollar' },
  { code: 'SGD', sym: 'S$', rate: 12000, name: 'Singapore Dollar' },
  { code: 'EUR', sym: '€', rate: 17500, name: 'Euro' },
  { code: 'AUD', sym: 'A$', rate: 10800, name: 'Australian Dollar' },
]

const CATEGORIES: { key: ExpenseCategory; emoji: string; label: string }[] = [
  { key: 'Food', emoji: '🍜', label: 'Food' },
  { key: 'Accommodation', emoji: '🏠', label: 'Stay' },
  { key: 'Transport', emoji: '🛵', label: 'Transport' },
  { key: 'Activity', emoji: '🏄', label: 'Activity' },
  { key: 'Shopping', emoji: '🛍️', label: 'Shopping' },
  { key: 'Other', emoji: '✦', label: 'Other' },
]

// Format an FX rate with enough precision for both large (e.g. 16000) and tiny
// (e.g. 0.0000833 for IDR->SGD) values, trimming trailing zeros.
function formatRate(r: number): string {
  if (r >= 100) return String(Math.round(r))
  if (r >= 1) return String(Number(r.toFixed(4)))
  return String(Number(r.toPrecision(4)))
}

export default function NewExpenseScreen() {
  // Besides groupId/expenseId, the scan path hands back prefill params
  // (title/amount/currency/category/receiptImageUrl) from the review screen.
  const params = useLocalSearchParams<{
    groupId: string
    expenseId?: string
    title?: string
    amount?: string
    currency?: string
    category?: string
    receiptImageUrl?: string
  }>()
  const groupId = params.groupId
  const expenseId = params.expenseId
  const isEditing = !!expenseId
  const { groups, refresh } = useGroups()
  const { width } = useWindowDimensions()
  const isWide = width >= 900

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const [members, setMembers] = useState<any[]>([])

  const [amount, setAmount] = useState(params.amount ?? '')
  const [currency, setCurrency] = useState(params.currency || 'IDR')
  const [rate, setRate] = useState('1')
  const [showCurMenu, setShowCurMenu] = useState(false)
  const [title, setTitle] = useState(params.title ?? '')
  const [category, setCategory] = useState<ExpenseCategory>((params.category as ExpenseCategory) || 'Food')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paidBy, setPaidBy] = useState<string | null>(null)
  const [splitBetween, setSplitBetween] = useState<Record<string, boolean>>({})
  // Signed receipt URL carried in from the scan path; persisted on save. Null for manual entry.
  const [receiptImageUrl] = useState<string | null>(params.receiptImageUrl || null)
  // FX rate fetch status, shown next to the editable rate field.
  const [rateStatus, setRateStatus] = useState<'loading' | 'live' | 'fallback' | 'manual' | 'failed' | null>(null)

  const group = groups.find(g => g.group.id === groupId)
  const groupCurrency = group?.group.currency ?? 'IDR'
  const groupCur = CURRENCIES.find(c => c.code === groupCurrency) ?? CURRENCIES[0]
  const cur = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0]
  const amountNum = parseFloat(amount) || 0
  const rateNum = parseFloat(rate) || 1
  const isGroupCurrency = currency === groupCurrency
  const effectiveRate = isGroupCurrency ? 1 : rateNum
  const amountInGroup = amountNum * effectiveRate
  const splitIds = Object.entries(splitBetween).filter(([, on]) => on).map(([id]) => id)
  const shareEach = splitIds.length ? amountNum / splitIds.length : 0

  // Default the expense currency to the group's currency once the group loads.
  // Skip when editing (the loaded expense carries its own currency) and when the
  // scan path already supplied a currency via params.
  useEffect(() => {
    if (group && !isEditing && !params.currency) setCurrency(group.group.currency)
  }, [group?.group.currency, isEditing])

  // Auto-fetch the live FX rate when the expense currency differs from the group's.
  // Only re-runs when the currency pair or date changes (never on every keystroke),
  // and is skipped while editing so a saved/locked rate is never clobbered. On a
  // network/function failure it keeps whatever rate is already in the field and just
  // flags it, so the flow never blocks.
  useEffect(() => {
    if (isEditing) return
    if (currency === groupCurrency) { setRateStatus(null); return }
    let cancelled = false
    setRateStatus('loading')
    // Optimistic approximate from the static reference rates so a prefilled/scan
    // currency shows a sensible number immediately and survives a failed live fetch.
    const preset = cur.rate / groupCur.rate
    if (preset !== 1) setRate(formatRate(preset))
    const todayStr = new Date().toISOString().slice(0, 10)
    const fetchDate = date && date < todayStr ? date : undefined
    getExchangeRate(currency, groupCurrency, fetchDate).then(result => {
      if (cancelled) return
      if (result) {
        setRate(formatRate(result.rate))
        setRateStatus(result.source)
      } else {
        setRateStatus('failed')
      }
    })
    return () => { cancelled = true }
  }, [currency, groupCurrency, date, isEditing])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  useEffect(() => {
    async function load() {
      try {
        const [mems, { data: { user } }] = await Promise.all([
          getGroupMembers(groupId),
          supabase.auth.getUser(),
        ])
        setMembers(mems)

        if (expenseId) {
          // Edit mode — prefill every field from the existing expense.
          const exp = await getExpenseById(expenseId)
          setAmount(String(exp.total_amount))
          setCurrency(exp.currency)
          setRate(exp.exchange_rate_to_group_currency != null ? String(exp.exchange_rate_to_group_currency) : '1')
          setTitle(exp.title)
          setCategory(exp.category)
          setDate((exp.date ?? exp.created_at)?.split('T')[0])
          setPaidBy(exp.paid_by)
          const split: Record<string, boolean> = {}
          ;(exp.expense_splits ?? []).forEach((sp: any) => { split[sp.user_id] = true })
          setSplitBetween(split)
        } else {
          // Create mode — split between everyone, default payer to me.
          const initSplit: Record<string, boolean> = {}
          mems.forEach((m: any) => { initSplit[m.id] = true })
          setSplitBetween(initSplit)
          if (user) {
            const myMember = mems.find((m: any) => m.user?.id === user.id)
            setPaidBy(myMember?.id ?? (mems.length > 0 ? mems[0].id : null))
          } else if (mems.length > 0) {
            setPaidBy(mems[0].id)
          }
        }
      } catch (e: any) {
        showToast(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [groupId, expenseId])

  function fmt(n: number) {
    if (currency === 'IDR') return 'Rp ' + Math.round(n).toLocaleString('id-ID')
    return cur.sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function fmtGroup(n: number) {
    if (groupCurrency === 'IDR') return 'Rp ' + Math.round(n).toLocaleString('id-ID')
    return groupCur.sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function toggleSplit(memberId: string) {
    setSplitBetween(prev => ({ ...prev, [memberId]: !prev[memberId] }))
  }

  async function handleSave() {
    if (!amountNum) { showToast('Enter an amount first'); return }
    if (!title.trim()) { showToast('Give it a title'); return }
    if (!paidBy) { showToast('Select who paid'); return }
    if (!splitIds.length) { showToast('Select who to split between'); return }
    if (!isGroupCurrency && !(parseFloat(rate) > 0)) { showToast('Enter a valid exchange rate'); return }

    setSaving(true)
    try {
      const payload = {
        groupId,
        paidBy,
        title: title.trim(),
        totalAmount: amountNum,
        currency,
        exchangeRateToGroupCurrency: isGroupCurrency ? null : rateNum,
        amountInGroupCurrency: amountInGroup,
        category,
        date,
        splitBetweenMemberIds: splitIds,
        receiptImageUrl: receiptImageUrl ?? undefined,
      }
      if (isEditing) {
        await updateSimpleExpense(expenseId!, payload)
        refresh()
        // Back to the group detail (refetches on mount/focus).
        router.replace(`/(app)/group/${groupId}`)
        return
      }
      await createSimpleExpense(payload)
      // Keep group balances fresh, then clear the form so the user can add
      // another expense without leaving the page.
      refresh()
      setAmount('')
      setTitle('')
      showToast('Expense saved')
    } catch (e: any) {
      showToast(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!expenseId) return
    const confirmed = Platform.OS === 'web'
      ? (typeof window !== 'undefined' && window.confirm('Delete this expense? This cannot be undone.'))
      : await new Promise<boolean>(resolve => {
          Alert.alert('Delete expense', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ])
        })
    if (!confirmed) return
    setDeleting(true)
    try {
      await deleteExpense(expenseId)
      refresh()
      router.replace(`/(app)/group/${groupId}`)
    } catch (e: any) {
      showToast(e.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return <View style={s.centered}><ActivityIndicator color={Colors.lime} size="large" /></View>
  }

  // ── Details card: title + category ──────────────────────────────────────
  const detailsCard = (
    <View style={[s.card, isWide && s.cardFlex]}>
      <View style={s.field}>
        <Text style={s.fieldLabel}>TITLE</Text>
        <TextInput
          style={s.textInput as any}
          placeholder="What was it for?"
          placeholderTextColor="#A8A296"
          value={title}
          onChangeText={setTitle}
        />
      </View>
      <View style={s.field}>
        <Text style={s.fieldLabel}>CATEGORY</Text>
        <View style={s.chipRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[s.catChip, category === cat.key && s.catChipActive]}
              onPress={() => setCategory(cat.key)}
            >
              <Text style={s.catEmoji}>{cat.emoji}</Text>
              <Text style={[s.catLabel, category === cat.key && s.catLabelActive]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.fieldLabel}>DATE</Text>
        {Platform.OS === 'web' ? (
          <View style={s.dateWrap}>
            {/* Native HTML date input — styled to match the text inputs */}
            {(() => {
              const El: any = 'input'
              return (
                <El
                  type="date"
                  value={date}
                  onChange={(e: any) => setDate(e.target.value)}
                  style={{
                    paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12,
                    border: '1.5px solid #DDD6C7',
                    borderRadius: 11, backgroundColor: '#F2EEE3',
                    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14,
                    color: '#14140F', cursor: 'pointer', outline: 'none',
                    width: '100%', boxSizing: 'border-box',
                  }}
                />
              )
            })()}
          </View>
        ) : (
          <TextInput
            style={s.textInput as any}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#A8A296"
            keyboardType="numeric"
          />
        )}
      </View>
    </View>
  )

  // ── Split card: paid by + split between ─────────────────────────────────
  const splitCard = (
    <View style={[s.card, isWide && s.cardFlex]}>
      {/* Paid by — all group members as wrapping pill chips.
          Manual members (no linked user) are shown dimmed — they can't be
          stored as paid_by since the DB requires a users.id FK. */}
      <View style={s.field}>
        <Text style={s.fieldLabel}>PAID BY</Text>
        <View style={s.paidRow}>
          {members.map((m, idx) => {
            const name = m.user?.display_name ?? m.name ?? 'Unknown'
            const on = paidBy === m.id
            return (
              <TouchableOpacity
                key={m.id}
                style={[s.paidPill, on && s.paidPillActive]}
                onPress={() => setPaidBy(m.id)}
                activeOpacity={0.7}
              >
                <Avatar name={name} index={idx} size={30} />
                <Text style={[s.paidPillName, on && s.paidPillNameActive]} numberOfLines={1}>
                  {name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Split between — all group members as toggle rows.
          Manual members are shown but cannot be toggled (no user_id for DB). */}
      <View style={s.field}>
        <View style={s.splitHeaderRow}>
          <Text style={s.fieldLabel}>SPLIT BETWEEN</Text>
          <Text style={s.splitSummary}>
            {splitIds.length
              ? `${splitIds.length} people · ${fmt(shareEach)} each`
              : 'none selected'
            }
          </Text>
        </View>
        {members.map((m, idx) => {
          const name = m.user?.display_name ?? m.name ?? 'Unknown'
          const on = !!splitBetween[m.id]
          return (
            <TouchableOpacity
              key={m.id}
              style={[s.splitRow, on && s.splitRowActive]}
              onPress={() => toggleSplit(m.id)}
              activeOpacity={0.7}
            >
              <View style={!on && s.dimmed}>
                <Avatar name={name} index={idx} size={32} />
              </View>
              <Text style={s.splitName}>{name}</Text>
              {on && <Text style={s.splitShare}>{fmt(shareEach)}</Text>}
              <View style={[s.checkbox, on && s.checkboxActive]}>
                {on && <Text style={s.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )

  return (
    <View style={s.root}>
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />

      {/* Currency dropdown — rendered outside ScrollView to avoid z-index clipping */}
      {showCurMenu && (
        <TouchableOpacity
          style={s.curOverlay}
          activeOpacity={1}
          onPress={() => setShowCurMenu(false)}
        >
          <View style={s.curMenu}>
            {CURRENCIES.map(c => (
              <TouchableOpacity
                key={c.code}
                style={[s.curItem, currency === c.code && s.curItemActive]}
                onPress={() => {
                  setCurrency(c.code)
                  // Optimistic preset from the static reference rates for instant feedback;
                  // the auto-fetch effect overrides this with the live rate when it returns.
                  const presetRate = c.rate / groupCur.rate
                  setRate(presetRate === 1 ? '1' : String(Number(presetRate.toFixed(4))))
                  setShowCurMenu(false)
                }}
              >
                <View>
                  <Text style={s.curItemCode}>{c.code}</Text>
                  <Text style={s.curItemName}>{c.name}</Text>
                </View>
                {currency === c.code && <Text style={s.curItemCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* ── Header: back + breadcrumb ─────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.breadcrumb}>
          <TouchableOpacity onPress={() => router.push('/(app)/' as any)}>
            <Text style={s.breadcrumbMuted}>Home</Text>
          </TouchableOpacity>
          <Text style={s.breadcrumbSep}> / </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.breadcrumbMuted} numberOfLines={1}>
              {group?.group.name ?? '...'}
            </Text>
          </TouchableOpacity>
          <Text style={s.breadcrumbSep}> / </Text>
          <Text style={s.breadcrumbCurrent}>{isEditing ? 'Edit expense' : 'New expense'}</Text>
        </View>
      </View>

      {/* ── Form content ─────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, isWide && s.contentWide]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={isWide ? s.wideWrap : s.mobileWrap}>

          {/* Segmented tabs — inside content, aligns with amount hero */}
          <View style={s.segmented}>
            <View style={[s.segBtn, s.segBtnActive]}>
              <Text style={[s.segTxt, s.segTxtActive]}>✎ Manual entry</Text>
            </View>
            <TouchableOpacity
              style={s.segBtn}
              onPress={() => router.push({
                pathname: '/(app)/expense/scan',
                params: { groupId, title, currency, category },
              })}
            >
              <Text style={s.segTxt}>⌖ Scan invoice</Text>
            </TouchableOpacity>
          </View>

          {/* Amount hero */}
          <View style={s.hero}>
            <View style={s.heroTop}>
              <Text style={s.heroLabel}>Amount</Text>
              <TouchableOpacity style={s.curBtn} onPress={() => setShowCurMenu(v => !v)}>
                <Text style={s.curCode}>{currency}</Text>
                <Text style={s.curCaret}>{showCurMenu ? '▴' : '▾'}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.amountRow}>
              <Text style={s.amountSym}>{cur.sym}</Text>
              <TextInput
                style={s.amountInput as any}
                value={amount}
                onChangeText={v => setAmount(v.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
            </View>
            {!isGroupCurrency && (
              <View style={s.fxRow}>
                <Text style={s.fxLabel}>1 {currency} =</Text>
                <TextInput
                  style={s.fxInput as any}
                  value={rate}
                  onChangeText={v => { setRate(v.replace(/[^\d.]/g, '')); setRateStatus('manual') }}
                  keyboardType="decimal-pad"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                />
                <Text style={s.fxLabel}>{groupCurrency}</Text>
                {rateStatus === 'loading'
                  ? <ActivityIndicator size="small" color={Colors.lime} style={{ marginLeft: 4 }} />
                  : rateStatus
                    ? <Text style={[s.fxStatus, rateStatus === 'failed' && s.fxStatusWarn]}>
                        {rateStatus === 'live' ? 'live rate'
                          : rateStatus === 'fallback' ? 'nearest day'
                          : rateStatus === 'manual' ? 'edited'
                          : 'offline'}
                      </Text>
                    : null}
                <Text style={s.fxResult}>
                  ≈ {fmtGroup(amountInGroup)}
                </Text>
              </View>
            )}
          </View>

          {/* Details + Split — two columns on web, stacked on mobile */}
          {isWide ? (
            <View style={s.twoCol}>
              {detailsCard}
              {splitCard}
            </View>
          ) : (
            <>
              {detailsCard}
              {splitCard}
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Save bar ─────────────────────────────────────────── */}
      <View style={[s.saveBar, !isWide && isEditing && s.saveBarRow, isWide && s.saveBarWide]}>
        {isEditing && (
          <TouchableOpacity
            style={[s.deleteBtn, deleting && s.saveBtnDim]}
            onPress={handleDelete}
            disabled={deleting || saving}
          >
            {deleting
              ? <ActivityIndicator color={Colors.coral} />
              : <Text style={s.deleteTxt}>Delete</Text>
            }
          </TouchableOpacity>
        )}
        {isWide && !isEditing && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.saveBtn, !isWide && isEditing && s.saveBtnFlex, saving && s.saveBtnDim]}
          onPress={handleSave}
          disabled={saving || deleting}
        >
          {saving
            ? <ActivityIndicator color={Colors.ink} />
            : <Text style={s.saveTxt}>{isEditing ? 'Save changes' : 'Save expense'}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },

  // Header + breadcrumb
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.screenH, paddingTop: 16, paddingBottom: 10, gap: 13 },
  backBtn: { width: 42, height: 42, borderRadius: Radii.backButton, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backArrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', flex: 1, minWidth: 0 },
  breadcrumbMuted: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.textMuted },
  breadcrumbSep: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.textMuted, marginHorizontal: 4 },
  breadcrumbCurrent: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.ink },

  // Segmented tabs — compact inline-flex, lives inside scroll content so it aligns with the hero
  segmented: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: Colors.tabTrack, borderRadius: 13, padding: 4, gap: 4 },
  segBtn: { alignItems: 'center', paddingVertical: 9, paddingHorizontal: 20, borderRadius: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  segBtnActive: {
    backgroundColor: Colors.card,
    borderBottomColor: Colors.coral,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  segTxt: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13.5, color: Colors.textTertiary },
  segTxtActive: { color: Colors.ink },

  // Scroll content
  content: { paddingTop: 10, paddingBottom: 130 },
  contentWide: { paddingBottom: 90 },
  mobileWrap: { paddingHorizontal: Spacing.screenH, gap: 10 },
  wideWrap: { maxWidth: 940, alignSelf: 'center', width: '100%', paddingHorizontal: 44, gap: 16 },

  // Amount hero
  hero: { backgroundColor: Colors.ink, borderRadius: 18, padding: 16, marginBottom: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: Colors.textOnDarkMuted },
  curBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  curCode: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: Colors.textOnDark },
  curCaret: { fontSize: 9, color: Colors.textOnDarkMuted },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  amountSym: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.lime },
  amountInput: { flex: 1, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, color: Colors.textOnDark, letterSpacing: -0.8, padding: 0 },
  fxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', flexWrap: 'wrap' },
  fxLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: Colors.textOnDarkMuted },
  fxInput: { width: 96, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, color: Colors.textOnDark, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13 },
  fxResult: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: Colors.textOnDark, marginLeft: 'auto' as any },
  fxStatus: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: Colors.textOnDarkMuted },
  fxStatusWarn: { color: Colors.coral },

  // Currency dropdown — rendered as overlay at root level, above everything
  curOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 },
  curMenu: { position: 'absolute', top: 140, right: Spacing.screenH, minWidth: 210, backgroundColor: '#1F1F18', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 6, ...Shadows.dropdown },
  curItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 10, gap: 12 },
  curItemActive: { backgroundColor: 'rgba(183,248,74,0.14)' },
  curItemCode: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13.5, color: Colors.textOnDark, lineHeight: 18 },
  curItemName: { fontSize: 11, color: Colors.textOnDarkMuted, lineHeight: 15, marginTop: 1 },
  curItemCheck: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: Colors.lime },

  // Two-column layout (web)
  twoCol: { flexDirection: 'row', gap: 16 },

  // Cards
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: Radii.card, padding: 20, gap: 18, marginBottom: 10 },
  cardFlex: { flex: 1, marginBottom: 0 },

  field: { gap: 8 },
  fieldLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.6 },
  textInput: { paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, backgroundColor: Colors.inputFill, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.ink },
  dateWrap: { width: '100%' as any },

  // Category chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  catChipActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  catEmoji: { fontSize: 14 },
  catLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: Colors.ink },
  catLabelActive: { color: Colors.textOnDark },

  // Paid by — horizontal wrapping pill chips (avatar left + name right)
  paidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paidPill: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, paddingLeft: 7, paddingRight: 14, borderRadius: 30, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card },
  paidPillActive: { borderColor: Colors.ink, backgroundColor: Colors.ink },
  paidPillName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13.5, color: Colors.ink },
  paidPillNameActive: { color: Colors.textOnDark },

  // Split between — vertical toggle rows, correlated with paid-by member list
  splitHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  splitSummary: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, color: Colors.ink },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1.5, borderColor: Colors.borderLight, backgroundColor: Colors.surface, marginTop: 7 },
  splitRowActive: { borderColor: Colors.ink, backgroundColor: Colors.card },
  dimmed: { opacity: 0.4 },
  splitName: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.ink },
  splitShare: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: Colors.ink },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: '#D8D1C0', backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  checkmark: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: Colors.ink },

  // Save bar
  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.screenH, paddingBottom: 36, paddingTop: 14, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  saveBarWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, paddingBottom: 24 },
  saveBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 12 },
  cancelTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: Colors.textMuted },
  saveBtn: { backgroundColor: Colors.lime, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 32, alignItems: 'center', ...Shadows.limeButton },
  saveBtnFlex: { flex: 1 },
  saveBtnDim: { opacity: 0.7 },
  saveTxt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },
  deleteBtn: { paddingVertical: 18, paddingHorizontal: 22, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.coral, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  deleteTxt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: Colors.coral },
})
