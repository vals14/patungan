import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { joinGroupByCode } from '../../../../src/services/groupService'

export default function JoinPromptScreen() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    if (!code.trim()) {
      Alert.alert('Missing code', 'Please enter an invite code.')
      return
    }
    setLoading(true)
    try {
      const group = await joinGroupByCode(code.trim())
      router.replace(`/(app)/group/${group.id}`)
    } catch (e: any) {
      Alert.alert('Could not join', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Join a group</Text>
      <Text style={styles.subtitle}>Enter the invite code shared by your group.</Text>

      <TextInput
        style={styles.input}
        placeholder="e.g. AB12CD34"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        autoFocus
      />

      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.5 }]}
        onPress={handleJoin}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Join group</Text>
        }
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 60 },
  backBtn: { marginBottom: 32 },
  back: { fontSize: 15, color: '#555' },
  title: { fontSize: 24, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 32 },
  input: {
    borderWidth: 0.5, borderColor: '#ccc', borderRadius: 8,
    padding: 14, fontSize: 18, letterSpacing: 2,
    color: '#1a1a1a', marginBottom: 16, textAlign: 'center',
  },
  btn: {
    backgroundColor: '#1a1a1a', padding: 14,
    borderRadius: 8, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
})
