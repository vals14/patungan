import { View, Text, StyleSheet } from 'react-native'
import { AvatarPalette, Radii } from '../theme'

interface Props {
  name: string
  index?: number
  size?: number
  tile?: boolean
}

export function Avatar({ name, index = 0, size = 40, tile = false }: Props) {
  const palette = AvatarPalette[index % AvatarPalette.length]
  const initial = name.charAt(0).toUpperCase()
  const borderRadius = tile ? Radii.avatarTile : size / 2

  return (
    <View style={[s.container, { width: size, height: size, borderRadius, backgroundColor: palette.bg }]}>
      <Text style={[s.initial, { color: palette.text, fontSize: size * 0.38 }]}>
        {initial}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'SpaceGrotesk_700Bold' },
})
