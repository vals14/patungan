import { Redirect, Slot } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'

export default function AuthLayout() {
  const { session, loading } = useAuth()

  if (!loading && session) {
    return <Redirect href="/(app)/home" />
  }

  return <Slot />
}
