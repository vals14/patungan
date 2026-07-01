import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useAuth } from '../../../src/context/AuthContext'
import { scanReceipt, uploadReceiptImage } from '../../../src/services/ocrService'
import { Colors, Radii, Spacing } from '../../../src/theme'
import { Toast } from '../../../src/components/Toast'

export default function ScanScreen() {
  // Context carried in from new.tsx so it survives the round trip back.
  const params = useLocalSearchParams<{
    groupId: string
    title?: string
    currency?: string
    category?: string
  }>()
  const { user } = useAuth()

  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { showToast('Camera permission is needed to scan.'); return }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (!result.canceled) handleImage(result.assets[0].uri)
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { showToast('Photo access is needed to pick a receipt.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (!result.canceled) handleImage(result.assets[0].uri)
  }

  async function handleImage(uri: string) {
    setPreview(uri)
    setBusy(true)
    try {
      // Downscale to max 1600px wide and re-encode as JPEG with base64.
      // Receipts don't need full resolution; smaller uploads + OCR faster.
      setStatusText('Preparing image…')
      console.log('[scan] got image uri:', uri)
      const context = ImageManipulator.manipulate(uri)
      context.resize({ width: 1600 })
      const rendered = await context.renderAsync()
      const manipulated = await rendered.saveAsync({
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      })
      const base64 = manipulated.base64
      console.log('[scan] manipulated, base64 length:', base64?.length ?? 0)
      if (!base64) throw new Error('Could not process the image.')

      // Fire OCR and upload in parallel — upload failure must not block the scan.
      setStatusText('Reading the receipt…')
      console.log('[scan] calling OCR + upload…')
      const [ocr, imageUrl] = await Promise.all([
        scanReceipt(base64, 'receipt.jpg'),
        user ? uploadReceiptImage(base64, user.id) : Promise.resolve(null),
      ])
      console.log('[scan] OCR ok:', ocr.line_items.length, 'items, total', ocr.total, ocr.currency, '| upload:', imageUrl ? 'ok' : 'none')

      // Hand off to the review screen with extracted items.
      router.replace({
        pathname: '/(app)/expense/review',
        params: {
          groupId: params.groupId,
          title: params.title ?? '',
          currency: params.currency ?? '',
          category: params.category ?? '',
          ocrItems: JSON.stringify(ocr.line_items),
          ocrTax: String(ocr.tax),
          ocrService: String(ocr.service),
          ocrDiscount: String(ocr.discount),
          ocrTotal: String(ocr.total),
          ocrCurrency: ocr.currency,
          receiptImageUrl: imageUrl ?? '',
        },
      })
    } catch (e: any) {
      console.error('[scan] failed:', e)
      setBusy(false)
      setPreview(null)
      // Persist the real error on screen until dismissed, so it can be read
      // (the toast auto-hides too fast for a long message).
      setErrorMsg(e?.message ?? 'Scan failed. Try again or enter manually.')
      showToast(e?.message ?? 'Scan failed. Try again or enter manually.')
    }
  }

  function goManual() {
    // Fall back to the manual single-screen form, keeping any context entered so far.
    router.replace({
      pathname: '/(app)/expense/new',
      params: {
        groupId: params.groupId,
        title: params.title ?? '',
        currency: params.currency ?? '',
        category: params.category ?? '',
      },
    })
  }

  return (
    <View style={styles.container}>
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={busy}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>SCAN RECEIPT</Text>
      </View>

      {busy ? (
        <View style={styles.busyWrap}>
          {preview && <Image source={{ uri: preview }} style={styles.previewImage} />}
          <ActivityIndicator color={Colors.lime} size="large" style={{ marginTop: 24 }} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      ) : (
        <View style={styles.choiceWrap}>
          <Text style={styles.lead}>Add a receipt</Text>
          <Text style={styles.subLead}>
            Snap a photo or pick from your gallery. We'll pull out the items — you can fix anything before splitting.
          </Text>

          {!!errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.bigBtn} onPress={pickFromCamera}>
            <Text style={styles.bigBtnEmoji}>📷</Text>
            <View>
              <Text style={styles.bigBtnTitle}>Take a photo</Text>
              <Text style={styles.bigBtnSub}>Use the camera</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.bigBtn, styles.bigBtnAlt]} onPress={pickFromGallery}>
            <Text style={styles.bigBtnEmoji}>🖼️</Text>
            <View>
              <Text style={styles.bigBtnTitleAlt}>Choose from gallery</Text>
              <Text style={styles.bigBtnSubAlt}>Pick an existing photo</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.manualLink} onPress={goManual}>
            <Text style={styles.manualLinkText}>Or enter items manually instead</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.screenH, paddingTop: 56, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: Radii.backButton, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.ink },
  screenTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },

  choiceWrap: { paddingHorizontal: Spacing.screenH },
  lead: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: Colors.ink, letterSpacing: -0.4 },
  subLead: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: Colors.textMuted, marginTop: 8, marginBottom: 28, lineHeight: 20 },

  bigBtn: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: Colors.ink, borderRadius: Radii.card, padding: 20, marginBottom: 12 },
  bigBtnAlt: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border },
  bigBtnEmoji: { fontSize: 28 },
  // Dark button: light text on the ink fill for contrast.
  bigBtnTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.textOnDark },
  bigBtnSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.textOnDarkMuted, marginTop: 2 },
  // Light button: ink text on the card fill.
  bigBtnTitleAlt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.ink },
  bigBtnSubAlt: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  errorBox: { backgroundColor: '#FDECE7', borderWidth: 1, borderColor: Colors.coral, borderRadius: Radii.input, padding: 14, marginBottom: 20 },
  errorText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#B23A1E', lineHeight: 18 },

  manualLink: { alignItems: 'center', marginTop: 16, padding: 12 },
  manualLinkText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: Colors.textMuted },

  busyWrap: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.screenH },
  previewImage: { width: 200, height: 260, borderRadius: Radii.card, resizeMode: 'cover' },
  statusText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: Colors.textMuted, marginTop: 16 },
})
