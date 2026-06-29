import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, useWindowDimensions, Platform,
} from 'react-native'
import { useAuth } from '../../src/context/AuthContext'

// ── Design tokens ──────────────────────────────────────────────
const C = {
  lime:       '#B7F84A',
  coral:      '#FF6B4A',
  ink:        '#14140F',
  cream:      '#F7F4EC',
  surface:    '#FFFFFF',
  surfaceAlt: '#ECE6D7',
  border:     '#E7E1D2',
  muted:      '#8B8576',
  muted2:     '#9A9484',
  placeholder:'#A8A296',
  googleG:    '#4285F4',
  err:        '#E0452A',
  brandDark:  '#26330F',
}
const FD  = 'SpaceGrotesk_700Bold'
const FM  = 'SpaceGrotesk_600SemiBold'
const FU  = 'PlusJakartaSans_500Medium'
const FSB = 'PlusJakartaSans_600SemiBold'
const FB  = 'PlusJakartaSans_700Bold'

const OTP_LEN = 6

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}
function isValidPhone(v: string) {
  return /^[0-9]{8,13}$/.test(v.replace(/\s/g, ''))
}

type Screen = 'login' | 'otp' | 'forgot' | 'signup'
type AuthMethod = 'email' | 'phone'

// ── Component ──────────────────────────────────────────────────
export default function LoginScreen() {
  const {
    signInWithEmail, signUpWithEmail, signInWithGoogle,
    signInWithPhone, verifyOtp, signInAsGuest, forgotPassword,
  } = useAuth()
  const { width } = useWindowDimensions()
  const isWide = width >= 900

  const [screen, setScreen]   = useState<Screen>('login')
  const [method, setMethod]   = useState<AuthMethod>('email')

  // fields
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone]         = useState('')
  const [otp, setOtp]             = useState('')
  const [forgotEmail, setForgotEmail] = useState('')

  // loading
  const [submitting, setSubmitting]       = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingGuest, setLoadingGuest]   = useState(false)

  // errors / success
  const [errEmail, setErrEmail]     = useState('')
  const [errPass, setErrPass]       = useState('')
  const [errName, setErrName]       = useState('')
  const [errPhone, setErrPhone]     = useState('')
  const [errOtp, setErrOtp]         = useState('')
  const [errForgot, setErrForgot]   = useState('')
  const [okForgot, setOkForgot]     = useState('')
  const [okSignup, setOkSignup]     = useState('')

  // OTP resend timer
  const [resend, setResend] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (screen !== 'otp') return
    setResend(30)
    timerRef.current = setInterval(() => setResend(r => Math.max(0, r - 1)), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [screen])

  function clearAll() {
    setErrEmail(''); setErrPass(''); setErrName(''); setErrPhone('')
    setErrOtp(''); setErrForgot(''); setOkForgot(''); setOkSignup('')
  }

  function goScreen(s: Screen) { clearAll(); setScreen(s) }
  function switchMethod(m: AuthMethod) { clearAll(); setMethod(m) }

  // ── Handlers ─────────────────────────────────────────────────
  async function handleLogin() {
    clearAll()
    if (method === 'email') {
      if (!email.trim())        { setErrEmail('Email is required.'); return }
      if (!isValidEmail(email)) { setErrEmail('Enter a valid email address.'); return }
      if (!password)            { setErrPass('Password is required.'); return }
      setSubmitting(true)
      const { error } = await signInWithEmail(email.trim(), password)
      setSubmitting(false)
      if (error) {
        if (error.toLowerCase().includes('password') || error.toLowerCase().includes('credentials'))
          setErrPass(error)
        else setErrEmail(error)
      }
    } else {
      if (!phone.trim())         { setErrPhone('Phone number is required.'); return }
      if (!isValidPhone(phone))  { setErrPhone('Enter a valid Indonesian number (8–13 digits).'); return }
      setSubmitting(true)
      const { error } = await signInWithPhone('+62' + phone.replace(/\s/g, ''))
      setSubmitting(false)
      if (error) setErrPhone(error)
      else goScreen('otp')
    }
  }

  async function handleSignup() {
    clearAll()
    if (!displayName.trim())      { setErrName('Display name is required.'); return }
    if (!email.trim())            { setErrEmail('Email is required.'); return }
    if (!isValidEmail(email))     { setErrEmail('Enter a valid email address.'); return }
    if (!password)                { setErrPass('Password is required.'); return }
    if (password.length < 6)      { setErrPass('Password must be at least 6 characters.'); return }
    setSubmitting(true)
    const { error } = await signUpWithEmail(email.trim(), password, displayName.trim())
    setSubmitting(false)
    if (error) {
      if (error.toLowerCase().includes('email')) setErrEmail(error)
      else setErrPass(error)
    } else {
      setOkSignup('Account created! Check your inbox to confirm before signing in.')
    }
  }

  async function handleVerify() {
    clearAll()
    if (otp.length < OTP_LEN) { setErrOtp('Enter the complete code.'); return }
    setSubmitting(true)
    const { error } = await verifyOtp('+62' + phone.replace(/\s/g, ''), otp)
    setSubmitting(false)
    if (error) setErrOtp(error)
  }

  async function handleResend() {
    clearAll()
    const { error } = await signInWithPhone('+62' + phone.replace(/\s/g, ''))
    if (!error) setResend(30)
    else setErrOtp(error)
  }

  async function handleForgot() {
    clearAll()
    if (!forgotEmail.trim())          { setErrForgot('Email is required.'); return }
    if (!isValidEmail(forgotEmail))   { setErrForgot('Enter a valid email address.'); return }
    setSubmitting(true)
    const { error } = await forgotPassword(forgotEmail.trim())
    setSubmitting(false)
    if (error) setErrForgot(error)
    else setOkForgot('Reset link sent! Check your inbox.')
  }

  async function handleGoogle() {
    clearAll(); setLoadingGoogle(true)
    await signInWithGoogle()
    setLoadingGoogle(false)
  }

  async function handleGuest() {
    clearAll(); setLoadingGuest(true)
    await signInAsGuest()
    setLoadingGuest(false)
  }

  // ── OTP cells ────────────────────────────────────────────────
  const otpCells = Array.from({ length: OTP_LEN }, (_, i) => otp[i] ?? '')

  // ── Sub-screens ───────────────────────────────────────────────
  function renderOtp() {
    return (
      <View style={s.formInner}>
        <TouchableOpacity onPress={() => goScreen('login')} style={{ marginBottom: 32 }}>
          <Text style={[s.body, { fontFamily: FB, color: C.ink }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.headingText, isWide && { fontSize: 34 }]}>Enter the code</Text>
        <Text style={[s.sub, { marginBottom: 34 }]}>
          Sent to <Text style={{ fontFamily: FB, color: C.ink }}>+62 {phone}</Text>
        </Text>

        {/* OTP cell display */}
        <View style={{ position: 'relative' }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
            {otpCells.map((char, i) => (
              <View key={i} style={[s.otpCell, char ? s.otpCellFilled : null]}>
                <Text style={s.otpChar}>{char}</Text>
              </View>
            ))}
          </View>
          <TextInput
            style={s.otpHidden}
            value={otp}
            onChangeText={v => { setOtp(v.replace(/\D/g, '').slice(0, OTP_LEN)); setErrOtp('') }}
            keyboardType="number-pad"
            maxLength={OTP_LEN}
            autoFocus
          />
        </View>
        {errOtp ? <Text style={s.fieldErr}>{errOtp}</Text> : null}

        <Text style={[s.body, { color: C.muted, marginTop: 24 }]}>
          {resend > 0 ? `Resend code in ${resend}s` : 'Didn\'t receive it? '}
          {resend === 0 && (
            <Text style={[s.body, { fontFamily: FB, color: C.coral }]} onPress={handleResend}>
              Resend code
            </Text>
          )}
        </Text>

        <TouchableOpacity
          style={[s.primaryBtn, isWide ? s.btnInk : s.btnLime, submitting && s.btnDisabled, { marginTop: 'auto' as any }]}
          onPress={handleVerify}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color={isWide ? '#fff' : C.ink} size="small" />
            : <Text style={[s.primaryBtnLabel, isWide && { color: '#fff' }]}>Verify &amp; log in</Text>
          }
        </TouchableOpacity>
      </View>
    )
  }

  function renderForgot() {
    return (
      <View style={s.formInner}>
        <TouchableOpacity onPress={() => goScreen('login')} style={{ marginBottom: 32 }}>
          <Text style={[s.body, { fontFamily: FB, color: C.ink }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.headingText, isWide && { fontSize: 34 }]}>Reset password</Text>
        <Text style={[s.sub, { marginBottom: 28 }]}>
          Enter your email and we'll send a reset link.
        </Text>

        <TextInput
          style={[s.input, errForgot ? s.inputErr : null]}
          placeholder="you@email.com"
          placeholderTextColor={C.placeholder}
          value={forgotEmail}
          onChangeText={v => { setForgotEmail(v); setErrForgot(''); setOkForgot('') }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {errForgot ? <Text style={s.fieldErr}>{errForgot}</Text> : null}
        {okForgot  ? <Text style={s.fieldOk}>{okForgot}</Text>   : null}

        <TouchableOpacity
          style={[s.primaryBtn, isWide ? s.btnInk : s.btnLime, submitting && s.btnDisabled]}
          onPress={handleForgot}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color={isWide ? '#fff' : C.ink} size="small" />
            : <Text style={[s.primaryBtnLabel, isWide && { color: '#fff' }]}>Send reset link</Text>
          }
        </TouchableOpacity>
      </View>
    )
  }

  function renderLoginForm() {
    const isSignup = screen === 'signup'
    return (
      <View style={s.formInner}>
        {/* Wordmark — mobile only */}
        {!isWide && (
          <Text style={s.wordmark}>
            patungan<Text style={{ color: C.coral }}>.</Text>
          </Text>
        )}

        {/* Heading */}
        <Text style={[s.headingText, isWide && { fontSize: 34, marginTop: 0 }]}>
          {isSignup ? 'Create account' : (
            isWide ? 'Welcome back' : <>Welcome back to{'\n'}the <Text style={{ color: C.coral }}>squad.</Text></>
          )}
        </Text>
        <Text style={s.sub}>
          {isSignup ? 'Join your crew on Patungan.' : 'Log in to settle up with your crew.'}
        </Text>

        {/* Segmented control — login only */}
        {!isSignup && (
          <View style={s.segTrack}>
            {(['email', 'phone'] as AuthMethod[]).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => switchMethod(m)}
                style={[s.segItem, method === m && s.segItemActive]}
              >
                <Text style={[s.segLabel, method === m && s.segLabelActive]}>
                  {m === 'email' ? 'Email' : 'Phone'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Phone mode */}
        {!isSignup && method === 'phone' ? (
          <>
            <View style={[s.phoneWrap, errPhone ? s.inputErr : null]}>
              <Text style={s.phonePrefix}>+62</Text>
              <View style={s.phoneDivider} />
              <TextInput
                style={s.phoneInput}
                placeholder="812 3456 7890"
                placeholderTextColor={C.placeholder}
                value={phone}
                onChangeText={v => { setPhone(v); setErrPhone('') }}
                keyboardType="phone-pad"
              />
            </View>
            {errPhone ? <Text style={s.fieldErr}>{errPhone}</Text> : null}
            <Text style={[s.body, { color: C.muted, marginTop: 8, marginBottom: 4, paddingLeft: 4 }]}>
              We'll text you a 6-digit code.
            </Text>
          </>
        ) : (
          <>
            {/* Display name — signup only */}
            {isSignup && (
              <>
                <TextInput
                  style={[s.input, errName ? s.inputErr : null]}
                  placeholder="Display name"
                  placeholderTextColor={C.placeholder}
                  value={displayName}
                  onChangeText={v => { setDisplayName(v); setErrName('') }}
                  autoCapitalize="words"
                />
                {errName ? <Text style={s.fieldErr}>{errName}</Text> : null}
              </>
            )}

            {/* Email */}
            <TextInput
              style={[s.input, errEmail ? s.inputErr : null]}
              placeholder="you@email.com"
              placeholderTextColor={C.placeholder}
              value={email}
              onChangeText={v => { setEmail(v); setErrEmail('') }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errEmail ? <Text style={s.fieldErr}>{errEmail}</Text> : null}

            {/* Password */}
            <View style={s.passWrap}>
              <TextInput
                style={[s.input, { marginBottom: 0, flex: 1, paddingRight: 60 }, errPass ? s.inputErr : null]}
                placeholder="Password"
                placeholderTextColor={C.placeholder}
                value={password}
                onChangeText={v => { setPassword(v); setErrPass('') }}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(p => !p)} style={s.showToggle}>
                <Text style={s.showToggleText}>{showPass ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {errPass ? <Text style={s.fieldErr}>{errPass}</Text> : null}

            {/* Forgot — login + email only */}
            {!isSignup && method === 'email' && (
              <TouchableOpacity onPress={() => goScreen('forgot')} style={s.forgotRow}>
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {okSignup ? <Text style={s.fieldOk}>{okSignup}</Text> : null}

        {/* Primary CTA */}
        <TouchableOpacity
          style={[s.primaryBtn, isWide ? s.btnInk : s.btnLime, submitting && s.btnDisabled]}
          onPress={isSignup ? handleSignup : handleLogin}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color={isWide ? '#fff' : C.ink} size="small" />
            : <Text style={[s.primaryBtnLabel, isWide && { color: '#fff' }]}>
                {isSignup ? 'Create account' : method === 'email' ? 'Log in' : 'Send code'}
              </Text>
          }
        </TouchableOpacity>

        {/* Divider + Google */}
        <View style={s.divRow}>
          <View style={s.divLine} />
          <Text style={s.divLabel}>or</Text>
          <View style={s.divLine} />
        </View>

        <TouchableOpacity style={[s.googleBtn, loadingGoogle && s.btnDisabled]} onPress={handleGoogle} disabled={loadingGoogle}>
          {loadingGoogle
            ? <ActivityIndicator color={C.coral} size="small" />
            : <>
                <Text style={s.googleG}>G</Text>
                <Text style={s.googleBtnLabel}>Continue with Google</Text>
              </>
          }
        </TouchableOpacity>

        {/* Footer */}
        <View style={[s.footer, isWide && { flexDirection: 'row', justifyContent: 'space-between' }]}>
          {!isSignup && (
            <TouchableOpacity onPress={handleGuest} disabled={loadingGuest}>
              <Text style={s.guestLink}>{loadingGuest ? 'Entering…' : 'Continue as guest'}</Text>
            </TouchableOpacity>
          )}
          <Text style={[s.footerMuted, isWide && { marginTop: 0 }]}>
            {isSignup ? 'Have an account? ' : 'New here? '}
            <Text
              style={s.footerAction}
              onPress={() => {
                clearAll()
                setEmail(''); setPassword(''); setDisplayName('')
                goScreen(isSignup ? 'login' : 'signup')
              }}
            >
              {isSignup ? 'Sign in' : 'Create account'}
            </Text>
          </Text>
        </View>
      </View>
    )
  }

  // ── Web brand panel ───────────────────────────────────────────
  function renderBrandPanel() {
    return (
      <View style={s.brandPanel}>
        {/* Coral blob */}
        <View style={s.brandBlob} pointerEvents="none" />
        <Text style={s.brandWordmark}>
          patungan<Text style={{ color: C.coral }}>.</Text>
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={s.brandHeadline}>
          Split the bill,{'\n'}not the{'\n'}<Text style={{ color: C.coral }}>friendship.</Text>
        </Text>
        <Text style={s.brandSub}>
          Track who paid for what on your next trip — and settle up in one tap.
        </Text>
        <View style={s.avatarRow}>
          {[C.ink, C.coral, C.cream, C.ink].map((bg, i) => (
            <View key={i} style={[s.avatar, { backgroundColor: bg, marginLeft: i > 0 ? -12 : 0 }]}>
              {i === 3 && <Text style={[s.body, { color: C.lime, fontFamily: FB, fontSize: 13 }]}>+5</Text>}
            </View>
          ))}
          <Text style={[s.body, { color: C.brandDark, fontFamily: FSB, marginLeft: 14 }]}>joined this week</Text>
        </View>
      </View>
    )
  }

  // ── Root render ───────────────────────────────────────────────
  const activeContent = screen === 'otp' ? renderOtp()
    : screen === 'forgot' ? renderForgot()
    : renderLoginForm()

  if (isWide) {
    return (
      <View style={s.webRoot}>
        {renderBrandPanel()}
        <ScrollView
          style={s.webFormPanel}
          contentContainerStyle={s.webFormScroll}
          showsVerticalScrollIndicator={false}
        >
          {activeContent}
        </ScrollView>
      </View>
    )
  }

  return (
    <ScrollView
      style={s.mobileRoot}
      contentContainerStyle={s.mobileScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {activeContent}
    </ScrollView>
  )
}

// ── Styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Mobile root
  mobileRoot:   { flex: 1, backgroundColor: C.cream },
  mobileScroll: { flexGrow: 1, paddingHorizontal: 26, paddingVertical: 40, justifyContent: 'center' },

  // Web root
  webRoot:       { flex: 1, flexDirection: 'row', backgroundColor: C.surface },
  webFormPanel:  { flex: 1 },
  webFormScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  // Brand panel (web)
  brandPanel: {
    width: '46%' as any, minWidth: 420, backgroundColor: C.lime,
    padding: 56, paddingHorizontal: 60, flexDirection: 'column', overflow: 'hidden',
  },
  brandBlob: {
    position: 'absolute', width: 380, height: 380, borderRadius: 190,
    backgroundColor: C.coral, opacity: 0.18, top: -120, right: -100,
  },
  brandWordmark: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  brandHeadline: {
    fontFamily: 'SpaceGrotesk_700Bold', fontSize: 54, lineHeight: 58,
    color: C.ink, letterSpacing: -1.8, marginTop: 'auto' as any,
  },
  brandSub: {
    fontFamily: 'PlusJakartaSans_500Medium', fontSize: 17, lineHeight: 26,
    color: C.brandDark, marginTop: 22, maxWidth: 380,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginTop: 34 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 3, borderColor: C.lime,
    alignItems: 'center', justifyContent: 'center',
  },

  // Shared form
  formInner: { width: '100%', maxWidth: 440 },

  // Wordmark (mobile)
  wordmark: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: C.ink, letterSpacing: -0.5, marginBottom: 34 },

  // Headings
  headingText: {
    fontFamily: 'SpaceGrotesk_700Bold', fontSize: 30, lineHeight: 36,
    color: C.ink, letterSpacing: -0.6, marginBottom: 6,
  },
  sub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: C.muted, marginBottom: 18 },

  // Segmented control
  segTrack: {
    flexDirection: 'row', backgroundColor: C.surfaceAlt,
    borderRadius: 13, padding: 4, marginBottom: 14,
  },
  segItem:       { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segItemActive: { backgroundColor: C.surface, shadowColor: C.ink, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segLabel:      { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: C.muted2 },
  segLabelActive:{ color: C.ink },

  // Inputs
  input: {
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 14, padding: 15, paddingHorizontal: 16,
    fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: C.ink,
    marginBottom: 10,
  },
  inputErr: { borderColor: C.err },
  passWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  showToggle: { position: 'absolute', right: 16, top: 15 },
  showToggleText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink },

  // Phone input
  phoneWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderWidth: 1.5, borderColor: C.border, borderRadius: 14,
    paddingHorizontal: 16, marginBottom: 10,
  },
  phonePrefix: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.ink },
  phoneDivider: { width: 1, height: 24, backgroundColor: C.border, marginHorizontal: 12 },
  phoneInput: {
    flex: 1, paddingVertical: 15,
    fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, color: C.ink,
  },

  // Forgot link
  forgotRow: { alignSelf: 'flex-end', marginBottom: 4 },
  forgotText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.ink },

  // Errors / success
  fieldErr: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: C.err, marginTop: -6, marginBottom: 8, paddingLeft: 4 },
  fieldOk:  { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#2e7d32', marginBottom: 10, paddingLeft: 4 },

  // Buttons
  primaryBtn: {
    height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 14,
  },
  btnLime: { backgroundColor: C.lime, shadowColor: C.lime, shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  btnInk:  { backgroundColor: C.ink },
  btnDisabled: { opacity: 0.6 },
  primaryBtnLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: C.ink },

  // Divider
  divRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 4 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divLabel:{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: C.muted2, marginHorizontal: 12 },

  // Google button
  googleBtn: {
    height: 50, borderRadius: 15, backgroundColor: C.surface,
    borderWidth: 1.5, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 14,
  },
  googleG:       { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, color: C.googleG },
  googleBtnLabel:{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: C.ink },

  // Footer
  footer:      { marginTop: 22, alignItems: 'center' },
  guestLink:   { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.ink, borderBottomWidth: 2, borderBottomColor: C.coral, paddingBottom: 1 },
  footerMuted: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: C.muted, marginTop: 12 },
  footerAction:{ fontFamily: 'PlusJakartaSans_700Bold', color: C.coral },

  // OTP
  otpCell: {
    flex: 1, height: 60, borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  otpCellFilled: { borderColor: C.ink },
  otpChar:  { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: C.ink },
  otpHidden: {
    position: 'absolute', opacity: 0, width: '100%', height: '100%',
    backgroundColor: 'transparent', color: 'transparent',
  },

  // Shared text
  body: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: C.ink },
})
