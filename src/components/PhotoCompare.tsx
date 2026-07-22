import { useEffect, useState } from 'react'
import {
  View, Text, Image, Modal, FlatList, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { BG, CARD, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI, ACCENT } from '@/lib/theme'
import { GlassCircleButton } from '@/components/GlassButton'
import type { ProgressPhotoItem } from '@/services/progressPhotos'

// =============================================================================
// JÄMFÖR FRAMSTEGSFOTON — välj två foton från olika dagar och se dem sida
// vid sida med dagetiketter, datum och antal dagar emellan.
// =============================================================================

const SCREEN_W = Dimensions.get('window').width
const GRID_GAP = 8
const CELL_W = (SCREEN_W - 40 - GRID_GAP * 2) / 3

function fmtDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')
}

export function PhotoCompare({ visible, photos, onClose }: {
  visible: boolean
  photos: ProgressPhotoItem[]
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const [selected, setSelected] = useState<string[]>([])
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    if (visible) { setSelected([]); setShowResult(false) }
  }, [visible])

  // Äldsta först i rutnätet — man letar oftast efter startfotot
  const sorted = [...photos].sort((a, b) => a.dayNumber - b.dayNumber)

  function toggle(id: string) {
    Haptics.selectionAsync()
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length < 2) return [...prev, id]
      // Två redan valda → byt ut det senast valda
      return [prev[0], id]
    })
  }

  const pair = selected
    .map(id => photos.find(p => p.id === id))
    .filter((p): p is ProgressPhotoItem => !!p)
    .sort((a, b) => a.dayNumber - b.dayNumber)
  const daysBetween = pair.length === 2 ? Math.abs(pair[1].dayNumber - pair[0].dayNumber) : 0

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <GlassCircleButton
            icon="chevron-back"
            onPress={() => (showResult ? setShowResult(false) : onClose())}
          />
          <Text style={s.topTitle}>{showResult ? 'Jämförelse' : 'Välj två foton'}</Text>
          <View style={{ width: 44 }} />
        </View>

        {showResult && pair.length === 2 ? (
          <View style={s.resultWrap}>
            <Text style={s.resultHead}>
              <Text style={s.resultHeadNum}>{daysBetween}</Text> dagar emellan
            </Text>
            <View style={s.resultRow}>
              {pair.map(p => (
                <View key={p.id} style={s.resultCol}>
                  {p.url ? (
                    <Image source={{ uri: p.url }} style={s.resultImage} resizeMode="cover" />
                  ) : (
                    <View style={[s.resultImage, s.missing]}>
                      <Ionicons name="image-outline" size={28} color={TEXT_SECONDARY} />
                    </View>
                  )}
                  <Text style={s.resultDay}>
                    Dag <Text style={s.resultDayNum}>{p.dayNumber}</Text>
                  </Text>
                  <Text style={s.resultDate}>{fmtDate(p.createdAt)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            <Text style={s.hint}>
              Tryck på två foton från olika dagar — startfotot hamnar till vänster.
            </Text>
            <FlatList
              data={sorted}
              keyExtractor={p => p.id}
              numColumns={3}
              columnWrapperStyle={{ gap: GRID_GAP }}
              contentContainerStyle={s.grid}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const idx = selected.indexOf(item.id)
                return (
                  <TouchableOpacity
                    style={[s.cell, idx >= 0 && s.cellSelected]}
                    activeOpacity={0.8}
                    onPress={() => toggle(item.id)}
                  >
                    {item.url ? (
                      <Image source={{ uri: item.url }} style={s.cellImage} resizeMode="cover" />
                    ) : (
                      <View style={[s.cellImage, s.missing]}>
                        <Ionicons name="image-outline" size={20} color={TEXT_SECONDARY} />
                      </View>
                    )}
                    <View style={s.cellDay}>
                      <Text style={s.cellDayText}>Dag {item.dayNumber}</Text>
                    </View>
                    {idx >= 0 && (
                      <View style={s.cellBadge}>
                        <Text style={s.cellBadgeText}>{idx + 1}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              }}
            />
            <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity
                style={[s.compareBtn, selected.length !== 2 && s.compareBtnDisabled]}
                disabled={selected.length !== 2}
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowResult(true)
                }}
              >
                <Ionicons name="git-compare-outline" size={17} color="#000" />
                <Text style={s.compareBtnText}>
                  {selected.length === 2 ? 'Jämför' : `Välj ${2 - selected.length} till`}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  topTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
  hint: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, marginBottom: 12 },

  grid: { paddingHorizontal: 20, gap: GRID_GAP, paddingBottom: 100 },
  cell: {
    width: CELL_W, aspectRatio: 4 / 5, borderRadius: 12, overflow: 'hidden',
    backgroundColor: CARD,
  },
  cellSelected: { borderWidth: 2.5, borderColor: ACCENT },
  cellImage: { width: '100%', height: '100%' },
  cellDay: {
    position: 'absolute', left: 6, bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 7,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  cellDayText: { color: '#fff', fontSize: 10, fontFamily: NUM_FONT_SEMI },
  cellBadge: {
    position: 'absolute', right: 6, top: 6,
    width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  cellBadgeText: { color: '#000', fontSize: 12, fontFamily: NUM_FONT },
  missing: { alignItems: 'center', justifyContent: 'center' },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 10,
  },
  compareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15,
  },
  compareBtnDisabled: { opacity: 0.35 },
  compareBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },

  resultWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  resultHead: {
    color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600',
    textAlign: 'center', marginBottom: 14,
  },
  resultHeadNum: { color: ACCENT, fontFamily: NUM_FONT, fontSize: 16 },
  resultRow: { flexDirection: 'row', gap: 10 },
  resultCol: { flex: 1 },
  resultImage: {
    width: '100%', aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: CARD,
  },
  resultDay: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700', marginTop: 10 },
  resultDayNum: { fontFamily: NUM_FONT, fontSize: 15 },
  resultDate: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
})
