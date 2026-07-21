import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { GlassCircleButton } from '@/components/GlassButton'
import { BG, CARD, BORDER, CARDIO_BLUE, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import { parseLocalDate } from '@/lib/date'
import { getUnitSystem, toDisplayDistance, distanceUnitLabel, type UnitSystem } from '@/lib/units'
import { parseRunTarget, paceToSec, paceRangeForUnit, buildRunSegments, RUN_RECIPE, type RunTarget } from '@/lib/runProgression'
import { RUN_SESSION_INFO } from '@/services/scheduleGenerator'

// =============================================================================
// PASS-DETALJ FÖR GENERERADE LÖPPASS — öppnas när man startar ett schemalagt
// cardiopass. Visar veckans mål, passets upplägg (uppvärmning/pass/nedvarvning)
// och tempoförslag, och startar GPS-löpningen med målet förifyllt — man ska
// inte behöva sätta upp ett eget mål för ett pass planen redan bestämt.
// =============================================================================

const TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  running:  'fitness-outline',
  cycling:  'bicycle-outline',
  walking:  'walk-outline',
  interval: 'flash-outline',
}

interface Part {
  tag:  'VÄRM UPP' | 'PASS' | 'VARVA NER'
  text: string
  sub?: string
}

const fmtNum = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/** Passets delar utifrån typnamn + veckans mål — vår egen struktur, inte en mall.
    Distanser lagras i km men visas i vald enhet. */
function buildParts(baseName: string, t: RunTarget, unit: UnitSystem): Part[] {
  const u = distanceUnitLabel(unit)
  const dist = (km: number) => `${fmtNum(toDisplayDistance(km, unit))} ${u}`
  const pace = t.pace ? `ca ${paceRangeForUnit(t.pace, unit)}` : undefined
  // Nycklas på målets sort, inte passnamnet — omdöpta pass behåller strukturen
  if (t.kind === 'interval') {
    return [
      { tag: 'VÄRM UPP',  text: `${dist(RUN_RECIPE.warmupM / 1000)} lugn jogg` },
      {
        tag: 'PASS',
        text: `${t.reps}×${t.intervalM} m i hög fart`,
        sub: [pace, `${RUN_RECIPE.restS} s gång- eller joggvila mellan varje`].filter(Boolean).join(' · '),
      },
      { tag: 'VARVA NER', text: `${dist(RUN_RECIPE.cooldownIntervalM / 1000)} lugn jogg` },
    ]
  }
  if (t.kind === 'distance' && t.km != null) {
    const km = dist(t.km)
    if (baseName === 'Tempopass') {
      return [
        { tag: 'VÄRM UPP',  text: `${dist(RUN_RECIPE.warmupM / 1000)} lugn jogg` },
        { tag: 'PASS',      text: `${km} i tempofart`, sub: pace ?? 'Jämn, ansträngande fart — strax under tävlingstempo' },
        { tag: 'VARVA NER', text: `${dist(RUN_RECIPE.cooldownTempoM / 1000)} lugn jogg` },
      ]
    }
    if (baseName === 'Maratonfart') {
      return [
        { tag: 'VÄRM UPP',  text: `${dist(RUN_RECIPE.warmupM / 1000)} lugn jogg` },
        { tag: 'PASS',      text: `${km} i maratonfart`, sub: pace ?? 'Din tänkta tävlingsfart' },
        { tag: 'VARVA NER', text: `${dist(RUN_RECIPE.cooldownTempoM / 1000)} lugn jogg` },
      ]
    }
    if (baseName === 'Fartlek') {
      return [
        { tag: 'VÄRM UPP',  text: `${Math.round(RUN_RECIPE.fartlekWarmupS / 60)} min lugn jogg` },
        { tag: 'PASS',      text: `${km} fartlek`, sub: 'Växla fritt mellan snabbt och lugnt — lek med farten' },
        { tag: 'VARVA NER', text: `${Math.round(RUN_RECIPE.fartlekCooldownS / 60)} min lugn jogg` },
      ]
    }
    if (baseName === 'Distanspass') {
      return [{ tag: 'PASS', text: `${km} i jämn, behaglig fart`, sub: pace }]
    }
    // Långpass och övriga distanspass
    return [{ tag: 'PASS', text: `${km} i lugn, pratvänlig fart`, sub: pace }]
  }
  // Återhämtning m.fl. — beskrivningen bor i anteckningen
  return [{ tag: 'PASS', text: t.label || 'Lugnt pass', sub: pace }]
}

/** Ungefärlig passtid i minuter, [låg, hög] — null när det inte går att veta */
function estimateMinutes(baseName: string, t: RunTarget): [number, number] | null {
  // Återhämtning: "30–40 min …" står redan i texten
  const mins = t.label.match(/(\d+)–(\d+)\s*min/)
  if (mins) return [parseInt(mins[1], 10), parseInt(mins[2], 10)]
  if (!t.pace) return null
  const [loStr, hiStr] = t.pace.includes('–') ? t.pace.split('–') : [t.pace, t.pace]
  const lo = paceToSec(loStr)
  const hi = paceToSec(hiStr)
  if (lo === 0) return null
  // Uppvärmning + nedvarvning ingår för kvalitetspassen
  const extras = ['Tempopass', 'Maratonfart', 'Intervaller', 'Fartlek'].includes(baseName) ? 15 : 0
  let dLo = 0, dHi = 0
  if (t.kind === 'distance' && t.km != null) {
    dLo = (t.km * lo) / 60; dHi = (t.km * hi) / 60
  } else if (t.kind === 'interval' && t.reps != null && t.intervalM != null) {
    const work = (t.reps * t.intervalM / 1000) * lo / 60
    const rest = ((t.reps - 1) * RUN_RECIPE.restS) / 60
    dLo = work + rest; dHi = work + rest
  } else {
    return null
  }
  const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5)
  return [round5(dLo + extras), round5(dHi + extras)]
}

export default function RunWorkoutScreen() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    sessionId?: string
    name?: string
    cardioType?: string
    notes?: string
    week?: string
    date?: string
  }>()

  // km/miles — internt är allt km, bara visningen konverteras
  const [unit, setUnit] = useState<UnitSystem>('metric')
  useEffect(() => { getUnitSystem().then(setUnit).catch(() => {}) }, [])

  const week     = Math.max(0, parseInt(params.week ?? '0', 10) || 0)
  const name     = params.name ?? 'Löppass'
  const baseName = name.replace(/\s+\d+$/, '')
  const target   = parseRunTarget(params.notes ?? null, week)
  const parts    = buildParts(baseName, target, unit)
  const est      = estimateMinutes(baseName, target)
  const info     = RUN_SESSION_INFO[baseName]
  const icon     = TYPE_ICON[params.cardioType ?? 'running'] ?? 'fitness-outline'

  const dateLabel = params.date
    ? parseLocalDate(params.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  const headline = target.kind === 'distance' && target.km != null
    ? `${fmtNum(toDisplayDistance(target.km, unit))} ${distanceUnitLabel(unit)}`
    : target.kind === 'interval'
      ? `${target.reps}×${target.intervalM} m`
      : null

  function startRun() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // Kvalitetspass (intervaller/tempo/maraton/fartlek) skickar hela
    // segmentupplägget — GPS-vyn guidar då genom passet och km/min-målet
    // utelämnas så inga krockande målannonseringar sker. Enkla pass
    // (långpass m.fl.) behåller det vanliga målflödet.
    const segs = buildRunSegments(baseName, target)
    const guided = segs.length > 1
    router.replace({
      pathname: '/cardio',
      params: {
        name: params.cardioType ?? 'running',
        ...(params.sessionId ? { sessionId: params.sessionId, sessionDate: params.date } : {}),
        ...(guided
          ? { segments: JSON.stringify(segs) }
          : {
              // Målet förifylls från planen — distansmål för distanspass,
              // tidsmål för återhämtningspass med minutspann
              ...(target.kind === 'distance' && target.km ? { goalKm: target.km.toFixed(2) } : {}),
              ...(target.kind === 'plain' && est ? { goalMin: String(est[1]) } : {}),
            }),
      },
    })
  }

  return (
    <View style={s.screen}>
      {/* ── Topp: tillbaka + planvecka ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <GlassCircleButton
          icon="chevron-back" size={40} iconColor={TEXT_PRIMARY}
          onPress={() => router.back()} fallbackStyle={s.iconBtn}
        />
        <Text style={s.topTitle}>Vecka {week + 1}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        {dateLabel && <Text style={s.date}>{dateLabel}</Text>}
        <View style={s.heroRow}>
          <View style={s.heroIcon}>
            <Ionicons name={icon} size={26} color={CARDIO_BLUE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {name}
            </Text>
            {headline && (
              <Text style={s.heroTarget}>
                {headline}
                {target.label ? <Text style={s.heroTargetSub}>  {target.label}</Text> : null}
              </Text>
            )}
          </View>
        </View>

        {/* Tid + tempo i en blick */}
        <View style={s.metaRow}>
          {est && (
            <View style={s.metaChip}>
              <Ionicons name="time-outline" size={15} color={CARDIO_BLUE} />
              <Text style={s.metaChipText}>{est[0] === est[1] ? `≈ ${est[0]} min` : `${est[0]}–${est[1]} min`}</Text>
            </View>
          )}
          {target.pace && (
            <View style={s.metaChip}>
              <Ionicons name="speedometer-outline" size={15} color={CARDIO_BLUE} />
              <Text style={s.metaChipText}>{paceRangeForUnit(target.pace, unit)}</Text>
            </View>
          )}
          {target.cutback && (
            <View style={s.metaChip}>
              <Ionicons name="leaf-outline" size={15} color={CARDIO_BLUE} />
              <Text style={s.metaChipText}>Lugnare vecka</Text>
            </View>
          )}
        </View>

        {/* Vad passet gör för dig */}
        {info && (
          <View style={s.infoCard}>
            <Ionicons name="bulb-outline" size={17} color={CARDIO_BLUE} />
            <Text style={s.infoText}>{info}</Text>
          </View>
        )}

        {/* ── Upplägg ── */}
        <Text style={s.sectionHead}>Upplägg</Text>
        <View style={s.partsCard}>
          {parts.map((p, i) => (
            <View key={i} style={[s.partRow, i > 0 && s.partBorder]}>
              <View style={[s.partNum, p.tag === 'PASS' && s.partNumMain]}>
                <Text style={[s.partNumText, p.tag === 'PASS' && s.partNumTextMain]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.partText}>{p.text}</Text>
                {p.sub && <Text style={s.partSub}>{p.sub}</Text>}
              </View>
              <Text style={[s.partTag, p.tag === 'PASS' && s.partTagMain]}>{p.tag}</Text>
            </View>
          ))}
        </View>

        <Text style={s.progressNote}>
          Passet växer vecka för vecka — det här är målet för vecka {week + 1} i din plan.
        </Text>
      </ScrollView>

      {/* ── Starta — målet följer med från planen ── */}
      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={s.startBtn} onPress={startRun} activeOpacity={0.88}>
          <Ionicons name="play" size={17} color="#000" />
          <Text style={s.startBtnText}>Starta passet</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingTop: 10 },

  date: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', textTransform: 'capitalize', marginBottom: 10 },

  heroRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: CARDIO_BLUE + '1E',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle:     { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  heroTarget:    { color: CARDIO_BLUE, fontSize: 17, fontFamily: NUM_FONT, marginTop: 3 },
  heroTargetSub: { color: TEXT_SECONDARY, fontSize: 13, fontFamily: NUM_FONT_SEMI },

  metaRow:  { flexDirection: 'row', gap: 8, marginTop: 14 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  metaChipText: { color: TEXT_PRIMARY, fontSize: 13, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: CARDIO_BLUE + '12', borderRadius: 14,
    borderWidth: 1, borderColor: CARDIO_BLUE + '30',
    padding: 14, marginTop: 14,
  },
  infoText: { flex: 1, color: TEXT_PRIMARY, fontSize: 13, lineHeight: 19 },

  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 24, marginBottom: 12,
  },
  partsCard: {
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16,
  },
  partRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  partBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  partNum: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  partNumMain:     { backgroundColor: CARDIO_BLUE },
  partNumText:     { color: TEXT_SECONDARY, fontSize: 14, fontFamily: NUM_FONT },
  partNumTextMain: { color: '#000' },
  partText: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  partSub:  { color: TEXT_SECONDARY, fontSize: 12, lineHeight: 17, marginTop: 2 },
  partTag: {
    color: TEXT_SECONDARY, fontSize: 9, fontWeight: '800', letterSpacing: 1,
  },
  partTagMain: { color: CARDIO_BLUE },

  progressNote: {
    color: TEXT_SECONDARY, fontSize: 12, lineHeight: 17,
    textAlign: 'center', marginTop: 16, paddingHorizontal: 12,
  },

  ctaWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12, gap: 12, alignItems: 'center',
    backgroundColor: BG + 'F2',
  },
  startBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: CARDIO_BLUE, borderRadius: 18, paddingVertical: 16,
  },
  startBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
})
