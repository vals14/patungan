import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Radii, Spacing, Shadows } from '../../../src/theme'
import { Toast } from '../../../src/components/Toast'
import { getGroupMembers, getGroupById, getMemberDisplayName } from '../../../src/services/groupService'
import { createExpenseWithSplits } from '../../../src/services/expenseService'
import { getExchangeRate } from '../../../src/services/ratesService'
import { supabase } from '../../../src/lib/supabase'
import { ExpenseCategory } from '../../../src/types/database'

interface ItemDraft {
  name: string
  amount: string
  on: Record<string, boolean> // memberId -> assigned
}

// Enough precision for both large (16000) and tiny (0.0000833) FX rates.
function formatRate(r: number): string {
  if (r >= 100) return String(Math.round(r))
  if (r >= 1) return String(Number(r.toFixed(4)))
  return String(Number(r.toPrecision(4)))
}

function fmtMoney(currency: string, n: number): string {
  if (currency === 'IDR') return 'Rp ' + Math.round(n).toLocaleString('id-ID')
  return currency + ' ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ReviewScreen() {
  const params = useLocalSearchParams<{
    groupId: string
    title?: string
    category?: string
    currency?: string
    ocrItems: string
    ocrTax?: string
    ocrService?: string
    ocrDiscount?: string
    ocrTotal?: string
    ocrCurrency?: string
    receiptImageUrl?: string
  }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [groupCurrency, setGroupCurrency] = useState('IDR')

  const [title, setTitle] = useState(params.title ?? '')
  const [paidBy, setPaidBy] = useState<string | null>(null)
  const [items, setItems] = useState<ItemDraft[]>([])
  const [tax, setTax] = useState(params.ocrTax ?? '0')
  const [service, setService] = useState(params.ocrService ?? '0')
  const [discount, setDiscount] = useState(params.ocrDiscount ?? '0')
  const [rate, setRate] = useState('1')
  const [rateStatus, setRateStatus] = useState<'loading' | 'live' | 'fallback' | 'manual' | 'failed' | null>(null)

  const currency = params.ocrCurrency || params.currency || 'IDR'
  const isGroupCur = currency === groupCurrency
  const rateNum = isGroupCur ? 1 : (parseFloat(rate) || 0)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    async function load() {
      try {
        const [mems, grp, { data: { user } }] = await Promise.all([
          getGroupMembers(params.groupId),
          getGroupById(params.groupId),
          supabase.auth.getUser(),
        ])
        setMembers(mems)
        setGroupCurrency(grp.currency)

        const on0: Record<string, boolean> = {}
        mems.forEach((m: any) => { on0[m.id] = true })

        const parsed = JSON.parse(params.ocrItems ?? '[]') as { name: string; amount: number }[]
        const its: ItemDraft[] = (parsed.length ? parsed : [{ name: '', amount: 0 }]).map(i => ({
          name: i.name,
          amount: String(i.amount),
          on: { ...on0 },
        }))
        setItems(its)

        const myId = user ? mems.find((m: any) => m.user?.id === user.id)?.id : null
        setPaidBy(myId ?? (mems.length > 0 ? mems[0].id : null))
      } catch (e: any) {
        showToast(e.message ?? 'Could not load the group')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.groupId])

  // Auto-fetch the FX rate when the receipt currency differs from the group's.
  useEffect(() => {
    if (!groupCurrency || currency === groupCurrency) { setRateStatus(null); return }
    let cancelled = false
    setRateStatus('loading')
    getExchangeRate(currency, groupCurrency).then(r => {
      if (cancelled) return
      if (r) { setRate(formatRate(r.rate)); setRateStatus(r.source) }
      else setRateStatus('failed')
    })
    return () => { cancelled = true }
  }, [currency, groupCurrency])

  function updateItem(idx: number, field: 'name' | 'amount', value: string) {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: field === 'amount' ? value.replace(/[^\d.]/g, '') : value }
    setItems(next)
  }
  function toggleAssignee(idx: number, memberId: string) {
    const next = [...items]
    next[idx] = { ...next[idx], on: { ...next[idx].on, [memberId]: !next[idx].on[memberId] } }
    setItems(next)
  }
  function addItem() {
    const on0: Record<string, boolean> = {}
    members.forEach(m => { on0[m.id] = true })
    setItems([...items, { name: '', amount: '', on: on0 }])
  }
  function removeItem(idx: number) {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  // ── Computation ──────────────────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const taxN = Number(tax) || 0
  const serviceN = Number(service) || 0
  const discountN = Number(discount) || 0
  const grandTotal = subtotal + taxN + serviceN - discountN
  const factor = subtotal > 0 ? (taxN + serviceN - discountN) / subtotal : 0

  // Per-member share in the RECEIPT currency (items + proportional charges).
  const perMemberReceipt: Record<string, number> = {}
  members.forEach(m => { perMemberReceipt[m.id] = 0 })
  items.forEach(i => {
    const amt = Number(i.amount) || 0
    const assignees = members.filter(m => i.on[m.id])
    if (amt === 0 || assignees.length === 0) return
    const per = amt / assignees.length
    assignees.forEach(m => { perMemberReceipt[m.id] += per })
  })
  const perMemberGroup: Record<string, number> = {}
  members.forEach(m => { perMemberGroup[m.id] = perMemberReceipt[m.id] * (1 + factor) * rateNum })

  const ocrTotal = Number(params.ocrTotal ?? 0)
  const totalMismatch = ocrTotal > 0 && Math.abs(grandTotal - ocrTotal) > 1

  async function handleSave() {
    if (!title.trim()) { showToast('Give this expense a title.'); return }
    if (!paidBy) { showToast('Select who paid.'); return }
    const valid = items.filter(i => Number(i.amount) > 0)
    if (valid.length === 0) { showToast('Add at least one item with an amount.'); return }
    for (const i of valid) {
      if (members.filter(m => i.on[m.id]).length === 0) {
        showToast(`Assign at least one person to "${i.name || 'each item'}".`); return
      }
    }
    if (!isGroupCur && !(rateNum > 0)) { showToast('Enter a valid exchange rate.'); return }

    const splits = members
      .map(m => ({ memberId: m.id, amount: perMemberGroup[m.id] ?? 0 }))
      .filter(s => s.amount > 0)
    if (splits.length === 0) { showToast('No one is assigned to any item.'); return }

    setSaving(true)
    try {
      await createExpenseWithSplits({
        groupId: params.groupId,
        paidBy,
        title: title.trim(),
        totalAmount: grandTotal,
        currency,
        exchangeRateToGroupCurrency: isGroupCur ? null : rateNum,
        amountInGroupCurrency: grandTotal * rateNum,
        category: (params.category as ExpenseCategory) || 'Food',
        date: new Date().toISOString().split('T')[0],
        receiptImageUrl: params.receiptImageUrl || undefined,
      }, splits)
      router.replace(`/(app)/group/${params.groupId}`)
    } catch (e: any) {
      showToast(e.message ?? 'Could not save')
      setSaving(false)
    }
  }

  if (loading) {
    return <View style={s.centered}><ActivityIndicator color={Colors.lime} size="large" /></View>
  }

  const chargesActive = taxN > 0 || serviceN > 0 || discountN > 0

  return (
    <View style={s.container}>
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={s.screenTitle}>REVIEW & SPLIT</Text>
            <Text style={s.screenSub}>Assign each item, then split & save</Text>
          </View>
        </View>

        {!!params.receiptImageUrl && <Image source={{ uri: params.receiptImageUrl }} style={s.thumb} />}

        {/* Title */}
        <Text style={s.label}>TITLE</Text>
        <TextInput
          style={s.input}
          placeholder="What was it for?"
          placeholderTextColor="#A8A296"
          value={title}
          onChangeText={setTitle}
        />

        {/* Paid by */}
        <Text style={[s.label, { marginTop: 20 }]}>PAID BY</Text>
        <View style={s.chipWrap}>
          {members.map((m, idx) => {
            const on = paidBy === m.id
            const name = getMemberDisplayName(m)
            return (
              <TouchableOpacity key={m.id} style={[s.chip, on && s.chipActive]} onPress={() => setPaidBy(m.id)} activeOpacity={0.7}>
                <Text style={[s.chipText, on && s.chipTextActive]}>{name.split(' ')[0]}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Exchange rate (cross-currency only) */}
        {!isGroupCur && (
          <View style={s.rateRow}>
            <Text style={s.rateLabel}>1 {currency} =</Text>
            <TextInput
              style={s.rateInput}
              value={rate}
              onChangeText={v => { setRate(v.replace(/[^\d.]/g, '')); setRateStatus('manual') }}
              keyboardType="decimal-pad"
            />
            <Text style={s.rateLabel}>{groupCurrency}</Text>
            {rateStatus === 'loading'
              ? <ActivityIndicator size="small" color={Colors.ink} style={{ marginLeft: 4 }} />
              : rateStatus
                ? <Text style={[s.rateStatus, rateStatus === 'failed' && { color: Colors.coral }]}>
                    {rateStatus === 'live' ? 'live' : rateStatus === 'fallback' ? 'nearest day' : rateStatus === 'manual' ? 'edited' : 'offline'}
                  </Text>
                : null}
          </View>
        )}

        {/* Items */}
        <Text style={[s.label, { marginTop: 20 }]}>ITEMS</Text>
        {items.map((item, idx) => {
          const assigneeCount = members.filter(m => item.on[m.id]).length
          const amt = Number(item.amount) || 0
          const eachReceipt = assigneeCount > 0 ? amt / assigneeCount : 0
          return (
            <View key={idx} style={s.itemCard}>
              <View style={s.itemTopRow}>
                <TextInput
                  style={[s.input, s.itemName]}
                  placeholder="Item name"
                  placeholderTextColor="#A8A296"
                  value={item.name}
                  onChangeText={v => updateItem(idx, 'name', v)}
                />
                <TextInput
                  style={[s.input, s.itemAmount]}
                  placeholder="0"
                  placeholderTextColor="#A8A296"
                  value={item.amount}
                  onChangeText={v => updateItem(idx, 'amount', v)}
                  keyboardType="numeric"
                />
                {items.length > 1 && (
                  <TouchableOpacity style={s.removeBtn} onPress={() => removeItem(idx)}>
                    <Text style={s.removeBtnText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.assignRow}>
                {members.map(m => {
                  const on = !!item.on[m.id]
                  const name = getMemberDisplayName(m)
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.miniChip, on && s.miniChipActive]}
                      onPress={() => toggleAssignee(idx, m.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.miniChipText, on && s.miniChipTextActive]}>{name.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {assigneeCount > 0 && amt > 0 && (
                <Text style={s.itemEach}>{assigneeCount} {assigneeCount === 1 ? 'person' : 'people'} · {fmtMoney(currency, eachReceipt)} each (before tax)</Text>
              )}
            </View>
          )
        })}
        <TouchableOpacity style={s.addRow} onPress={addItem}>
          <Text style={s.addRowText}>+ Add item</Text>
        </TouchableOpacity>

        {/* Charges */}
        <Text style={[s.label, { marginTop: 20 }]}>TAX & CHARGES</Text>
        <View style={s.chargeCard}>
          {([['Tax', tax, setTax], ['Service', service, setService], ['Discount', discount, setDiscount]] as const).map(([lbl, val, setter]) => (
            <View key={lbl} style={s.chargeRow}>
              <Text style={s.chargeLabel}>{lbl}{lbl === 'Discount' ? ' (−)' : ''}</Text>
              <TextInput
                style={s.chargeInput}
                value={val}
                onChangeText={v => setter(v.replace(/[^\d.]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#A8A296"
              />
            </View>
          ))}
          <Text style={s.chargeHint}>Spread across items proportionally by price.</Text>
        </View>

        {/* Per-person summary */}
        <Text style={[s.label, { marginTop: 20 }]}>EACH PERSON PAYS</Text>
        <View style={s.summaryCard}>
          {members.map((m, idx) => {
            const g = perMemberGroup[m.id] ?? 0
            if (g <= 0) return null
            return (
              <View key={m.id} style={s.summaryRow}>
                <Text style={s.summaryName} numberOfLines={1}>{getMemberDisplayName(m)}</Text>
                <Text style={s.summaryAmt}>{fmtMoney(groupCurrency, g)}</Text>
              </View>
            )
          })}
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryTotalLabel}>Total{!isGroupCur ? ` (${fmtMoney(currency, grandTotal)})` : ''}</Text>
            <Text style={s.summaryTotalAmt}>{fmtMoney(groupCurrency, grandTotal * rateNum)}</Text>
          </View>
          {totalMismatch && (
            <Text style={s.mismatch}>
              Doesn't match the receipt total ({fmtMoney(currency, ocrTotal)}) — check for a missed item or charge.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Sticky save */}
      <View style={s.stickyBar}>
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.ink} /> : <Text style={s.saveBtnText}>Save expense</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  content: { paddingHorizontal: Spacing.screenH, paddingTop: 56, paddingBottom: 130, maxWidth: 640, width: '100%', alignSelf: 'center' },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: Radii.backButton, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backArrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  screenTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
  screenSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: Colors.textMuted, marginTop: 3 },

  thumb: { width: 80, height: 100, borderRadius: 12, marginBottom: 20, resizeMode: 'cover' },

  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, paddingHorizontal: 16, paddingVertical: 13, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: Colors.ink },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 30, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13.5, color: Colors.ink },
  chipTextActive: { color: Colors.textOnDark },

  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  rateLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: Colors.ink },
  rateInput: { minWidth: 90, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, paddingHorizontal: 12, paddingVertical: 8, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: Colors.ink, textAlign: 'center' },
  rateStatus: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: Colors.textMuted },

  itemCard: { backgroundColor: Colors.card, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderLight, padding: 12, marginBottom: 10, gap: 10 },
  itemTopRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  itemName: { flex: 2, backgroundColor: Colors.surface },
  itemAmount: { flex: 1, backgroundColor: Colors.surface },
  removeBtn: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.textMuted },
  assignRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  miniChipActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  miniChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: Colors.textMuted },
  miniChipTextActive: { color: Colors.ink },
  itemEach: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.textMuted },

  addRow: { paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: Radii.input, marginTop: 2 },
  addRowText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: Colors.textMuted },

  chargeCard: { backgroundColor: Colors.card, borderRadius: Radii.card, padding: 14, gap: 10 },
  chargeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chargeLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.ink },
  chargeInput: { minWidth: 120, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, paddingHorizontal: 12, paddingVertical: 9, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: Colors.ink, textAlign: 'right' },
  chargeHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  summaryCard: { backgroundColor: Colors.card, borderRadius: Radii.card, padding: 16, gap: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.ink, flex: 1, minWidth: 0 },
  summaryAmt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: Colors.ink },
  summaryDivider: { height: 1, backgroundColor: Colors.borderLight },
  summaryTotalLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: Colors.ink },
  summaryTotalAmt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },
  mismatch: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.coral, marginTop: 2, lineHeight: 17 },

  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.screenH, paddingBottom: 36, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  saveBtn: { backgroundColor: Colors.lime, borderRadius: 18, padding: 18, alignItems: 'center', ...Shadows.limeButton },
  saveBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },
})
