export const Colors = {
  surface: '#F7F4EC',
  card: '#FFFFFF',
  tabTrack: '#ECE6D7',
  inputFill: '#F2EEE3',

  ink: '#14140F',
  lime: '#B7F84A',
  coral: '#FF6B4A',

  textPrimary: '#14140F',
  textMuted: '#8B8576',
  textTertiary: '#9A9484',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#8E968A',

  positive: '#1E7A46',
  negative: '#E0452A',

  border: '#E7E1D2',
  borderLight: '#EFE9DC',

  toastBg: '#14140F',
  scrim: 'rgba(20,20,15,0.45)',
} as const

export const Fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  displaySemiBold: 'SpaceGrotesk_600SemiBold',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtraBold: 'PlusJakartaSans_800ExtraBold',
} as const

export const FontSizes = {
  heroBalance: 40,
  screenTitle: 24,
  sectionTitle: 18,
  itemTitle: 15,
  body: 14,
  label: 13,
  caption: 12,
  eyebrow: 11,
} as const

export const Radii = {
  card: 18,
  input: 14,
  sheet: 30,
  button: 16,
  pill: 13,
  avatar: 999,
  avatarTile: 14,
  backButton: 13,
} as const

export const Spacing = {
  screenH: 22,
  itemGap: 10,
  cardPad: 18,
  sectionGap: 24,
} as const

export const Shadows = {
  limeButton: {
    shadowColor: '#B7F84A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  limeFab: {
    shadowColor: '#B7F84A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 10,
  },
  toast: {
    shadowColor: '#14140F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 10,
  },
  dropdown: {
    shadowColor: '#14140F',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
    elevation: 12,
  },
} as const

export const AvatarPalette = [
  { bg: '#B7F84A', text: '#14140F' },
  { bg: '#FF6B4A', text: '#FFFFFF' },
  { bg: '#14140F', text: '#B7F84A' },
  { bg: '#FEC84B', text: '#14140F' },
  { bg: '#C9C3B4', text: '#14140F' },
  { bg: '#8B8576', text: '#FFFFFF' },
] as const
