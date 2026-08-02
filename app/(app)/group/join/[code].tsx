import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'

// Deep-link entry (patungan://join/CODE) — hands off to the join prompt so the
// user still gets the "new member or one of these existing members?" choice
// instead of silently auto-joining.
export default function JoinByCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()

  useEffect(() => {
    if (!code) return
    router.replace({ pathname: '/(app)/group/join/prompt', params: { code } })
  }, [code])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
