import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import {
  previewGroupByCode, joinGroupByCode, GroupJoinPreview,
} from '../../../../src/services/groupService'
import { useGroups } from '../../../../src/context/GroupsContext'
import { Colors, Radii, Spacing, Shadows } from '../../../../src/theme'
import { Toast } from '../../../../src/components/Toast'

export default function JoinPromptScreen() {
  const params = useLocalSearchParams<{ code?: string }>()
  const [code, setCode] = useState(params.code ?? '')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [preview, setPreview] = useState<GroupJoinPreview | null>(null)
  const [claimId, setClaimId] = useState<string | null>(null) // null = "new member"
  const { refresh } = useGroups()
  const autoRan = useRef(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  async function handleContinue() {
    if (!code.trim()) { showToast('Enter an invite code first'); return }
    setLoading(true)
    try {
      const p = await previewGroupByCode(code.trim())
      if (p.unclaimedMembers.length === 0) {
        await finishJoin(undefined)
        return
      }
      setPreview(p)
      setClaimId(null)
      setLoading(false)
    } catch (e: any) {
      showToast(e.message ?? 'Could not find that group')
      setLoading(false)
    }
  }

  // Deep link handoff — a code arriving via params is auto-previewed once.
  // (code state is already seeded from params.code on first render.)
  useEffect(() => {
    if (params.code && !autoRan.current) {
      autoRan.current = true
      handleContinue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code])

  async function finishJoin(claimMemberId: string | undefined) {
    setLoading(true)
    try {
      const group = await joinGroupByCode(code.trim(), claimMemberId)
      refresh()
      router.replace(`/(app)/group/${group.id}`)
    } catch (e: any) {
      showToast(e.message ?? 'Could not join')
      setLoading(false)
    }
  }

  if (preview) {
    return (
      <View style={styles.container}>
        <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setPreview(null)}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.lead}>{preview.groupName}</Text>
          <Text style={styles.subLead}>
            Are you one of the members already in this group, or are you new?
          </Text>

          <TouchableOpacity
            style={[styles.optionRow, claimId === null && styles.optionRowActive]}
            onPress={() => setClaimId(null)}
          >
            <Text style={styles.optionText}>I'm a new member</Text>
            <View style={[styles.radio, claimId === null && styles.radioActive]} />
          </TouchableOpacity>

          {preview.unclaimedMembers.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.optionRow, claimId === m.id && styles.optionRowActive]}
              onPress={() => setClaimId(m.id)}
            >
              <Text style={styles.optionText}>I'm {m.name}</Text>
              <View style={[styles.radio, claimId === m.id && styles.radioActive]} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={() => finishJoin(claimId ?? undefined)}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.ink} />
              : <Text style={styles.btnText}>Join group</Text>}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.lead}>Join a group</Text>
        <Text style={styles.subLead}>Enter the invite code someone shared with you.</Text>

        <TextInput
          style={styles.input}
          placeholder="AB12CD34"
          placeholderTextColor="#A8A296"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/\s/g, ''))}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={12}
        />

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.ink} />
            : <Text style={styles.btnText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.screenH, paddingTop: 56, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: Radii.backButton, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  body: { flex: 1, paddingHorizontal: Spacing.screenH, paddingTop: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  lead: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: Colors.ink, letterSpacing: -0.4 },
  subLead: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: Colors.textMuted, marginTop: 8, marginBottom: 28, lineHeight: 20 },
  input: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, paddingVertical: 18, paddingHorizontal: 16, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.ink, textAlign: 'center', letterSpacing: 4, marginBottom: 16 },
  btn: { backgroundColor: Colors.lime, borderRadius: 18, padding: 18, alignItems: 'center', ...Shadows.limeButton, marginTop: 8 },
  btnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },

  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 },
  optionRowActive: { borderColor: Colors.ink, backgroundColor: Colors.surface },
  optionText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: Colors.ink, flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#D8D1C0', backgroundColor: Colors.card },
  radioActive: { borderColor: Colors.ink, borderWidth: 6, backgroundColor: Colors.lime },
})
