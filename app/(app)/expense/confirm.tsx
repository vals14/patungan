import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Radii, Spacing, Shadows } from '../../../src/theme'
import { Avatar } from '../../../src/components/Avatar'
import { Toast } from '../../../src/components/Toast'
import { createExpense, computeSplits } from '../../../src/services/expenseService'
import { ExpenseCategory } from '../../../src/types/database'

export default function ConfirmExpenseScreen() {
  const params = useLocalSearchParams<{
    groupId: string
    title: string
    currency: string
    category: string
    paidBy: string
    totalAmount: string
    lineItems: string
    membersJson: string
    assignmentsJson: string
  }>()

  const lineItems: { name: string; amount: number }[] = JSON.parse(params.lineItems ?? '[]')
  const members: any[] = JSON.parse(params.membersJson ?? '[]')
  const assignments: { lineItemIndex: number; userIds: string[] }[] = JSON.parse(params.assignmentsJson ?? '[]')

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  const owedMap = computeSplits(lineItems, assignments, 1.0)

  function getMember(userId: string) {
    return members.find(m => m.user?.id === userId)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await createExpense({
        groupId: params.groupId,
        paidBy: params.paidBy,
        title: params.title,
        totalAmount: Number(params.totalAmount),
        currency: params.currency,
        exchangeRateToGroupCurrency: null,
        category: params.category as ExpenseCategory,
        lineItems,
        assignments,
      })
      router.replace(`/(app)/group/${params.groupId}`)
    } catch (e: any) {
      showToast(e.message)
      setSaving(false)
    }
  }

  const paidByMember = getMember(params.paidBy)

  return (
    <View style={s.container}>
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.screenTitle}>CONFIRM EXPENSE</Text>
        </View>

        <View style={s.summaryCard}>
          <Text style={s.expenseTitle}>{params.title}</Text>
          <Text style={s.expenseTotal}>
            {params.currency === 'IDR' ? 'Rp ' : params.currency + ' '}
            {Number(params.totalAmount).toLocaleString('id-ID')}
          </Text>
          <View style={s.summaryMeta}>
            <Text style={s.summaryMetaText}>Paid by {paidByMember?.user?.display_name ?? 'Unknown'}</Text>
            <View style={s.categoryBadge}>
              <Text style={s.categoryBadgeText}>{params.category}</Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>Items</Text>
        {lineItems.map((item, idx) => {
          const assignment = assignments.find(a => a.lineItemIndex === idx)
          const names = assignment?.userIds
            .map(uid => getMember(uid)?.user?.display_name?.split(' ')[0])
            .filter(Boolean)
            .join(', ')
          return (
            <View key={idx} style={s.lineItemRow}>
              <View style={s.lineItemInfo}>
                <Text style={s.lineItemName}>{item.name}</Text>
                <Text style={s.lineItemAssignees}>{names}</Text>
              </View>
              <Text style={s.lineItemAmount}>Rp {item.amount.toLocaleString('id-ID')}</Text>
            </View>
          )
        })}

        <Text style={[s.sectionTitle, { marginTop: 20 }]}>Who owes what</Text>
        <View style={s.breakdownCard}>
          {Object.entries(owedMap).map(([userId, amount], idx) => {
            const member = getMember(userId)
            return (
              <View key={userId} style={[s.breakdownRow, idx > 0 && s.breakdownRowBorder]}>
                <Avatar
                  name={member?.user?.display_name ?? '?'}
                  index={members.findIndex(m => m.user?.id === userId)}
                  size={32}
                  tile
                />
                <Text style={s.breakdownName}>{member?.user?.display_name ?? userId}</Text>
                <Text style={s.breakdownAmount}>Rp {Math.round(amount).toLocaleString('id-ID')}</Text>
              </View>
            )
          })}
        </View>

      </ScrollView>

      <View style={s.stickyBar}>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={Colors.ink} />
            : <Text style={s.saveBtnText}>Save expense</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingHorizontal: Spacing.screenH, paddingTop: 56, paddingBottom: 140 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: Radii.backButton, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  screenTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8 },

  summaryCard: { backgroundColor: Colors.ink, borderRadius: 20, padding: 22, marginBottom: 24 },
  expenseTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.textOnDark, letterSpacing: -0.4 },
  expenseTotal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, color: Colors.lime, letterSpacing: -0.8, marginTop: 8 },
  summaryMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  summaryMetaText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#8E968A' },
  categoryBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryBadgeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#8E968A' },

  sectionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink, marginBottom: 12 },

  lineItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  lineItemInfo: { flex: 1 },
  lineItemName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.ink },
  lineItemAssignees: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  lineItemAmount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: Colors.ink },

  breakdownCard: { backgroundColor: Colors.card, borderRadius: Radii.card, overflow: 'hidden' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  breakdownRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  breakdownName: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.ink },
  breakdownAmount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: Colors.ink },

  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.screenH, paddingBottom: 36, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  saveBtn: { backgroundColor: Colors.lime, borderRadius: 18, padding: 18, alignItems: 'center', ...Shadows.limeButton },
  saveBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },
})
