import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { useAuth } from '../../src/context/AuthContext'
import { Toast } from '../../src/components/Toast'
import { Colors, Radii, Spacing } from '../../src/theme'

export default function ProfileScreen() {
  const { user, session, signOut, updateDisplayName } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [toast, setToast] = useState('')

  const name = user?.display_name ?? 'You'
  const email = session?.user?.email ?? user?.email ?? ''
  const initial = name.charAt(0).toUpperCase()
  const version = Constants.expoConfig?.version ?? '1.0.0'

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 2400) }

  function startEdit() {
    setNameInput(user?.display_name ?? '')
    setEditing(true)
  }

  async function saveName() {
    if (!nameInput.trim()) { showToast('Name cannot be empty'); return }
    setSavingName(true)
    const { error } = await updateDisplayName(nameInput)
    setSavingName(false)
    if (error) { showToast(error); return }
    setEditing(false)
    showToast('Name updated')
  }

  async function handleSignOut() {
    const ok = Platform.OS === 'web'
      ? (typeof window !== 'undefined' && window.confirm('Sign out of Patungan?'))
      : await new Promise<boolean>(resolve => {
          Alert.alert('Sign out', 'Sign out of Patungan?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
          ])
        })
    if (!ok) return
    setSigningOut(true)
    try {
      // The (app) layout redirects to login once the session clears.
      await signOut()
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <View style={styles.container}>
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>PROFILE</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
        <Text style={styles.name}>{name}</Text>
        {!!email && <Text style={styles.email}>{email}</Text>}

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Name</Text>
            {editing ? (
              <View style={styles.editWrap}>
                <TextInput
                  style={styles.editInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Your name"
                  placeholderTextColor="#A8A296"
                  autoFocus
                  onSubmitEditing={saveName}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={saveName} disabled={savingName}>
                  {savingName
                    ? <ActivityIndicator color={Colors.ink} size="small" />
                    : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.rowRight}>
                <Text style={styles.rowValue} numberOfLines={1}>{name}</Text>
                <TouchableOpacity onPress={startEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{email || '—'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
          {signingOut
            ? <ActivityIndicator color={Colors.coral} />
            : <Text style={styles.signOutText}>Sign out</Text>}
        </TouchableOpacity>

        <Text style={styles.version}>Patungan v{version}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.screenH, paddingTop: 56, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: Radii.backButton, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  screenTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },

  body: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.screenH, paddingTop: 32, maxWidth: 480, width: '100%', alignSelf: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, color: Colors.ink },
  name: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: Colors.ink, marginTop: 16, letterSpacing: -0.4 },
  email: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: Colors.textMuted, marginTop: 4 },

  card: { alignSelf: 'stretch', backgroundColor: Colors.card, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.borderLight, paddingHorizontal: 16, marginTop: 32 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 15, minHeight: 54 },
  rowLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.textMuted },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  rowValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: Colors.ink, flexShrink: 1 },
  editLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: Colors.positive },
  divider: { height: 1, backgroundColor: Colors.borderLight },

  editWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginLeft: 16 },
  editInput: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radii.input, paddingHorizontal: 12, paddingVertical: 8, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.ink },
  saveBtn: { backgroundColor: Colors.lime, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: Colors.ink },
  cancelBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.textMuted },

  signOutBtn: { alignSelf: 'stretch', marginTop: 24, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.coral, backgroundColor: Colors.card, alignItems: 'center' },
  signOutText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: Colors.coral },

  version: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.textTertiary, marginTop: 'auto', paddingVertical: 24 },
})
