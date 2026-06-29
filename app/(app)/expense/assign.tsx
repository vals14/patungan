import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Radii, Spacing, Shadows } from '../../../src/theme'
import { Avatar } from '../../../src/components/Avatar'
import { Toast } from '../../../src/components/Toast'

type AssignMode = 'all' | 'select' | 'mine'

interface ItemAssignment {
  mode: AssignMode
  selectedUserIds: string[]
}

export default function AssignExpenseScreen() {
  const params = useLocalSearchParams<{
    groupId: string
    title: string
    currency: string
    category: string
    paidBy: string
    totalAmount: string
    lineItems: string
    membersJson: string
  }>()

  const lineItems: { name: string; amount: number }[] = JSON.parse(params.lineItems ?? '[]')
  const members: any[] = JSON.parse(params.membersJson ?? '[]')

  const linkedMembers = members.filter(m => m.user != null)

  const [assignments, setAssignments] = useState<ItemAssignment[]>(
    lineItems.map(() => ({ mode: 'all', selectedUserIds: linkedMembers.map(m => m.user.id) }))
  )
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  function setMode(itemIdx: number, mode: AssignMode) {
    const updated = [...assignments]
    updated[itemIdx] = {
      mode,
      selectedUserIds: mode === 'all'
        ? linkedMembers.map(m => m.user.id)
        : mode === 'mine'
        ? [params.paidBy]
        : [],
    }
    setAssignments(updated)
  }

  function toggleMember(itemIdx: number, userId: string) {
    const updated = [...assignments]
    const current = updated[itemIdx].selectedUserIds
    updated[itemIdx] = {
      ...updated[itemIdx],
      selectedUserIds: current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId],
    }
    setAssignments(updated)
  }

  function getMemberName(userId: string) {
    return members.find(m => m.user?.id === userId)?.user?.display_name ?? userId
  }

  function getMemberIndex(userId: string) {
    return members.findIndex(m => m.user?.id === userId)
  }

  const allAssigned = assignments.every(a => a.selectedUserIds.length > 0)
  const unassignedCount = assignments.filter(a => a.selectedUserIds.length === 0).length

  function handleNext() {
    if (!allAssigned) { showToast('Assign all items before continuing.'); return }

    const assignmentsForService = assignments.map((a, idx) => ({
      lineItemIndex: idx,
      userIds: a.selectedUserIds,
    }))

    router.push({
      pathname: '/(app)/expense/confirm',
      params: {
        ...params,
        assignmentsJson: JSON.stringify(assignmentsForService),
      },
    })
  }

  return (
    <View style={s.container}>
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={s.screenTitle}>ASSIGN ITEMS</Text>
            <Text style={s.screenSub}>Tap each item to assign who pays for it</Text>
          </View>
        </View>

        {lineItems.map((item, idx) => {
          const assignment = assignments[idx]
          const isUnassigned = assignment.selectedUserIds.length === 0

          return (
            <View key={idx} style={[s.itemCard, isUnassigned && s.itemCardUnassigned]}>
              <View style={s.itemHeader}>
                <Text style={s.itemName}>{item.name}</Text>
                <Text style={s.itemAmount}>
                  {params.currency === 'IDR' ? 'Rp ' : params.currency + ' '}
                  {item.amount.toLocaleString('id-ID')}
                </Text>
              </View>

              <View style={s.modeRow}>
                {(['all', 'select', 'mine'] as AssignMode[]).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[s.modeBtn, assignment.mode === mode && s.modeBtnActive]}
                    onPress={() => setMode(idx, mode)}
                  >
                    <Text style={[s.modeBtnText, assignment.mode === mode && s.modeBtnTextActive]}>
                      {mode === 'all' ? 'Everyone' : mode === 'mine' ? 'Mine' : 'Select'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {assignment.mode === 'select' && (
                <View style={s.memberRow}>
                  {linkedMembers.map((m, mIdx) => {
                    const selected = assignment.selectedUserIds.includes(m.user.id)
                    return (
                      <TouchableOpacity
                        key={m.user.id}
                        style={[s.memberToggle, selected && s.memberToggleActive]}
                        onPress={() => toggleMember(idx, m.user.id)}
                      >
                        <Avatar name={m.user.display_name} index={mIdx} size={28} tile />
                        <Text style={s.memberToggleName} numberOfLines={1}>
                          {m.user.display_name.split(' ')[0]}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}

              {!isUnassigned && (
                <View style={s.assignmentSummary}>
                  {assignment.selectedUserIds.map((uid) => (
                    <Avatar key={uid} name={getMemberName(uid)} index={getMemberIndex(uid)} size={24} tile />
                  ))}
                  <Text style={s.assignmentSummaryText}>
                    {assignment.mode === 'all'
                      ? `Everyone (${linkedMembers.length})`
                      : assignment.mode === 'mine'
                      ? getMemberName(params.paidBy)
                      : `${assignment.selectedUserIds.length} selected`}
                    {' · '}
                    {params.currency === 'IDR' ? 'Rp ' : ''}
                    {(item.amount / assignment.selectedUserIds.length).toLocaleString('id-ID')} each
                  </Text>
                </View>
              )}

              {isUnassigned && (
                <Text style={s.unassignedWarning}>⚠ Not assigned yet</Text>
              )}
            </View>
          )
        })}

        <View style={s.totalBar}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Items total</Text>
            <Text style={s.totalValue}>
              Rp {lineItems.reduce((sum, i) => sum + i.amount, 0).toLocaleString('id-ID')}
            </Text>
          </View>
          {unassignedCount > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { color: Colors.coral }]}>Unassigned items</Text>
              <Text style={[s.totalValue, { color: Colors.coral }]}>{unassignedCount}</Text>
            </View>
          )}
        </View>

      </ScrollView>

      <View style={s.stickyBar}>
        <TouchableOpacity
          style={[s.confirmBtn, !allAssigned && s.confirmBtnDisabled]}
          onPress={handleNext}
          disabled={!allAssigned}
        >
          <Text style={s.confirmBtnText}>Review & confirm →</Text>
        </TouchableOpacity>
        {!allAssigned && (
          <Text style={s.assignAllHint}>Assign all items to continue</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingHorizontal: Spacing.screenH, paddingTop: 56, paddingBottom: 140 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: Radii.backButton, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backArrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  screenTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8 },
  screenSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: Colors.textMuted, marginTop: 3 },

  itemCard: { backgroundColor: Colors.card, borderRadius: Radii.card, padding: 16, marginBottom: 10 },
  itemCardUnassigned: { borderWidth: 1.5, borderColor: Colors.coral },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: Colors.ink, flex: 1 },
  itemAmount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: Colors.ink },

  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  modeBtnActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  modeBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: Colors.textMuted },
  modeBtnTextActive: { color: Colors.textOnDark },

  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  memberToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  memberToggleActive: { borderColor: Colors.coral },
  memberToggleName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: Colors.ink, maxWidth: 60 },

  assignmentSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  assignmentSummaryText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.textMuted },
  unassignedWarning: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: Colors.coral },

  totalBar: { backgroundColor: Colors.card, borderRadius: Radii.card, padding: 16, marginTop: 8, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: Colors.textMuted },
  totalValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: Colors.ink },

  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.screenH, paddingBottom: 36, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  confirmBtn: { backgroundColor: Colors.lime, borderRadius: 18, padding: 18, alignItems: 'center', ...Shadows.limeButton },
  confirmBtnDisabled: { backgroundColor: '#D8E8B0', shadowOpacity: 0 },
  confirmBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },
  assignAllHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.coral, textAlign: 'center', marginTop: 8 },
})
