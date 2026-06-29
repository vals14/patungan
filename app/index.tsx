import { Redirect } from 'expo-router'
import { useAuth } from '../src/context/AuthContext'
import { ActivityIndicator, View } from 'react-native'

export default function Index() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  return <Redirect href={session ? '/(app)/home' : '/(auth)/login'} />
}
