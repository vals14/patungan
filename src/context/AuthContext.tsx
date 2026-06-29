import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Platform } from 'react-native'
import { Session, User as SupabaseUser } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { User } from '../types/database'

WebBrowser.maybeCompleteAuthSession()

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signInWithPhone: (phone: string) => Promise<{ error: string | null }>
  verifyOtp: (phone: string, token: string) => Promise<{ error: string | null }>
  signInAsGuest: () => Promise<{ error: string | null }>
  forgotPassword: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUser(session.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchUser(session.user)
      else setUser(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUser(authUser: SupabaseUser) {
    if ((authUser as any).is_anonymous) {
      setUser({
        id: authUser.id,
        email: null,
        phone: null,
        display_name: 'Guest',
        avatar_url: null,
        created_at: new Date().toISOString(),
      })
      return
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()
    if (error) console.error('fetchUser error:', error)
    if (data) setUser(data)
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { error: null }
    if (error.message.toLowerCase().includes('invalid login credentials') ||
        error.message.toLowerCase().includes('invalid_credentials')) {
      return { error: 'Incorrect email or password. Please check and try again.' }
    }
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { error: 'Please confirm your email before signing in. Check your inbox.' }
    }
    return { error: error.message }
  }

  async function signUpWithEmail(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) return { error: error.message }
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { error: 'An account with this email already exists. Please sign in instead.' }
    }
    return { error: null }
  }

  async function signInWithGoogle() {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      return { error: error?.message ?? null }
    }
    const redirectTo = Linking.createURL('/')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error) return { error: error.message }
    if (!data.url) return { error: 'Could not open Google sign-in.' }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type === 'success') {
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url)
      return { error: sessionError?.message ?? null }
    }
    return { error: null }
  }

  async function signInWithPhone(phone: string) {
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function verifyOtp(phone: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) return { error: 'Invalid code. Please try again.' }
    return { error: null }
  }

  async function signInAsGuest() {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) return { error: error.message }
    return { error: null }
  }

  async function forgotPassword(email: string) {
    const redirectTo = Platform.OS === 'web' ? window.location.origin : Linking.createURL('/')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      session, user, loading,
      signInWithEmail, signUpWithEmail, signInWithGoogle,
      signInWithPhone, verifyOtp, signInAsGuest,
      forgotPassword, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
