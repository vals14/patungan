import { Redirect, Stack, useGlobalSearchParams } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { GroupsProvider, useGroups } from '../../src/context/GroupsContext'

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: '#F7F4EC', ink: '#14140F', lime: '#B7F84A', coral: '#FF6B4A',
  white: '#FFFFFF', muted2: '#9A9484', border: '#EFE9DC',
}
const SG7 = 'SpaceGrotesk_700Bold'
const PJ5 = 'PlusJakartaSans_500Medium'
const PJ6 = 'PlusJakartaSans_600SemiBold'
const PJ7 = 'PlusJakartaSans_700Bold'

const TILE_PALETTE = [
  { bg: '#B7F84A', text: '#14140F' }, { bg: '#FF6B4A', text: '#ffffff' },
  { bg: '#14140F', text: '#B7F84A' }, { bg: '#FEC84B', text: '#14140F' },
  { bg: '#C9C3B4', text: '#14140F' }, { bg: '#8B8576', text: '#ffffff' },
]

function SvgIcon({ paths, size = 19, color = '#A39C8B', cx, cy, r }: {
  paths?: string[]; size?: number; color?: string; cx?: number; cy?: number; r?: number
}) {
  if (Platform.OS !== 'web') return null
  const El: any = 'svg'; const P: any = 'path'; const Ci: any = 'circle'
  return (
    <El width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}>
      {paths?.map((d, i) => <P key={i} d={d} />)}
      {cx != null && <Ci cx={cx} cy={cy} r={r} />}
    </El>
  )
}

const ICO = {
  home:     ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5'],
  activity: ['M3 12h4l2.5 6 5-14L17 12h4'],
  profile:  ['M5.5 20a6.5 6.5 0 0 1 13 0'],
  link:     ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
             'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  logout:   ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
}

function WebSidebar() {
  const { user, signOut } = useAuth()
  const { groups } = useGroups()
  const { id: activeGroupId } = useGlobalSearchParams<{ id: string }>()

  const displayName = user?.display_name ?? ''
  const initial = displayName.charAt(0).toUpperCase()
  const isHome = !activeGroupId

  return (
    <View style={s.sidebar}>
      <Text style={s.wordmark}>patungan<Text style={{ color: C.coral }}>.</Text></Text>

      <View style={s.navList}>
        <TouchableOpacity style={[s.navItem, isHome && s.navItemActive]} onPress={() => router.push('/(app)/home')}>
          <SvgIcon paths={ICO.home} color={isHome ? C.ink : '#A39C8B'} />
          <Text style={[s.navText, isHome && { color: C.ink, fontFamily: PJ7 }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem}>
          <SvgIcon paths={ICO.activity} color="#A39C8B" />
          <Text style={s.navText}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/(app)/group/join/prompt')}>
          <SvgIcon paths={ICO.link} color="#A39C8B" />
          <Text style={s.navText}>Join group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={signOut}>
          <SvgIcon paths={ICO.logout} color="#A39C8B" />
          <Text style={s.navText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {groups.length > 0 && (
        <>
          <Text style={s.sideGroupsLabel}>YOUR GROUPS</Text>
          {groups.map((ag, i) => {
            const t = TILE_PALETTE[i % TILE_PALETTE.length]
            const isActive = ag.group.id === activeGroupId
            return (
              <TouchableOpacity
                key={ag.group.id}
                style={[s.sideGroupItem, isActive && s.sideGroupItemActive]}
                onPress={() => router.push(`/(app)/group/${ag.group.id}`)}
              >
                <View style={[s.sideGroupTile, { backgroundColor: t.bg }]}>
                  <Text style={{ color: t.text, fontFamily: SG7, fontSize: 12 }}>
                    {ag.group.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={s.sideGroupName} numberOfLines={1}>{ag.group.name}</Text>
              </TouchableOpacity>
            )
          })}
        </>
      )}

      <View style={s.userChip}>
        <View style={s.userChipAvatar}><Text style={s.userChipAvatarText}>{initial}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.userChipName} numberOfLines={1}>{displayName}</Text>
          <Text style={s.userChipEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
        </View>
      </View>
    </View>
  )
}

function AppShell() {
  const { width } = useWindowDimensions()
  const isWide = width >= 900

  if (!isWide || Platform.OS !== 'web') {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: C.bg },
        }}
      />
    )
  }

  return (
    <View style={s.root}>
      <WebSidebar />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: C.bg },
          }}
        />
      </View>
    </View>
  )
}

export default function AppLayout() {
  const { session, loading } = useAuth()
  if (!loading && !session) return <Redirect href="/(auth)/login" />

  return (
    <GroupsProvider>
      <AppShell />
    </GroupsProvider>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },

  sidebar: { width: 256, backgroundColor: C.white, borderRightWidth: 1, borderRightColor: C.border, paddingHorizontal: 18, paddingVertical: 26, flexDirection: 'column' },
  wordmark: { fontFamily: SG7, fontSize: 24, color: C.ink, paddingHorizontal: 12, letterSpacing: -0.4, marginBottom: 34 },

  navList: { gap: 4 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 13 },
  navItemActive: { backgroundColor: '#EDF7D6' },
  navText: { fontFamily: PJ6, fontSize: 14.5, color: '#6B6B60' },

  sideGroupsLabel: { fontFamily: PJ7, fontSize: 10.5, color: C.muted2, letterSpacing: 1.2, marginTop: 26, marginBottom: 8, paddingHorizontal: 14 },
  sideGroupItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11 },
  sideGroupItemActive: { backgroundColor: '#EDF7D6' },
  sideGroupTile: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sideGroupName: { fontFamily: PJ6, fontSize: 13.5, color: C.ink, flex: 1 },

  userChip: { marginTop: 'auto' as any, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: C.bg },
  userChipAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userChipAvatarText: { fontFamily: SG7, fontSize: 17, color: C.ink },
  userChipName: { fontFamily: PJ7, fontSize: 14, color: C.ink },
  userChipEmail: { fontFamily: PJ5, fontSize: 12, color: C.muted2 },
})
