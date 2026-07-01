import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { joinGroupByCode } from '../../../../src/services/groupService'
import { useGroups } from '../../../../src/context/GroupsContext'
import { Colors, Radii, Spacing, Shadows } from '../../../../src/theme'
import { Toast } from '../../../../src/components/Toast'

export default function JoinPromptScreen() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const { refresh } = useGroups()

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  async function handleJoin() {
    if (!code.trim()) { showToast('Enter an invite code first'); return }
    setLoading(true)
    try {
      const group = await joinGroupByCode(code.trim())
      refresh()
      router.replace(`/(app)/group/${group.id}`)
    } catch (e: any) {
      showToast(e.message ?? 'Could not join')
      setLoading(false)
    }
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
          onPress={handleJoin}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.screenH, paddingTop: 56, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: Radii.backButton, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  body: { flex: 1, paddingHorizontal: Spacing.screenH, paddingTop: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  lead: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: Colors.ink, letterSpacing: -0.4 },
  subLead: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: Colors.textMuted, marginTop: 8, marginBottom: 28, lineHeight: 20 },
  input: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, paddingVertical: 18, paddingHorizontal: 16, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.ink, textAlign: 'center', letterSpacing: 4, marginBottom: 16 },
  btn: { backgroundColor: Colors.lime, borderRadius: 18, padding: 18, alignItems: 'center', ...Shadows.limeButton },
  btnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },
})
