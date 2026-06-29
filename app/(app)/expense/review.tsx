import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Radii, Spacing, Shadows } from '../../../src/theme'
import { Toast } from '../../../src/components/Toast'

interface ItemDraft { name: string; amount: string }

export default function ReviewScreen() {
  const params = useLocalSearchParams<{
    groupId: string
    title?: string
    currency?: string
    category?: string
    ocrItems: string
    ocrTotal?: string
    ocrCurrency?: string
    receiptImageUrl?: string
  }>()

  const initial: ItemDraft[] = (JSON.parse(params.ocrItems ?? '[]') as { name: string; amount: number }[])
    .map((i) => ({ name: i.name, amount: String(i.amount) }))

  const [items, setItems] = useState<ItemDraft[]>(initial.length ? initial : [{ name: '', amount: '' }])
  const [title, setTitle] = useState(params.title ?? '')
  const [toast, setToast] = useState('')

  // Currency carried from the scan/OCR result, falling back to the form's currency.
  const currency = params.ocrCurrency || params.currency || 'IDR'
  const ocrTotal = Number(params.ocrTotal ?? 0)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  function update(idx: number, field: 'name' | 'amount', value: string) {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: value }
    setItems(next)
  }
  function addRow() { setItems([...items, { name: '', amount: '' }]) }
  function removeRow(idx: number) {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  const runningTotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const totalMismatch = ocrTotal > 0 && Math.abs(runningTotal - ocrTotal) > 1

  function handleContinue() {
    if (!title.trim()) { showToast('Give this expense a title.'); return }
    const valid = items.filter((i) => i.name.trim() && Number(i.amount) > 0)
    if (valid.length === 0) { showToast('Add at least one item with an amount.'); return }

    const totalAmount = valid.reduce((s, i) => s + Number(i.amount), 0)

    // Converge back into the single-screen manual form, prefilled with the
    // reviewed title + total. The user picks payer/split there and saves via
    // the live createSimpleExpense path — one save path for both entry modes.
    router.replace({
      pathname: '/(app)/expense/new',
      params: {
        groupId: params.groupId,
        title: title.trim(),
        amount: String(totalAmount),
        currency,
        category: params.category || 'Food',
        receiptImageUrl: params.receiptImageUrl ?? '',
      },
    })
  }

  return (
    <View style={styles.container}>
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.screenTitle}>REVIEW ITEMS</Text>
            <Text style={styles.screenSub}>Check what we read — fix anything that's off</Text>
          </View>
        </View>

        {/* Receipt thumbnail */}
        {!!params.receiptImageUrl && (
          <Image source={{ uri: params.receiptImageUrl }} style={styles.thumb} />
        )}

        {/* Title */}
        <Text style={styles.fieldLabel}>TITLE</Text>
        <TextInput
          style={styles.input}
          placeholder="What was it for?"
          placeholderTextColor="#A8A296"
          value={title}
          onChangeText={setTitle}
        />

        {/* Items */}
        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>ITEMS</Text>
        {items.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <TextInput
              style={[styles.input, styles.itemName]}
              placeholder="Item name"
              placeholderTextColor="#A8A296"
              value={item.name}
              onChangeText={(v) => update(idx, 'name', v)}
            />
            <TextInput
              style={[styles.input, styles.itemAmount]}
              placeholder="0"
              placeholderTextColor="#A8A296"
              value={item.amount}
              onChangeText={(v) => update(idx, 'amount', v.replace(/[^\d.]/g, ''))}
              keyboardType="numeric"
            />
            {items.length > 1 && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeRow(idx)}>
                <Text style={styles.removeBtnText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addRow} onPress={addRow}>
          <Text style={styles.addRowText}>+ Add item</Text>
        </TouchableOpacity>

        {/* Total check */}
        <View style={styles.totalCard}>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Your items total</Text>
            <Text style={styles.totalValue}>{fmt(currency, runningTotal)}</Text>
          </View>
          {ocrTotal > 0 && (
            <View style={styles.totalLine}>
              <Text style={styles.totalLabelMuted}>Receipt total (detected)</Text>
              <Text style={styles.totalValueMuted}>{fmt(currency, ocrTotal)}</Text>
            </View>
          )}
          {totalMismatch && (
            <Text style={styles.mismatch}>
              These don't match — you may have a missing or mis-read item. That's fine, just check.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Sticky continue */}
      <View style={styles.stickyBar}>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>Next: split it →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function fmt(currency: string, n: number) {
  const prefix = currency === 'IDR' ? 'Rp ' : currency + ' '
  return prefix + n.toLocaleString('id-ID')
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingHorizontal: Spacing.screenH, paddingTop: 56, paddingBottom: 140 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: Radii.backButton, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backArrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  screenTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
  screenSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: Colors.textMuted, marginTop: 3 },

  thumb: { width: 80, height: 100, borderRadius: 12, marginBottom: 20, resizeMode: 'cover' },

  fieldLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: Colors.ink },

  itemRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  itemName: { flex: 2 },
  itemAmount: { flex: 1 },
  removeBtn: { width: 44, height: 50, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.textMuted },
  addRow: { paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: Radii.input, marginTop: 4 },
  addRowText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: Colors.textMuted },

  totalCard: { backgroundColor: Colors.card, borderRadius: Radii.card, padding: 16, marginTop: 20, gap: 8 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.ink },
  totalValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: Colors.ink },
  totalLabelMuted: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: Colors.textMuted },
  totalValueMuted: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: Colors.textMuted },
  mismatch: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.coral, marginTop: 4, lineHeight: 17 },

  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.screenH, paddingBottom: 36, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  continueBtn: { backgroundColor: Colors.lime, borderRadius: 18, padding: 18, alignItems: 'center', ...Shadows.limeButton },
  continueBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },
})
