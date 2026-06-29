import { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet } from 'react-native'
import { Colors, Shadows } from '../theme'

interface Props {
  message: string
  visible: boolean
  onHide: () => void
  duration?: number
}

export function Toast({ message, visible, onHide, duration = 2200 }: Props) {
  const translateY = useRef(new Animated.Value(-8)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start()

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => onHide())
    }, duration)

    return () => clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  return (
    <Animated.View style={[s.toast, { opacity, transform: [{ translateY }] }]}>
      <Text style={s.text}>{message}</Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    backgroundColor: Colors.toastBg,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
    zIndex: 80,
    ...Shadows.toast,
  },
  text: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: Colors.surface,
  },
})
