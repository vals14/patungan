import { useEffect } from 'react'
import { View, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { joinGroupByCode } from '../../../../src/services/groupService'

export default function JoinByCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()

  useEffect(() => {
    async function join() {
      if (!code) return
      try {
        const group = await joinGroupByCode(code)
        router.replace(`/(app)/group/${group.id}`)
      } catch (e: any) {
        Alert.alert('Could not join', e.message, [
          { text: 'OK', onPress: () => router.replace('/(app)/home') },
        ])
      }
    }
    join()
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
