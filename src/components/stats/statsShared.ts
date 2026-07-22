// Delade konstanter, hjälpare och stilar för hela Framsteg-sektionen —
// skalet (stats.tsx) och flikkomponenterna importerar härifrån så att
// designen har en enda källa.
import { StyleSheet, Dimensions } from 'react-native'
import { useColorScheme } from 'react-native'
import { BG, CARD, BORDER, ORANGE, ACCENT, GREEN, TEXT_PRIMARY, TEXT_SECONDARY, NUM_FONT, NUM_FONT_SEMI } from '@/lib/theme'
import { toLocalDateString, startOfWeek } from '@/lib/date'
import { TAB_CONTENT_PAD } from '@/lib/glass'

export const GRID_PADDING = 20
export const STATS_SCREEN_W = Dimensions.get('window').width
export const TAB_BAR_W = STATS_SCREEN_W - GRID_PADDING * 2
export const SEG_W     = TAB_BAR_W / 3      // en flik-kolumns bredd
// Klara Apple Fitness-färger för statistikvärden
export const BLUE   = '#3FBBFF'
export const RED    = '#FF3D73'
export const YELLOW = '#FFE60A'
export const PURPLE = '#D65CFF'
export const TEAL   = '#40F5E9'
export const LIME   = '#BDFF3B'

// Neonfärgerna skriker på vit botten — ljust läge får dämpade, mörkare
// varianter. Som strängar via hook: funkar i SVG, konkatenering och
// reanimated, till skillnad från dynamiska färgobjekt.
const NEON_DARK  = { BLUE, RED, YELLOW, PURPLE, TEAL, LIME, GREEN }
const NEON_LIGHT = {
  BLUE: '#2E86C9', RED: '#CE4568', YELLOW: '#D68F00',
  PURPLE: '#9A4CC4', TEAL: '#1FA89C', LIME: '#7CA92F',
  GREEN: '#2E9E57',
}
export function useStatsColors() {
  return useColorScheme() === 'light' ? NEON_LIGHT : NEON_DARK
}

export function getWeekBounds(offset: number): { start: string; end: string; label: string } {
  const mon = startOfWeek()
  mon.setDate(mon.getDate() + offset * 7)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
  return {
    start: toLocalDateString(mon),
    end:   toLocalDateString(sun),
    label: offset === 0 ? 'Denna vecka' : `${fmt(mon)} till ${fmt(sun)}`,
  }
}

export /** Nästa milstolpe utifrån dagarna bakom en (dag 19 = 18 avklarade).
 *  Databasens logg-räknare funkar inte här: den som börjat mitt i utmaningen
 *  saknar loggar för dagarna innan appen. "Halvvägs" på riktiga mitten (38). */
function nextMilestone(completed: number): { day: number; label: string; daysLeft: number } | null {
  const stones = [
    { day: 7,  label: 'Första veckan klar!' },
    { day: 10, label: '10 dagar klara!' },
    { day: 19, label: 'En fjärdedel klar!' },
    { day: 25, label: 'En tredjedel klar!' },
    { day: 38, label: 'Halvvägs!' },
    { day: 50, label: 'Två tredjedelar klara!' },
    { day: 60, label: '60 dagar klara!' },
    { day: 68, label: 'Sista veckan!' },
    { day: 75, label: 'MÅLET: 75 dagar!' },
  ]
  const next = stones.find(s => s.day > completed)
  if (!next) return null
  return { ...next, daysLeft: next.day - completed }
}

export function monthLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
}

/** "idag", "igår", veckodag inom en vecka, annars datumet */
export function sessDateLabel(dateStr: string): string {
  const today = toLocalDateString()
  if (dateStr === today) return 'idag'
  const diff = Math.round(
    (new Date(today + 'T12:00:00').getTime() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000,
  )
  if (diff === 1) return 'igår'
  if (diff > 1 && diff < 7) return new Date(dateStr + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long' })
  return dateStr
}

export interface GymSession {
  id:            string
  completedDate: string
  sessionName:   string
  exercises:     string[]
}

// Svep vänster på en sessionsrad — samma tvåstegssystem som schemasidan:
// steg 1 snäpper fram en rund soptunna, steg 2 expanderar den till en
// "Ta bort"-pill, och full-svep utlöser samma bekräftelse som knappen.
// Lysande neonröd för radera-knappen (statistikens RED är rosaaktig)
export const SWIPE_RED = '#FF2438'
export const SWIPE_SNAP_OPEN = 82
export const SWIPE_FULL = Math.round(STATS_SCREEN_W * 0.54)
export const SWIPE_BTN_H = 52
export const SWIPE_BTN_MAX_W = 170
export const SWIPE_SP = { damping: 22, stiffness: 180, mass: 1 } as const

export const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: '#4A4A50', fontSize: 14 },
  retryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  scroll:   { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 40 + TAB_CONTENT_PAD, gap: 16 },
  header:   { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 12 },
  title:    { color: TEXT_PRIMARY, fontSize: 28, fontWeight: '700' },
  subtitle: { color: TEXT_SECONDARY, fontSize: 14 },

  // Flikrad: text + glidande underline
  tabWrap: { marginHorizontal: GRID_PADDING, marginBottom: 6 },
  compactRow: { flexDirection: 'row' },
  compactTab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  compactLabel: {
    color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600',
  },
  compactLabelActive: { color: ACCENT, fontWeight: '700' },
  compactTrack: {
    height: 3, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(128,128,128,0.18)',
  },
  compactIndicator: {
    width: SEG_W, height: '100%',
    borderRadius: 2,
  },

  statsGrid: { gap: 10 },

  card:      { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 14 },
  // Cardio-fliken: rubriken utanför kortet (Apple Fitness) och kortet utan ram
  cardPlain: { borderWidth: 0 },
  sectionHead: {
    color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.4,
    marginTop: 6, marginBottom: -6,
  },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: -6 },
  sectionHeadInline: { marginTop: 0, marginBottom: 0 },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600' },
  cardSub:   { color: TEXT_SECONDARY, fontSize: 12, marginTop: -8 },

  // Träningsdetaljer (Apple-stil)
  dtlRow:  { flexDirection: 'row', paddingVertical: 13 },
  dtlCell: { flex: 1, gap: 3 },
  dtlLbl:  { color: TEXT_SECONDARY, fontSize: 14 },
  dtlVal:  { fontSize: 26, fontFamily: 'Nunito_700Bold' },
  dtlUnit: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
  dtlSep:  { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)' },
  dtlPrev: { color: TEXT_SECONDARY, fontSize: 11, fontFamily: NUM_FONT_SEMI, marginTop: 1 },

  // Set per muskelgrupp
  grpRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  grpRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  grpLbl: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', width: 62 },
  grpTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  grpFill: { height: '100%', borderRadius: 5, backgroundColor: ORANGE },
  grpVal: { color: TEXT_PRIMARY, fontSize: 15, fontFamily: 'Nunito_700Bold', width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] as any },

  // Periodfilter (cardio-fliken)
  // Tempoutveckling
  paceChartRow: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  paceAxis:     { justifyContent: 'space-between', paddingVertical: 6 },
  paceAxisLbl:  { color: TEXT_SECONDARY, fontSize: 10, fontFamily: NUM_FONT_SEMI, fontVariant: ['tabular-nums'] },
  paceWeekRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 36 },
  paceWeekLbl:  { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600' },

  // Intervalltrend
  ivTrendHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ivTrendDelta:   { color: TEXT_SECONDARY, fontSize: 12, fontFamily: NUM_FONT_SEMI },
  ivTrendHeadline:{ color: TEXT_PRIMARY, fontSize: 24, fontFamily: NUM_FONT, marginTop: 4, marginBottom: 6, fontVariant: ['tabular-nums'] as const },

  // Sessioner-listan (Apple Fitness-stil)
  sessMonth: { color: TEXT_PRIMARY, fontSize: 20, fontFamily: 'Nunito_800ExtraBold', marginTop: 8 },
  sessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  sessIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  swipeBtnArea: {
    position: 'absolute', right: 12, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'flex-end',
  },
  swipeBtn: {
    height: SWIPE_BTN_H, borderRadius: SWIPE_BTN_H / 2,
    backgroundColor: SWIPE_RED, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: SWIPE_RED, shadowOpacity: 0.55, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  swipeBtnLabel: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 4 },
  sessName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  sessValue: { color: LIME, fontSize: 23, fontFamily: 'Nunito_700Bold', marginTop: 1 },
  sessDate: { color: TEXT_SECONDARY, fontSize: 13, alignSelf: 'flex-end', marginBottom: 4 },

  // Cardiorekord
  recScroll: { paddingHorizontal: GRID_PADDING, gap: 10, flexDirection: 'row' },
  recCard: {
    width: 130, backgroundColor: CARD, borderRadius: 18,
    padding: 14, gap: 8,
  },
  recCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recCardVal: { fontSize: 19, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] as any },
  recCardLbl: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', lineHeight: 14 },
  recIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Ring chart
  ringWrap: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 4 },
  ringInfo: { flex: 1, gap: 12 },
  ringDay:  { color: TEXT_PRIMARY, fontSize: 30, fontFamily: NUM_FONT },
  ringOfN:  { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  ringRows: { gap: 8 },
  ringRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ringRowLabel: { color: TEXT_SECONDARY, fontSize: 12 },
  ringRowVal:   { fontSize: 13, fontWeight: '700' },

  // Milestone
  milestone: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: ORANGE + '14',
    borderRadius: 18, padding: 16,
  },
  msIcon:    { width: 40, height: 40, borderRadius: 12, backgroundColor: ORANGE + '20', alignItems: 'center', justifyContent: 'center' },
  msEmoji:   { fontSize: 20 },
  msBody:    { flex: 1 },
  msEyebrow: { color: ORANGE, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  msTitle:   { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '800', marginTop: 2 },
  msSub:     { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },

  // Bar chart
  distLblRow: { flexDirection: 'row', marginTop: -6 },
  distLbl: { flex: 1, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 11, fontFamily: NUM_FONT_SEMI },

  empty:     { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14 },

  // Gym sessions
  gymList: { gap: 0 },
  gymRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  gymCheck: {
    width: 30, height: 30,
    backgroundColor: GREEN + '18',
    borderWidth: 1, borderColor: GREEN + '35',
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  gymInfo: { flex: 1 },
  gymName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700' },
  gymExs:  { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },
  gymDay:  { color: TEXT_SECONDARY, fontSize: 12 },

  // Body map
  muscleHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  muscleAuto:          { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },
  bodyToggle:          { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 2 },
  bodyToggleBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  bodyToggleBtnActive: { backgroundColor: ORANGE },
  bodyToggleText:      { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  bodyToggleTextActive:{ color: '#000' },
  bodyWrap:            { alignItems: 'center', paddingVertical: 8 },
  muscleEmpty:         { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', paddingBottom: 8 },
  muscleLinkRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  muscleLinkIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  muscleLinkTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600' },
  muscleLinkSub:   { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  modalTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  modalTopTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },

  // Tomlägen för nya användare
  tabEmpty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 12 },
  tabEmptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: ORANGE + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  tabEmptyTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800' },
  tabEmptyText: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  tabEmptyBtn: {
    backgroundColor: ORANGE, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11, marginTop: 4,
  },
  tabEmptyBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  sessionsWeekLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', marginTop: 8 },
  cdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 13 },
  cdRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  cdLbl: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },
  cdVal: { fontSize: 17, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] as any },

  // Week nav
  // Dagval: knapp som fäller ut dagremsan Mån–Sön (veckovyn är standard)
  dayPickToggle: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6,
    backgroundColor: CARD, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8,
  },
  dayPickToggleActive: { backgroundColor: ORANGE },
  dayPickToggleText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  dayPickToggleTextActive: { color: '#000', textTransform: 'capitalize' },
  dayStrip: { flexDirection: 'row', gap: 6 },
  dayBox: {
    flex: 1, alignItems: 'center', gap: 2,
    backgroundColor: CARD, borderRadius: 12, paddingVertical: 8,
  },
  dayBoxActive: { backgroundColor: ORANGE },
  dayBoxLetter: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600' },
  dayBoxNum: { color: TEXT_PRIMARY, fontSize: 14, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] as any },
  dayBoxTextActive: { color: '#000' },

  // Samma pilnavigering som i Distans-detaljvyn
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNavBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center',
  },
  weekNavLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },

  legend:     { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: TEXT_SECONDARY, fontSize: 12 },
})

