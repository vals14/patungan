import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { Colors, Shadows } from '../theme'

interface Props {
  onAddPress?: () => void
}

export function BottomNav({ onAddPress }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const isHome = pathname === '/home' || pathname === '/' || pathname.startsWith('/group/')
  const isActivity = pathname === '/activity'

  return (
    <View style={s.bar}>
      <TouchableOpacity style={s.tab} onPress={() => router.push('/(app)/home')} activeOpacity={0.7}>
        <View style={[s.icon, isHome && s.iconActive]}>
          {Platform.OS === 'web' ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
                stroke={isHome ? Colors.ink : Colors.textMuted} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
              <path d="M8 20V13h6v7" stroke={isHome ? Colors.ink : Colors.textMuted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </View>
        <Text style={[s.label, isHome && s.labelActive]}>Home</Text>
      </TouchableOpacity>

      <View style={s.fabWrapper}>
        <TouchableOpacity style={s.fab} onPress={onAddPress} activeOpacity={0.85}>
          {Platform.OS === 'web' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke={Colors.ink} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          ) : (
            <Text style={s.fabPlus}>+</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.tab} onPress={() => router.push('/(app)/activity' as any)} activeOpacity={0.7}>
        <View style={[s.icon, isActivity && s.iconActive]}>
          {Platform.OS === 'web' ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="8" stroke={isActivity ? Colors.ink : Colors.textMuted} strokeWidth="1.6" />
              <path d="M11 7v4l3 2" stroke={isActivity ? Colors.ink : Colors.textMuted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </View>
        <Text style={[s.label, isActivity && s.labelActive]}>Activity</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconActive: {
    backgroundColor: Colors.lime,
  },
  label: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
  },
  labelActive: {
    color: Colors.ink,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    marginTop: -24,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.limeFab,
  },
  fabPlus: {
    fontSize: 28,
    color: Colors.ink,
    lineHeight: 30,
  },
})
