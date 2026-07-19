import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Image, Modal, FlatList, StyleSheet, Dimensions, Alert,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { RED, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT_SEMI } from '@/lib/theme'
import { GlassCircleButton } from '@/components/GlassButton'
import type { ProgressPhotoItem } from '@/services/progressPhotos'

// =============================================================================
// FOTOVISAREN — fullskärm över dagboken: svep i sidled mellan foton,
// dag och bildtext under, radering bor här (inte i flödet).
// =============================================================================

const SCREEN_W = Dimensions.get('window').width

function fmtDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PhotoViewer({ photos, initialIndex, onClose, onDelete }: {
  photos: ProgressPhotoItem[]
  /** null = stängd */
  initialIndex: number | null
  onClose: () => void
  onDelete: (photo: ProgressPhotoItem) => void
}) {
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList<ProgressPhotoItem>>(null)

  useEffect(() => {
    if (initialIndex !== null) setIndex(Math.min(initialIndex, Math.max(0, photos.length - 1)))
  }, [initialIndex])

  // Fotot kan ha raderats utifrån — håll indexet inom listan
  useEffect(() => {
    if (index > photos.length - 1) setIndex(Math.max(0, photos.length - 1))
  }, [photos.length])

  const current = photos[index]

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
  }

  function confirmDelete() {
    if (!current) return
    Alert.alert('Vill du verkligen ta bort?', 'Fotot och texten tas bort permanent. Det går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort', style: 'destructive',
        onPress: () => {
          onDelete(current)
          if (photos.length <= 1) onClose()
        },
      },
    ])
  }

  return (
    <Modal
      visible={initialIndex !== null}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={p => p.id}
          initialScrollIndex={initialIndex ?? 0}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item }) => (
            <View style={s.page}>
              {item.url ? (
                <Image source={{ uri: item.url }} style={s.image} resizeMode="contain" />
              ) : (
                <View style={s.missing}>
                  <Ionicons name="image-outline" size={40} color={TEXT_SECONDARY} />
                </View>
              )}
            </View>
          )}
        />

        {/* Toppbar */}
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <GlassCircleButton icon="chevron-back" onPress={onClose} />
          {current && (
            <Text style={s.topTitle}>
              Dag <Text style={s.topTitleNum}>{current.dayNumber}</Text>
            </Text>
          )}
          <GlassCircleButton icon="trash-outline" iconColor={RED} onPress={confirmDelete} />
        </View>

        {/* Bildtext + datum */}
        {current && (
          <View style={[s.footer, { paddingBottom: insets.bottom + 20 }]} pointerEvents="none">
            {!!current.caption && <Text style={s.caption}>{current.caption}</Text>}
            <Text style={s.date}>
              {fmtDate(current.createdAt)}
              {photos.length > 1 ? `  ·  ${index + 1} av ${photos.length}` : ''}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  page: { width: SCREEN_W, justifyContent: 'center' },
  image: { width: SCREEN_W, height: '100%' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    position: 'absolute', left: 0, right: 0, top: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  topTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  topTitleNum: { fontFamily: NUM_FONT_SEMI, fontSize: 17 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 24, gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingTop: 14,
  },
  caption: { color: TEXT_PRIMARY, fontSize: 15, lineHeight: 22 },
  date: { color: TEXT_SECONDARY, fontSize: 12, fontFamily: NUM_FONT_SEMI },
})
