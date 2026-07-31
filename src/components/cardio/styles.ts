import { Dimensions, StyleSheet } from 'react-native'
import { BG, BORDER, CARD, CARDIO_BLUE, CARD_BORDER, DIVIDER, NUM_FONT, NUM_FONT_SEMI, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/theme'

export const DIAL = Math.min(Dimensions.get('window').width - 70, 320)
export const CARDIO_ACCENT = CARDIO_BLUE

export const styles = StyleSheet.create({

  // ── Idle: inställningsrutnät + bred Start (Runkeeper-inspirerad) ──
  idleWrap: { width: '100%', gap: 12, paddingBottom: 6 },
  idleCard: {
    backgroundColor: 'rgba(18,18,20,0.92)',
    borderRadius: 20,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  idleGrid: { flexDirection: 'row', alignItems: 'stretch' },
  idleGridDivH: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginVertical: -4 },
  idleGridDivV: { width: StyleSheet.hairlineWidth, backgroundColor: DIVIDER },
  idleCell: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 14, paddingHorizontal: 14,
  },
  idleCellText: { flex: 1 },
  idleCellLabel: { color: '#9BA0A6', fontSize: 12, fontWeight: '600' },
  idleCellValue: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700', marginTop: 2 },
  startWide: {
    backgroundColor: CARDIO_ACCENT, borderRadius: 999,
    paddingVertical: 11, alignItems: 'center',
    alignSelf: 'stretch', marginHorizontal: 2,
  },
  startWideText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },

  // ── Splits-sidan ──
  splitsPageTitle: { color: TEXT_PRIMARY, fontSize: 30, fontWeight: '800', letterSpacing: -0.4, marginTop: 4, marginBottom: 14 },
  splitsList: { gap: 10, paddingBottom: 160 },
  splitBlock: { backgroundColor: CARD, borderRadius: 18, padding: 18, gap: 2 },
  splitBlockActive: { backgroundColor: CARDIO_ACCENT },
  splitBlockLabel: { color: '#9BA0A6', fontSize: 14, fontWeight: '600' },
  splitBlockLabelActive: { color: 'rgba(0,0,0,0.6)', fontSize: 14, fontWeight: '700' },
  splitBlockPace: { color: TEXT_PRIMARY, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  splitBlockPaceActive: { color: '#000', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  splitBlockUnit: { fontSize: 17, fontWeight: '700', color: '#9BA0A6' },
  splitBlockUnitActive: { fontSize: 17, fontWeight: '700', color: 'rgba(0,0,0,0.55)' },
  splitBlockDist: { color: '#9BA0A6', fontSize: 14, fontWeight: '600', marginTop: 2 },
  splitBlockDistActive: { color: 'rgba(0,0,0,0.6)', fontSize: 14, fontWeight: '700', marginTop: 2 },

  // Kantflik på kartan → detaljvyn
  edgeTab: {
    position: 'absolute', right: 0, top: '66%',
    width: 46, height: 68,
    backgroundColor: CARDIO_ACCENT,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 8,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },

  // Punktindikator för de tre sidorna
  pageDots: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingTop: 8, marginBottom: -2 },
  pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(128,128,128,0.4)' },
  pageDotOn: { backgroundColor: TEXT_PRIMARY },

  // Röstguidning — fullskärm
  voiceRoot: { flex: 1, backgroundColor: BG },
  voiceHeader: { paddingHorizontal: 20 },
  voiceIconWrap: { alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 22 },
  voiceIconCircle: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: CARDIO_ACCENT + '1C',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceTitle: { color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  voiceList: { paddingHorizontal: 16, gap: 12 },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    backgroundColor: CARD, borderRadius: 18,
    paddingVertical: 15, paddingHorizontal: 16,
  },
  voiceRowPlain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voiceRowLabel: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  voiceHint: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  voiceRowActive: { borderWidth: 1.5, borderColor: CARDIO_ACCENT + '66' },
  voiceAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARDIO_ACCENT + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceBadge: {
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(128,128,128,0.16)',
  },
  voiceBadgeGood: { backgroundColor: CARDIO_ACCENT + '1E' },
  voiceBadgeText: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700' },
  voiceBadgeTextGood: { color: CARDIO_ACCENT },
  voiceDownload: {
    backgroundColor: CARDIO_ACCENT + '10',
    borderRadius: 16, padding: 14, marginTop: 6, marginBottom: 10, gap: 10,
  },
  voiceDownloadHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  voiceStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voiceStepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: CARDIO_ACCENT + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceStepNumText: { color: CARDIO_ACCENT, fontSize: 12, fontWeight: '800' },
  voiceStepText: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, lineHeight: 19 },
  voiceRowValue: { color: '#9BA0A6', fontSize: 13, marginTop: 3 },
  voiceFreqBlock: {
    backgroundColor: CARD, borderRadius: 20,
    padding: 18, gap: 18,
  },
  voiceStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  voiceStepBtn: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: DIVIDER,
    alignItems: 'center', justifyContent: 'center',
  },
  voiceStepValue: { color: CARDIO_ACCENT, fontSize: 46, fontFamily: NUM_FONT, lineHeight: 52 },
  voiceStepUnit: { color: '#9BA0A6', fontSize: 14, fontWeight: '600', marginTop: -4 },

  // Röstguidningsväljare
  voiceOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: BG, borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  voiceOptionActive: { borderColor: CARDIO_ACCENT, backgroundColor: CARDIO_ACCENT + '10' },
  voiceOptionLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  voiceOptionSub: { color: '#9BA0A6', fontSize: 12, marginTop: 2 },

  // Målmodal
  goalModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  goalModalSheet: {
    backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, gap: 14,
  },
  goalModalTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  goalIconWrap: { alignItems: 'center', gap: 10, marginBottom: 4 },
  goalIconCircle: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: CARDIO_ACCENT + '1C',
    alignItems: 'center', justifyContent: 'center',
  },
  goalModalSave: {
    backgroundColor: CARDIO_ACCENT, borderRadius: 999, paddingVertical: 14, alignItems: 'center',
  },
  goalModalSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  goalModalClear: { alignItems: 'center', paddingVertical: 8 },
  goalModalClearText: { color: '#9BA0A6', fontSize: 13 },

  // ── Infosheets för guidade pass ──
  infoSheetSub: {
    color: '#9BA0A6', fontSize: 13, textAlign: 'center',
    lineHeight: 18, marginTop: -2, paddingHorizontal: 16,
  },
  infoSheetDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 21 },
  infoSheetTipsHead: {
    color: '#9BA0A6', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginTop: 4,
  },
  infoTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoTipDot: {
    width: 20, height: 20, borderRadius: 10, marginTop: 1,
    backgroundColor: CARDIO_ACCENT + '1E',
    alignItems: 'center', justifyContent: 'center',
  },
  infoTipText: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },

  infoPlanRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
  },
  infoPlanRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
  },
  infoPlanIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoPlanLabel: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500' },
  infoPlanTarget: {
    color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  infoPlanPace: {
    color: '#9BA0A6', fontSize: 11, fontFamily: NUM_FONT_SEMI,
    fontVariant: ['tabular-nums'], marginTop: 1,
  },

  // Per-intervall-tempon i summeringen
  summaryIvChips: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 6, marginTop: 2,
  },
  summaryIvChip: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 9,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  summaryIvChipFast: { backgroundColor: CARDIO_ACCENT + '1E' },
  summaryIvChipText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: NUM_FONT_SEMI,
    fontVariant: ['tabular-nums'],
  },
  root: { flex: 1, backgroundColor: '#e8e8e8' },

  // ── Stats overlay ──
  statsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  statsCard: {
    backgroundColor: 'rgba(20,20,22,0.94)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  statsCardLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowOpacity: 0.12,
  },
  hudMiniLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hudMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(20,20,22,0.94)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  hudMiniTime: {
    color: '#fff',
    fontSize: 17,
    fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  hudMiniShow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: CARDIO_ACCENT,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  hudMiniShowText: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timerText: {
    color: '#fff',
    fontSize: 42,
    fontFamily: NUM_FONT,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  gpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  gpsDot: { width: 7, height: 7, borderRadius: 3.5 },
  gpsText: { color: '#999', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  pausedBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pausedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Målprogress
  goalTrackWrap: { alignSelf: 'stretch', marginBottom: 12, gap: 10 },
  goalOne: { gap: 5 },
  goalTextRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalText:      { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
  goalPct:       { color: CARDIO_BLUE, fontSize: 12, fontWeight: '800' },
  goalTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden',
    backgroundColor: DIVIDER,
  },
  goalFill: { height: '100%', backgroundColor: CARDIO_BLUE, borderRadius: 2 },

  // ── Intervallguidning: HUD-banner + segmentlista ──
  ivBanner: { alignSelf: 'stretch', gap: 5, marginBottom: 10 },
  ivBannerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  ivBannerLabel: {
    flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700',
  },
  ivBannerRemain: {
    color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  ivBannerTrack: {
    height: 3, borderRadius: 2, overflow: 'hidden',
    backgroundColor: DIVIDER,
  },
  ivBannerFill: { height: '100%', borderRadius: 2 },

  ivListRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, paddingHorizontal: 4, borderRadius: 8,
  },
  ivListRowCurrent: { backgroundColor: 'rgba(255,255,255,0.06)' },
  ivListDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  ivListLabel: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  ivListTarget: {
    color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#3A3A3C',
  },

  // ── Km split toast ──
  splitToast: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    backgroundColor: 'rgba(20,20,20,0.88)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 50,
  },
  splitToastText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },

  // ── Right side buttons ──
  rightBtns: {
    position: 'absolute',
    right: 16,
    bottom: 320,
    gap: 10,
    zIndex: 10,
  },
  // ── Nedräkning ──
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  countdownNum: {
    fontSize: 170,
    fontFamily: NUM_FONT,
    fontVariant: ['tabular-nums'],
  },
  countdownHint: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
  },

  // ── Kompass ──
  compassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  compassRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  compassClose: {
    alignSelf: 'flex-end',
    padding: 18,
  },
  compassStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  compassDial: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DIAL / 2,
  },
  tickWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  tick: {
    width: 1.5,
    height: 11,
    backgroundColor: '#4A4A4C',
  },
  tickMajor: {
    height: 17,
    width: 2,
    backgroundColor: '#fff',
  },
  dialNum: {
    color: '#8A8A8E',
    fontSize: 13,
    fontFamily: NUM_FONT_SEMI,
    marginTop: 24,
    fontVariant: ['tabular-nums'],
  },
  dialCardinal: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 46,
  },
  compassCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassDeg: {
    color: TEXT_PRIMARY,
    fontSize: 58,
    fontFamily: NUM_FONT,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  compassCard: {
    color: '#8A8A8E',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },

  // ── Kartval — grid med förhandsbilder ──
  mapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 6,
  },
  mapCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#242426',
    overflow: 'hidden',
  },
  mapCardActive: {
    borderColor: CARDIO_ACCENT,
  },
  mapPreviewIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  mapPreview: {
    overflow: 'hidden',
    width: '100%',
    height: 96,
    backgroundColor: BORDER,
  },
  mapCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  mapCardLabel: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Top right back button ──
  topRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingRight: 16,
    paddingTop: 8,
    zIndex: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  // ── Bottom bar ──
  bottomBarIdle: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    backgroundColor: 'transparent',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(22,22,24,0.97)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    zIndex: 30, // ovanpå fullskärms-statsen så kontrollerna alltid nås
  },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
  },

  // ── Aktivitetsväljare (slide-up) ──
  sheetDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 39,
  },
  // Glasläge: bakgrundsfärgen släcks och GlassView fyller ytan bakom innehållet
  glassSurface: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetGrip: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.45)',
  },
  sheetTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  sheetItemActive: {
    backgroundColor: DIVIDER,
  },
  sheetItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetItemText: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    fontWeight: '600',
  },
  sheetItemTextActive: {
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },

  // ── Fullskärms-stats ──
  expandedStats: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121214',
    zIndex: 20,
  },
  expandedInner: {
    flex: 1,
    paddingHorizontal: 20,
  },
  expandedHandleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  expandedHint: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
  },
  expandedGoal: {
    gap: 10,
    marginTop: 8,
  },
  // Staplade storvärden i fullskärm (inga boxar)
  exStack: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingBottom: 150, // håll sista raden ovanför bottenbaren
  },
  exBlock: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  exBlockHalf: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  exValueBig: {
    color: TEXT_PRIMARY,
    fontSize: 50,
    fontFamily: NUM_FONT,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  exValueMed: {
    color: TEXT_PRIMARY,
    fontSize: 34,
    fontFamily: NUM_FONT,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  exLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  exDivider: {
    height: 1,
    backgroundColor: '#232325',
    alignSelf: 'stretch',
    marginHorizontal: 24,
  },
  exDividerV: {
    width: 1,
    height: 44,
    backgroundColor: '#232325',
  },

  // ── Startmeny (idle) ──
  idleCol: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  idleColLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  typeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: CARDIO_ACCENT + '2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: CARDIO_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#161618',
  },
  startCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: CARDIO_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CARDIO_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  startLabel: {
    color: CARDIO_ACCENT,
    fontSize: 14,
    fontWeight: '800',
  },

  // Breda kontroller under passet
  pausePill: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    backgroundColor: CARDIO_ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: CARDIO_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  pausePillText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  finishPill: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3A3A3C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  finishPillText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Summary modal ──
  summaryOverlay: {
    flex: 1,
    backgroundColor: BG,
  },
  summaryContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  summaryCheck: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: CARDIO_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: CARDIO_ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summarySubtitle: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
  },
  nameField: {
    alignSelf: 'stretch',
    gap: 6,
  },
  nameFieldLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  nameFieldInput: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  summaryStack: {
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  splitsWrap: {
    alignSelf: 'stretch',
    marginTop: 2,
  },
  splitsTitle: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  splitKm: {
    color: '#999',
    fontSize: 13,
    fontFamily: NUM_FONT_SEMI,
    width: 52,
    fontVariant: ['tabular-nums'],
  },
  splitBarTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  splitBar: {
    height: '100%',
    borderRadius: 7,
    backgroundColor: CARDIO_ACCENT,
  },
  splitPace: {
    color: '#fff',
    fontSize: 13,
    fontFamily: NUM_FONT,
    width: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  summaryGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  summaryGoalText: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  effortRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  effortBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effortBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  effortRowText: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  summaryPointsText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARDIO_ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    justifyContent: 'center',
    shadowColor: CARDIO_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  summaryBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  summaryDiscard: {
    marginTop: 8,
    paddingVertical: 12,
  },
  summaryDiscardText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '500',
  },
})
