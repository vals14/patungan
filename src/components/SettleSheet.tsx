import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Sheet } from './Sheet'
import { Colors, Radii } from '../theme'
import { PayMethod } from '../services/settlementService'
import { SettlementTransfer } from '../services/balanceService'

interface Props {
  transfer: SettlementTransfer | null
  currency: string
  onClose: () => void
  onConfirm: (method: PayMethod) => void
}

const METHODS: { key: PayMethod; label: string; emoji: string }[] = [
  { key: 'cash', label: 'Cash', emoji: '💵' },
  { key: 'bank_transfer', label: 'Bank transfer', emoji: '🏦' },
  { key: 'ewallet', label: 'E-wallet', emoji: '📱' },
  { key: 'other', label: 'Other', emoji: '•' },
]

export function SettleSheet({ transfer, currency, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<PayMethod>('cash')
  if (!transfer) return null
  const prefix = currency === 'IDR' ? 'Rp ' : currency + ' '

  return (
    <Sheet visible={!!transfer} onClose={onClose}>
      <Text style={styles.title}>Mark as settled</Text>
      <Text style={styles.summary}>{transfer.fromName} pays {transfer.toName}</Text>
      <Text style={styles.amount}>{prefix}{transfer.amount.toLocaleString('id-ID')}</Text>

      <Text style={styles.methodLabel}>How was it paid?</Text>
      <View style={styles.methodGrid}>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.methodCard, method === m.key && styles.methodCardActive]}
            onPress={() => setMethod(m.key)}
          >
            <Text style={styles.methodEmoji}>{m.emoji}</Text>
            <Text style={[styles.methodText, method === m.key && styles.methodTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(method)}>
        <Text style={styles.confirmText}>Confirm payment</Text>
      </TouchableOpacity>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 21, color: Colors.ink, letterSpacing: -0.4 },
  summary: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.textMuted, marginTop: 10 },
  amount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: Colors.ink, letterSpacing: -0.8, marginTop: 4, marginBottom: 20 },
  methodLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: Colors.ink, marginBottom: 10 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '47%', backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, padding: 14 },
  methodCardActive: { borderColor: Colors.ink },
  methodEmoji: { fontSize: 18 },
  methodText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: Colors.textMuted },
  methodTextActive: { color: Colors.ink },
  confirmBtn: { backgroundColor: Colors.lime, borderRadius: 16, padding: 16, alignItems: 'center' },
  confirmText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },
})
