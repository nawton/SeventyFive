import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeScreen } from '@/components/SafeScreen'
import { Ionicons } from '@/components/Icon'
import MapView, { Polyline } from 'react-native-maps'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { styles, DIAL, CARDIO_ACCENT } from '@/components/cardio/styles'
import { EXERCISES, ACTIVITY_INFO, MAP_STYLES, APPLE_MAP_TYPES } from '@/components/cardio/constants'
import { useCardioSession } from '@/components/cardio/useCardioSession'
import { toDisplayDistance, paceForUnit } from '@/lib/units'
import { dateLocale } from '@/lib/i18n'
import { setCoachVoiceId, previewVoice, voiceDisplayName, voiceQualityLabel } from '@/lib/voice'
import { EffortRating, effortColor, effortLabel } from '@/components/EffortRating'
import { GlassCircleButton, GlassPill } from '@/components/GlassButton'
import { GlassView } from 'expo-glass-effect'
import { LIQUID_GLASS } from '@/lib/glass'
import { AppTextInput } from '@/components/AppTextInput'
import { cardinalLabel, formatTime, formatPace } from '@/lib/cardioUtils'

export default function CardioScreen() {
  const {
    T, t, routeColor, insets,
    name, sessionId, sessionDate, goalKm, goalMin, segments,
    goalKmNum, setGoalKmNum, goalMinNum, setGoalMinNum,
    guidedSegments, guided, totalWork,
    goalModalOpen, setGoalModalOpen, infoSheet, setInfoSheet,
    goalKmDraft, setGoalKmDraft, goalMinDraft, setGoalMinDraft,
    unit, setUnit, unitLabel, lightCard,
    voiceRef, voiceOn, setVoiceOn, voiceSet, setVoiceSet, voiceSetRef,
    voiceModalOpen, setVoiceModalOpen, voicePage, setVoicePage,
    coachVoiceRef, coachVoices, setCoachVoices, coachVoiceId, setCoachVoiceIdState,
    lastVoiceMinute, nextVoiceKm, updateVoiceSet, speak, speakGuide,
    goalKmSaid, goalMinSaid,
    countdown, setCountdown, countdownTimer, countRef, pulseV,
    countdownFeedback, beginCountdown, cancelCountdown, pulseStyle,
    mapRef, followRef, routeLine, setRouteLine, initRegion, setInitRegion,
    locationSub, timerRef, initCenterTimer,
    headingSub, headingCont, lastHeadingInt, compassOpenRef,
    compassOpen, setCompassOpen, headingDeg, setHeadingDeg, headingV,
    status, setStatus, exercise, setExercise, pickerOpen, setPickerOpen,
    page, setPage, statsExpanded, splitsOpen, pageV,
    hudHidden, setHudHidden, styleMenuOpen, setStyleMenuOpen, activeStyle, setActiveStyle,
    summary, setSummary, saving, setSaving, workoutName, setWorkoutName,
    distanceKm, setDistanceKm, elapsed, setElapsed,
    gpsCat, setGpsCat, gpsCatRef, lastFixTs, updateGps,
    currentPaceSec, setCurrentPaceSec, splitToast, setSplitToast,
    effort, setEffort, effortOpen, setEffortOpen,
    lastCoord, latestCoord, routeCoords, mapReady, elapsedRef,
    elapsedBaseRef, runStartTs, distanceRef, splitKm, lastSplitElapsed,
    splitTimes, paceTs, smoothedPaceRef, splitToastTimer,
    intervalRef, intervalResults, engineUi, setEngineUi,
    autoPaused, setAutoPaused, autoPausedRef, lastMoveTs,
    selectedExercise, weightKg, setWeightKg, calories,
    goPage, openStats, closeStats, openSplits, closeSplits,
    collapseGesture, splitsCollapseGesture, expandedStyle, splitsStyle,
    sheetY, openPicker, closePicker, sheetDrag, sheetStyle, styleY,
    openGoalModal, saveGoal, setVoiceEnabled, statusPhrase,
    runIntervalEngine, inDurationSegment, devForceSegment,
    openStyleSheet, closeStyleSheet, styleDrag, styleSheetStyle,
    needleStyle, dialStyle,
    openCompass, closeCompass, sendInit, changeStyle, centerOnUser, sendToMap,
    startTracking, pauseTracking, cleanup, handleFinish, saveSummaryAndExit,
  } = useCardioSession()

  return (
    <View style={styles.root}>

      {/* ── Fullscreen Apple Maps — väntar på startregion så vi öppnar inzoomade ── */}
      {initRegion === null && <View style={[StyleSheet.absoluteFill, { backgroundColor: lightCard ? '#F5F5F7' : '#101012' }]} />}
      {initRegion !== null && (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...initRegion, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        mapType={APPLE_MAP_TYPES[activeStyle] ?? 'standard'}
        userInterfaceStyle={activeStyle === 'dark' ? 'dark' : 'light'}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled
        rotateEnabled
        onPanDrag={() => { followRef.current = false }}
        onMapReady={() => {
          mapReady.current = true
          const c = latestCoord.current
          if (c) mapRef.current?.animateCamera({ center: c, zoom: 16 }, { duration: 0 })
        }}
      >
        {routeLine.length > 1 && (
          <Polyline
            coordinates={routeLine}
            strokeColor={routeColor}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>
      )}

      {/* ── Nedräkning 3-2-1 innan start ── */}
      {countdown !== null && (
        <Pressable style={styles.countdownOverlay} onPress={() => cancelCountdown()}>
          <Animated.Text style={[styles.countdownNum, { color: T.CARD }, pulseStyle]}>{countdown}</Animated.Text>
          <Text style={styles.countdownHint}>{t('Tryck för att avbryta')}</Text>
        </Pressable>
      )}

      {/* ── Fullskärmskompass — kolsvart med vita symboler ── */}
      <Modal visible={compassOpen} animationType="fade" onRequestClose={closeCompass}>
        <View style={styles.compassRoot}>
          <SafeScreen style={{ flex: 1 }} edges={['top', 'bottom']}>
            <TouchableOpacity style={styles.compassClose} onPress={closeCompass} activeOpacity={0.7}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.compassStage}>
              {/* Fast markör som visar riktningen mot den roterande skivan */}
              <Ionicons name="caret-down" size={24} color="#FF3B4A" style={{ marginBottom: 8 }} />

              <View style={{ width: DIAL, height: DIAL }}>
                <Animated.View style={[styles.compassDial, dialStyle]}>
                  {/* Gradstreck var 6:e grad, längre var 30:e */}
                  {Array.from({ length: 60 }).map((_, i) => (
                    <View key={i} style={[styles.tickWrap, { transform: [{ rotate: `${i * 6}deg` }] }]}>
                      <View style={[styles.tick, i % 5 === 0 && styles.tickMajor]} />
                    </View>
                  ))}
                  {/* Gradtal var 30:e grad */}
                  {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(d => (
                    <View key={`n${d}`} style={[styles.tickWrap, { transform: [{ rotate: `${d}deg` }] }]}>
                      <Text style={styles.dialNum}>{d}</Text>
                    </View>
                  ))}
                  {/* Väderstreck */}
                  {([['N', 0], ['Ö', 90], ['S', 180], ['V', 270]] as const).map(([letter, d]) => (
                    <View key={letter} style={[styles.tickWrap, { transform: [{ rotate: `${d}deg` }] }]}>
                      <Text style={[styles.dialCardinal, letter === 'N' && { color: '#FF3B4A' }]}>{t(letter)}</Text>
                    </View>
                  ))}
                </Animated.View>

                {/* Fast mitt — grader + väderstreck */}
                <View style={styles.compassCenter} pointerEvents="none">
                  <Text style={styles.compassDeg}>{headingDeg}°</Text>
                  <Text style={styles.compassCard}>{t(cardinalLabel(headingDeg))}</Text>
                </View>
              </View>
            </View>
          </SafeScreen>
        </View>
      </Modal>

      {/* ── Stats overlay — syns även innan start ── */}
      {hudHidden ? (
        <SafeScreen style={styles.statsOverlay} edges={['top']} pointerEvents="box-none">
          <GlassPill
            onPress={() => setHudHidden(false)}
            style={styles.hudMiniLayout}
            fallbackStyle={lightCard ? [styles.hudMini, styles.statsCardLight] : styles.hudMini}
          >
            <Text style={[styles.hudMiniTime, lightCard && { color: '#000' }]}>{formatTime(elapsed)}</Text>
            <View style={styles.hudMiniShow}>
              <Text style={styles.hudMiniShowText}>{t('Visa statistik')}</Text>
              <Ionicons name="chevron-down" size={13} color="#fff" />
            </View>
          </GlassPill>
        </SafeScreen>
      ) : (
        <SafeScreen style={styles.statsOverlay} edges={['top']} pointerEvents="box-none">
          {/* Tryck på kortet krymper det till miniläget — tryck på minit växer igen */}
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => setHudHidden(true)}
            style={[styles.statsCard, lightCard && styles.statsCardLight]}
          >
            <View style={styles.timerRow}>
              <Text style={[styles.timerText, lightCard && { color: '#000' }]}>{formatTime(elapsed)}</Text>
              {status === 'paused' && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>{t('PAUSAD')}</Text>
                </View>
              )}
              {status === 'running' && autoPaused && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>{t('AUTOPAUS')}</Text>
                </View>
              )}
              {/* GPS-signal — så man förstår varför distansen står stilla */}
              {status === 'running' && (
                <View style={styles.gpsChip}>
                  <View style={[styles.gpsDot, {
                    backgroundColor: gpsCat === 2 ? '#3BE862' : gpsCat === 1 ? '#FFC107' : '#FF3B4A',
                  }]} />
                  <Text style={[styles.gpsText, lightCard && { color: '#777' }]}>
                    {gpsCat === -1 ? t('Ingen GPS') : gpsCat === 0 ? t('Svag GPS') : t('GPS')}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Intervallguidning: aktuellt segment + progress ── */}
            {guided && (() => {
              const seg = engineUi.done ? null : guidedSegments![engineUi.idx]
              const total = seg ? (seg.distanceM ?? seg.durationS ?? 1) : 1
              const remain = seg
                ? seg.distanceM
                  ? Math.max(0, seg.distanceM - (distanceKm - engineUi.segStartDistKm) * 1000)
                  : Math.max(0, (seg.durationS ?? 0) - (elapsed - engineUi.segStartElapsed))
                : 0
              const pct = seg ? Math.min(1, Math.max(0, 1 - remain / total)) : 1
              const isWork = seg?.kind === 'work'
              const barColor = !seg ? '#3BE862' : isWork ? CARDIO_ACCENT : lightCard ? '#9E9E9E' : '#8A8F98'
              return (
                <Pressable
                  style={styles.ivBanner}
                  onPress={() => setHudHidden(true)}
                  onLongPress={__DEV__ ? devForceSegment : undefined}
                  delayLongPress={600}
                >
                  <View style={styles.ivBannerRow}>
                    <Text
                      style={[
                        styles.ivBannerLabel,
                        lightCard && { color: '#000' },
                        isWork && { color: CARDIO_ACCENT },
                        !seg && { color: '#3BE862' },
                      ]}
                      numberOfLines={1}
                    >
                      {seg ? seg.label : t('Passet klart')}
                    </Text>
                    {seg ? (
                      <Text style={[styles.ivBannerRemain, lightCard && { color: '#000' }]}>
                        {seg.distanceM ? t('{n} m kvar', { n: Math.ceil(remain / 10) * 10 }) : formatTime(Math.ceil(remain))}
                      </Text>
                    ) : (
                      <Ionicons name="checkmark-circle" size={15} color="#3BE862" />
                    )}
                  </View>
                  <View style={[styles.ivBannerTrack, lightCard && { backgroundColor: '#E0E0E0' }]}>
                    <View style={[styles.ivBannerFill, { width: `${pct * 100}%` as never, backgroundColor: barColor }]} />
                  </View>
                </Pressable>
              )
            })()}

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, lightCard && { color: '#000' }]}>{toDisplayDistance(distanceKm, unit).toFixed(2)}</Text>
                <Text style={styles.statLabel}>{unitLabel}</Text>
              </View>
              <View style={[styles.statDivider, lightCard && { backgroundColor: '#E0E0E0' }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, lightCard && { color: '#000' }]}>
                  {distanceKm > 0.01 ? formatPace(1, paceForUnit(elapsed / distanceKm, unit)) : '--:--'}
                </Text>
                <Text style={styles.statLabel}>{t('snitt /{unit}', { unit: unitLabel })}</Text>
              </View>
              <View style={[styles.statDivider, lightCard && { backgroundColor: '#E0E0E0' }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, lightCard && { color: '#000' }, currentPaceSec > 0 && { color: CARDIO_ACCENT }]}>
                  {currentPaceSec > 0 ? formatPace(1, paceForUnit(currentPaceSec, unit)) : '--:--'}
                </Text>
                <Text style={styles.statLabel}>{t('nu /{unit}', { unit: unitLabel })}</Text>
              </View>
              <View style={[styles.statDivider, lightCard && { backgroundColor: '#E0E0E0' }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, lightCard && { color: '#000' }]}>{calories}</Text>
                <Text style={styles.statLabel}>{t('kcal')}</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={14} color={lightCard ? '#999' : '#666'} style={{ marginTop: -2 }} />
          </TouchableOpacity>
        </SafeScreen>
      )}

      {/* ── Km split toast ── */}
      {splitToast && (
        <View style={[styles.splitToast, !LIQUID_GLASS && lightCard && { backgroundColor: 'rgba(255,255,255,0.92)' }, LIQUID_GLASS && styles.glassSurface]} pointerEvents="none">
          {LIQUID_GLASS && <GlassView glassEffectStyle="regular" colorScheme={lightCard ? 'light' : 'dark'} tintColor={lightCard ? 'rgba(250,250,252,0.55)' : 'rgba(12,12,14,0.5)'} style={StyleSheet.absoluteFill} />}
          <Ionicons name="flag" size={16} color={CARDIO_ACCENT} />
          <Text style={styles.splitToastText}>{splitToast}</Text>
        </View>
      )}

      {/* ── Right-side buttons ── */}
      <View style={styles.rightBtns}>
        <GlassCircleButton onPress={openCompass} fallbackStyle={styles.compassBtn}>
          <Animated.View style={[{ alignItems: 'center' }, needleStyle]}>
            <Ionicons name="caret-up" size={17} color="#FF3B4A" style={{ marginBottom: -5 }} />
            <Ionicons name="caret-down" size={17} color={lightCard ? '#3A3A40' : '#fff'} style={{ marginTop: -5 }} />
          </Animated.View>
        </GlassCircleButton>
        <GlassCircleButton icon="locate" draggable onPress={centerOnUser} />
      </View>

      {/* ── Tillbaka-knapp — bara innan passet startats ── */}
      {/* Kantflik — kartan går inte att svepa, knappen byter till detaljvyn */}
      {!statsExpanded && !splitsOpen && (
        <TouchableOpacity style={styles.edgeTab} onPress={openStats} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </TouchableOpacity>
      )}

      {/* ── Splits-sidan (tredje sliden) — kilometrar i block ── */}
      <Animated.View
        style={[styles.expandedStats, lightCard && { backgroundColor: '#F5F5F7' }, splitsStyle]}
        pointerEvents={splitsOpen ? 'auto' : 'none'}
      >
        <GestureDetector gesture={splitsCollapseGesture}>
          <View style={{ flex: 1 }}>
            <SafeScreen style={styles.expandedInner} edges={['top']}>
              <TouchableOpacity style={styles.expandedHandleWrap} onPress={closeSplits} activeOpacity={0.7}>
                <View style={styles.sheetHandle} />
                <Text style={styles.expandedHint}>{t('Svep höger för detaljvyn')}</Text>
              </TouchableOpacity>
              <Text style={styles.splitsPageTitle}>{t('Splits')}</Text>
              <ScrollView contentContainerStyle={styles.splitsList} showsVerticalScrollIndicator={false}>
                {/* Pågående kilometer överst, markerad */}
                <View style={[styles.splitBlock, styles.splitBlockActive]}>
                  <Text style={styles.splitBlockLabelActive}>{t('Kilometer {n}', { n: splitTimes.current.length + 1 })}</Text>
                  <Text style={styles.splitBlockPaceActive}>
                    {currentPaceSec > 0 ? formatPace(1, paceForUnit(currentPaceSec, unit)) : '0:00'}
                    <Text style={styles.splitBlockUnitActive}>{t(' /{unit}', { unit: unitLabel })}</Text>
                  </Text>
                  <Text style={styles.splitBlockDistActive}>
                    {t('{val} av 1,00 km', { val: Math.max(0, Math.min(1, distanceKm - splitTimes.current.length)).toFixed(2).replace('.', ',') })}
                  </Text>
                </View>
                {[...splitTimes.current].map((sec, i) => ({ sec, km: i + 1 })).reverse().map(sp => (
                  <View key={sp.km} style={styles.splitBlock}>
                    <Text style={styles.splitBlockLabel}>{t('Kilometer {n}', { n: sp.km })}</Text>
                    <Text style={styles.splitBlockPace}>
                      {formatPace(1, paceForUnit(sp.sec, unit))}
                      <Text style={styles.splitBlockUnit}>{t(' /{unit}', { unit: unitLabel })}</Text>
                    </Text>
                    <Text style={styles.splitBlockDist}>{t('1,00 km')}</Text>
                  </View>
                ))}
              </ScrollView>
            </SafeScreen>
          </View>
        </GestureDetector>
      </Animated.View>

      {status === 'idle' && (
        <SafeScreen style={styles.topRight} edges={['top']}>
          <GlassCircleButton icon="chevron-back" size={40} onPress={() => router.back()} />
        </SafeScreen>
      )}

      {/* ── Fullskärms-stats (kartan dold) — går att öppna även innan start ── */}
      {(
        <Animated.View
          style={[styles.expandedStats, lightCard && { backgroundColor: '#F5F5F7' }, expandedStyle]}
          pointerEvents={statsExpanded ? 'auto' : 'none'}
        >
          <GestureDetector gesture={collapseGesture}>
            <SafeScreen style={styles.expandedInner} edges={['top']}>
              <TouchableOpacity style={styles.expandedHandleWrap} onPress={closeStats} activeOpacity={0.7}>
                <View style={styles.sheetHandle} />
                <Text style={styles.expandedHint}>{t('Svep höger för karta · vänster för splits')}</Text>
              </TouchableOpacity>

              {(goalKmNum > 0 || goalMinNum > 0) && (
                <View style={styles.expandedGoal}>
                  {goalKmNum > 0 && (
                    <View style={styles.goalOne}>
                      <View style={styles.goalTextRow}>
                        <Text style={styles.goalText}>
                          {t('Mål: {val} {unit}', { val: toDisplayDistance(goalKmNum, unit).toFixed(1).replace('.', ','), unit: unitLabel })}
                        </Text>
                        <Text style={styles.goalPct}>
                          {Math.min(100, Math.round((distanceKm / goalKmNum) * 100))}%
                        </Text>
                      </View>
                      <View style={styles.goalTrack}>
                        <View style={[styles.goalFill, { width: `${Math.min(100, (distanceKm / goalKmNum) * 100)}%` as never }]} />
                      </View>
                    </View>
                  )}
                  {goalMinNum > 0 && (
                    <View style={styles.goalOne}>
                      <View style={styles.goalTextRow}>
                        <Text style={styles.goalText}>{t('Mål: {n} min', { n: goalMinNum })}</Text>
                        <Text style={[styles.goalPct, { color: CARDIO_ACCENT }]}>
                          {Math.min(100, Math.round((elapsed / (goalMinNum * 60)) * 100))}%
                        </Text>
                      </View>
                      <View style={styles.goalTrack}>
                        <View style={[styles.goalFill, { backgroundColor: CARDIO_ACCENT, width: `${Math.min(100, (elapsed / (goalMinNum * 60)) * 100)}%` as never }]} />
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* ── Guidat pass: hela segmentupplägget — klara ✓, aktuellt
                    markerat med live-återstående, kommande dämpade ── */}
              {guided && (
                <View style={styles.expandedGoal}>
                  <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                    {guidedSegments!.map((seg, i) => {
                      const isDone = engineUi.done || i < engineUi.idx
                      const isCurrent = !engineUi.done && i === engineUi.idx
                      const target = seg.distanceM
                        ? `${seg.distanceM >= 1000 ? `${String(seg.distanceM / 1000).replace('.', ',')} km` : `${seg.distanceM} m`}`
                        : formatTime(seg.durationS ?? 0)
                      const liveRemain = isCurrent
                        ? seg.distanceM
                          ? `${Math.ceil(Math.max(0, seg.distanceM - (distanceKm - engineUi.segStartDistKm) * 1000) / 10) * 10} m kvar`
                          : formatTime(Math.ceil(Math.max(0, (seg.durationS ?? 0) - (elapsed - engineUi.segStartElapsed))))
                        : null
                      return (
                        <View key={i} style={[styles.ivListRow, isCurrent && styles.ivListRowCurrent]}>
                          <View style={[styles.ivListDot, isDone && { backgroundColor: '#3BE862' }, isCurrent && { backgroundColor: CARDIO_ACCENT }]}>
                            {isDone && <Ionicons name="checkmark" size={10} color="#000" />}
                          </View>
                          <Text
                            style={[
                              styles.ivListLabel,
                              isDone && { color: '#666' },
                              isCurrent && { color: '#fff', fontWeight: '700' },
                            ]}
                            numberOfLines={1}
                          >
                            {seg.label}
                          </Text>
                          <Text style={[styles.ivListTarget, isCurrent && { color: CARDIO_ACCENT }]}>
                            {liveRemain ?? target}
                          </Text>
                        </View>
                      )
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Staplade storvärden: tid → nu-tempo → distans → snitt + kcal */}
              <View style={styles.exStack}>
                <View style={styles.exBlock}>
                  <Text style={styles.exValueBig}>{formatTime(elapsed)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.exLabel}>{t('Tid')}</Text>
                    {status === 'paused' && (
                      <View style={styles.pausedBadge}>
                        <Text style={styles.pausedBadgeText}>{t('PAUSAD')}</Text>
                      </View>
                    )}
                    {status === 'running' && autoPaused && (
                      <View style={styles.pausedBadge}>
                        <Text style={styles.pausedBadgeText}>{t('AUTOPAUS')}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.exDivider} />

                <View style={styles.exBlock}>
                  <Text style={[styles.exValueBig, currentPaceSec > 0 && { color: CARDIO_ACCENT }]}>
                    {currentPaceSec > 0 ? formatPace(1, paceForUnit(currentPaceSec, unit)) : '--:--'}
                  </Text>
                  <Text style={styles.exLabel}>{t('Nu /{unit}', { unit: unitLabel })}</Text>
                </View>

                <View style={styles.exDivider} />

                <View style={styles.exBlock}>
                  <Text style={styles.exValueBig}>{toDisplayDistance(distanceKm, unit).toFixed(2)}</Text>
                  <Text style={styles.exLabel}>{t('Distans ({unit})', { unit: unitLabel })}</Text>
                </View>

                <View style={styles.exDivider} />

                <View style={styles.exRow}>
                  <View style={styles.exBlockHalf}>
                    <Text style={styles.exValueMed}>
                      {distanceKm > 0.01 ? formatPace(1, paceForUnit(elapsed / distanceKm, unit)) : '--:--'}
                    </Text>
                    <Text style={styles.exLabel}>{t('Snitt /{unit}', { unit: unitLabel })}</Text>
                  </View>
                  <View style={styles.exDividerV} />
                  <View style={styles.exBlockHalf}>
                    <Text style={styles.exValueMed}>{calories}</Text>
                    <Text style={styles.exLabel}>{t('Kcal')}</Text>
                  </View>
                </View>
              </View>
            </SafeScreen>
          </GestureDetector>
        </Animated.View>
      )}

      {/* ── Aktivitetsväljare — inline-sheet utan overlay ── */}
      {pickerOpen && (
        <>
          {/* Osynlig yta bakom sheeten: tryck utanför stänger, utan att mörka kartan */}
          <Pressable style={styles.sheetDismiss} onPress={closePicker} />
          <Animated.View style={[styles.sheetWrap, { backgroundColor: T.CARD }, LIQUID_GLASS && styles.glassSurface, sheetStyle]}>
            {LIQUID_GLASS && <GlassView glassEffectStyle="regular" colorScheme={lightCard ? 'light' : 'dark'} tintColor={lightCard ? 'rgba(250,250,252,0.55)' : 'rgba(12,12,14,0.5)'} style={StyleSheet.absoluteFill} />}
            <GestureDetector gesture={sheetDrag}>
              <View style={styles.sheetGrip}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>{t('Välj aktivitet')}</Text>
              </View>
            </GestureDetector>
            <SafeScreen edges={['bottom']}>
              {EXERCISES.map((ex) => {
                const active = exercise === ex.key
                return (
                  <TouchableOpacity
                    key={ex.key}
                    style={[styles.sheetItem, active && styles.sheetItemActive]}
                    onPress={() => {
                      setExercise(ex.key)
                      Haptics.selectionAsync()
                      closePicker()
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.sheetItemIcon, active && { backgroundColor: CARDIO_ACCENT + '2E' }]}>
                      <Ionicons name={ex.icon} size={22} color={active ? CARDIO_ACCENT : '#999'} />
                    </View>
                    <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>{t(ex.label)}</Text>
                    {active && <Ionicons name="checkmark-circle" size={22} color={CARDIO_ACCENT} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                )
              })}
            </SafeScreen>
          </Animated.View>
        </>
      )}

      {/* ── Kartval — slide-up med förhandsbilder ── */}
      {styleMenuOpen && (
        <>
          <Pressable style={styles.sheetDismiss} onPress={closeStyleSheet} />
          <Animated.View style={[styles.sheetWrap, { backgroundColor: T.CARD }, LIQUID_GLASS && styles.glassSurface, styleSheetStyle]}>
            {LIQUID_GLASS && <GlassView glassEffectStyle="regular" colorScheme={lightCard ? 'light' : 'dark'} tintColor={lightCard ? 'rgba(250,250,252,0.55)' : 'rgba(12,12,14,0.5)'} style={StyleSheet.absoluteFill} />}
            <GestureDetector gesture={styleDrag}>
              <View style={styles.sheetGrip}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>{t('Välj karta')}</Text>
              </View>
            </GestureDetector>
            <SafeScreen edges={['bottom']}>
              <View style={styles.mapGrid}>
                {MAP_STYLES.map(ms => {
                  const active = activeStyle === ms.key
                  return (
                    <TouchableOpacity
                      key={ms.key}
                      style={[styles.mapCard, active && styles.mapCardActive]}
                      onPress={() => changeStyle(ms.key)}
                      activeOpacity={0.85}
                    >
                      {initRegion ? (
                        <View style={styles.mapPreview} pointerEvents="none">
                          <MapView
                            style={StyleSheet.absoluteFill}
                            mapType={APPLE_MAP_TYPES[ms.key] ?? 'standard'}
                            userInterfaceStyle={ms.key === 'dark' ? 'dark' : 'light'}
                            initialRegion={{ ...initRegion, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                          />
                        </View>
                      ) : (
                        <View style={[styles.mapPreview, styles.mapPreviewIcon]}>
                          <Ionicons name={ms.icon} size={26} color={active ? CARDIO_ACCENT : '#9BA0A6'} />
                        </View>
                      )}
                      <View style={styles.mapCardLabelRow}>
                        <Text style={[styles.mapCardLabel, active && { color: CARDIO_ACCENT }]}>{t(ms.label)}</Text>
                        {active && <Ionicons name="checkmark-circle" size={15} color={CARDIO_ACCENT} />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </SafeScreen>
          </Animated.View>
        </>
      )}

      {/* ── Workout summary modal ── */}
      <Modal visible={!!summary} animationType="slide" transparent>
        <View style={styles.summaryOverlay}>
          <View style={[styles.summaryContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 }]}>

            <View style={styles.summaryCheck}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </View>
            <Text style={styles.summaryTitle}>{t('Träning klar!')}</Text>
            <Text style={styles.summarySubtitle}>
              {t(selectedExercise.label)} · {new Date().toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' })}
            </Text>

            <ScrollView
              style={{ alignSelf: 'stretch', flex: 1 }}
              contentContainerStyle={{ alignItems: 'center', gap: 12, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

            {/* Namnge passet */}
            <View style={styles.nameField}>
              <Text style={styles.nameFieldLabel}>{t('PASSNAMN')}</Text>
              <AppTextInput
                style={styles.nameFieldInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder={t('T.ex. Morgonrunda (annars "{label}")', { label: t(selectedExercise.label) })}
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>

            {/* Staplade värden — samma stil som fullskärms-statsen */}
            <View style={styles.summaryStack}>
              <View style={styles.exBlock}>
                <Text style={styles.exValueBig}>{formatTime(summary?.elapsed ?? 0)}</Text>
                <Text style={styles.exLabel}>{t('Tid')}</Text>
              </View>

              <View style={styles.exDivider} />

              <View style={styles.exBlock}>
                <Text style={styles.exValueBig}>{toDisplayDistance(summary?.distanceKm ?? 0, unit).toFixed(2)}</Text>
                <Text style={styles.exLabel}>{t('Distans ({unit})', { unit: unitLabel })}</Text>
              </View>

              <View style={styles.exDivider} />

              <View style={styles.exRow}>
                <View style={styles.exBlockHalf}>
                  <Text style={styles.exValueMed}>
                    {(summary?.distanceKm ?? 0) > 0.01 ? formatPace(1, paceForUnit((summary!.elapsed) / (summary!.distanceKm), unit)) : '--:--'}
                  </Text>
                  <Text style={styles.exLabel}>{t('Snitt /{unit}', { unit: unitLabel })}</Text>
                </View>
                <View style={styles.exDividerV} />
                <View style={styles.exBlockHalf}>
                  <Text style={styles.exValueMed}>{summary?.calories ?? 0}</Text>
                  <Text style={styles.exLabel}>{t('Kcal')}</Text>
                </View>
              </View>
            </View>

            {/* Kilometersplittar med tempo-staplar */}
            {summary && summary.splits.length > 0 && (() => {
              const fastest = Math.min(...summary.splits.map(s => s.paceSec))
              return (
                <View style={styles.splitsWrap}>
                  <Text style={styles.splitsTitle}>{t('Splittar')}</Text>
                  {summary.splits.map((sp, i) => (
                    <View key={i} style={styles.splitRow}>
                      <Text style={styles.splitKm}>{sp.label}</Text>
                      <View style={styles.splitBarTrack}>
                        <View style={[styles.splitBar, { width: `${sp.paceSec > 0 ? Math.max(12, (fastest / sp.paceSec) * 100) : 12}%` as never }]} />
                      </View>
                      <Text style={styles.splitPace}>{formatPace(1, sp.paceSec)}</Text>
                    </View>
                  ))}
                </View>
              )
            })()}

            {/* Målresultat — en rad per mål */}
            {summary && goalKmNum > 0 && (() => {
              const pct = summary.distanceKm / goalKmNum
              const reached = pct >= 1
              return (
                <View style={styles.summaryGoalRow}>
                  <Ionicons name={reached ? 'trophy' : 'flag-outline'} size={16} color={reached ? '#FFD54F' : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.summaryGoalText, reached && { color: '#FFD54F' }]}>
                    {reached
                      ? t('Distansmål uppnått!')
                      : t('{pct}% av distansmålet ({val} {unit})', { pct: Math.round(pct * 100), val: toDisplayDistance(goalKmNum, unit).toFixed(1).replace('.', ','), unit: unitLabel })}
                  </Text>
                </View>
              )
            })()}
            {summary && goalMinNum > 0 && (() => {
              const pct = summary.elapsed / (goalMinNum * 60)
              const reached = pct >= 1
              return (
                <View style={styles.summaryGoalRow}>
                  <Ionicons name={reached ? 'trophy' : 'flag-outline'} size={16} color={reached ? '#FFD54F' : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.summaryGoalText, reached && { color: '#FFD54F' }]}>
                    {reached
                      ? t('Tidsmål uppnått!')
                      : t('{pct}% av tidsmålet ({n} min)', { pct: Math.round(pct * 100), n: goalMinNum })}
                  </Text>
                </View>
              )
            })()}
            {/* Guidat pass: intervallfacit ("1 av 1" på tempo/maraton är brus → totalWork > 1) */}
            {summary && guided && totalWork > 1 && (() => {
              const all = engineUi.completedWork >= totalWork
              return (
                <>
                  <View style={styles.summaryGoalRow}>
                    <Ionicons name={all ? 'trophy' : 'flash-outline'} size={16} color={all ? '#FFD54F' : 'rgba(255,255,255,0.6)'} />
                    <Text style={[styles.summaryGoalText, all && { color: '#FFD54F' }]}>
                      {all
                        ? t('Alla {n} intervaller avklarade!', { n: totalWork })
                        : t('{done} av {total} intervaller', { done: engineUi.completedWork, total: totalWork })}
                    </Text>
                  </View>
                  {/* Tempo per intervall — snabbaste markerad */}
                  {intervalResults.current.length > 0 && (() => {
                    const fastest = Math.min(...intervalResults.current.map(r => r.paceSec || Infinity))
                    return (
                      <View style={styles.summaryIvChips}>
                        {intervalResults.current.map((r, i) => {
                          const isFastest = r.paceSec > 0 && r.paceSec === fastest
                          return (
                            <View key={i} style={[styles.summaryIvChip, isFastest && styles.summaryIvChipFast]}>
                              <Text style={[styles.summaryIvChipText, isFastest && { color: CARDIO_ACCENT }]}>
                                {i + 1} · {formatPace(1, paceForUnit(r.paceSec, unit))}
                              </Text>
                            </View>
                          )
                        })}
                      </View>
                    )
                  })()}
                </>
              )
            })()}

            {/* Ansträngningsbetyg — tryck för att ändra */}
            <TouchableOpacity style={styles.effortRow} onPress={() => setEffortOpen(true)} activeOpacity={0.7}>
              {effort ? (
                <>
                  <View style={[styles.effortBadge, { backgroundColor: effortColor(effort) + '26', borderColor: effortColor(effort) }]}>
                    <Text style={[styles.effortBadgeText, { color: effortColor(effort) }]}>{effort}</Text>
                  </View>
                  <Text style={styles.effortRowText}>{t('Ansträngning · {label}', { label: t(effortLabel(effort)) })}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="pulse-outline" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.effortRowText}>{t('Betygsätt din ansträngning')}</Text>
                </>
              )}
              <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>

            {/* Poäng-hint */}
            <View style={styles.summaryPoints}>
              <Ionicons name="star" size={13} color={CARDIO_ACCENT} />
              <Text style={styles.summaryPointsText}>{t('+30 p mot din nästa nivå')}</Text>
            </View>

            </ScrollView>

            <TouchableOpacity
              style={[styles.summaryBtn, saving && { opacity: 0.6 }]}
              onPress={saveSummaryAndExit}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Ionicons name="save-outline" size={20} color="#000" />
              <Text style={styles.summaryBtnText}>{saving ? t('Sparar…') : t('Spara & avsluta')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.summaryDiscard} onPress={() => { setSummary(null); router.back() }}>
              <Text style={styles.summaryDiscardText}>{t('Kasta träningen')}</Text>
            </TouchableOpacity>

          </View>

          {/* Betygsätt ansträngning — lager över sammanfattningen */}
          <EffortRating
            visible={effortOpen}
            initial={effort}
            onDone={(e) => { setEffort(e); setEffortOpen(false) }}
          />
        </View>
      </Modal>

      {/* Röstguidning — fullskärmsinställningar i Runkeeper-stil */}
      <Modal visible={voiceModalOpen} animationType="slide" onRequestClose={() => setVoiceModalOpen(false)}>
        <View style={styles.voiceRoot}>
          <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
            <View style={styles.voiceHeader}>
              <TouchableOpacity
                onPress={() => (voicePage === 'main' ? setVoiceModalOpen(false) : setVoicePage('main'))}
                hitSlop={12}
              >
                <Ionicons name={voicePage === 'main' ? 'close' : 'chevron-back'} size={26} color={T.TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>
            <View style={styles.voiceIconWrap}>
              <View style={styles.voiceIconCircle}>
                <Ionicons name="volume-high-outline" size={36} color={CARDIO_ACCENT} />
              </View>
              <Text style={styles.voiceTitle}>
                {voicePage === 'main' ? t('Röstguidning') : voicePage === 'freq' ? t('Hur ofta?') : voicePage === 'stats' ? t('Vilken statistik?') : t('Röst')}
              </Text>
            </View>

            {voicePage === 'main' && (
              <View style={styles.voiceList}>
                <View style={styles.voiceRow}>
                  <Text style={styles.voiceRowLabel}>{t('Aktivera')}</Text>
                  <Switch
                    value={voiceOn}
                    onValueChange={setVoiceEnabled}
                    trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                    thumbColor="#fff"
                  />
                </View>
                {/* Guidningen har egen röst — kan vara på fast statistiken är av */}
                <View style={styles.voiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voiceRowLabel}>{t('Intervallguidning')}</Text>
                    <Text style={styles.voiceRowValue}>{t('Segmentbyten och vila på guidade pass')}</Text>
                  </View>
                  <Switch
                    value={voiceSet.say.intervals}
                    onValueChange={on => updateVoiceSet({ say: { intervals: on } })}
                    trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                    thumbColor="#fff"
                  />
                </View>
                <TouchableOpacity style={styles.voiceRow} onPress={() => setVoicePage('voice')} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voiceRowLabel}>{t('Röst')}</Text>
                    <Text style={styles.voiceRowValue} numberOfLines={1}>
                      {(() => {
                        const v = coachVoices.find(x => x.identifier === coachVoiceId)
                        return v ? `${voiceDisplayName(v)} · ${voiceQualityLabel(v)}` : t('Automatisk')
                      })()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.voiceRow} onPress={() => setVoicePage('freq')} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voiceRowLabel}>{t('Hur ofta?')}</Text>
                    <Text style={styles.voiceRowValue}>
                      {[
                        voiceSet.distEvery > 0 ? (voiceSet.distEvery === 1 ? t('Varje kilometer') : t('Varje {n}:e kilometer', { n: voiceSet.distEvery })) : null,
                        voiceSet.timeEvery > 0 ? t('var {n}:e minut', { n: voiceSet.timeEvery }) : null,
                      ].filter(Boolean).join(' · ') || t('Aldrig')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.voiceRow} onPress={() => setVoicePage('stats')} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voiceRowLabel}>{t('Vilken statistik?')}</Text>
                    <Text style={styles.voiceRowValue} numberOfLines={1}>
                      {[
                        voiceSet.say.time && t('Tid'),
                        voiceSet.say.distance && t('Distans'),
                        voiceSet.say.avgPace && t('Snittempo'),
                        voiceSet.say.curPace && t('Aktuellt tempo'),
                        voiceSet.say.splitPace && t('Split-tempo'),
                        voiceSet.say.summary && t('Sammanfattning'),
                      ].filter(Boolean).join(', ') || t('Ingen')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            )}

            {voicePage === 'voice' && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 40 }}
              >
                <Text style={[styles.voiceHint, { marginBottom: 2 }]}>{t('Tryck på en röst för att välja och provlyssna.')}</Text>
                {coachVoices.map(v => {
                  const active = v.identifier === coachVoiceId
                  const quality = voiceQualityLabel(v)
                  return (
                    <TouchableOpacity
                      key={v.identifier}
                      style={[styles.voiceRow, active && styles.voiceRowActive]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setCoachVoiceIdState(v.identifier)
                        coachVoiceRef.current = v.identifier
                        setCoachVoiceId(v.identifier)
                        previewVoice(v.identifier)
                      }}
                    >
                      <View style={styles.voiceAvatar}>
                        <Ionicons name={active ? 'volume-high' : 'volume-medium-outline'} size={19} color={active ? CARDIO_ACCENT : '#9BA0A6'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.voiceRowLabel}>{voiceDisplayName(v)}</Text>
                      </View>
                      <View style={[styles.voiceBadge, quality !== 'Standard' && styles.voiceBadgeGood]}>
                        <Text style={[styles.voiceBadgeText, quality !== 'Standard' && styles.voiceBadgeTextGood]}>{quality}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={20} color={CARDIO_ACCENT} style={{ marginLeft: 8 }} />}
                    </TouchableOpacity>
                  )
                })}
                {coachVoices.length === 0 && (
                  <Text style={styles.voiceHint}>{t('Inga svenska röster hittades på enheten.')}</Text>
                )}

                {/* iOS tillåter inga djuplänkar till undersidor i Inställningar —
                    en ärlig steg-för-steg-guide istället för en låtsasknapp */}
                <View style={styles.voiceDownload}>
                  <View style={styles.voiceDownloadHead}>
                    <View style={styles.voiceAvatar}>
                      <Ionicons name="cloud-download-outline" size={19} color={CARDIO_ACCENT} />
                    </View>
                    <Text style={styles.voiceRowLabel}>{t('Så får du den mjukaste rösten')}</Text>
                  </View>
                  {[
                    t('Öppna Inställningar på din iPhone'),
                    t('Hjälpmedel → Uppläst innehåll → Röster'),
                    t('Svenska → Alva → hämta Alva (Premium)'),
                    t('Kom tillbaka hit och välj den'),
                  ].map((step, i) => (
                    <View key={i} style={styles.voiceStep}>
                      <View style={styles.voiceStepNum}>
                        <Text style={styles.voiceStepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.voiceStepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            {voicePage === 'freq' && (
              <View style={styles.voiceList}>
                <View style={styles.voiceFreqBlock}>
                  <View style={styles.voiceRowPlain}>
                    <Text style={styles.voiceRowLabel}>{t('Distans')}</Text>
                    <Switch
                      value={voiceSet.distEvery > 0}
                      onValueChange={on => updateVoiceSet({ distEvery: on ? 1 : 0 })}
                      trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={[styles.voiceStepper, voiceSet.distEvery === 0 && { opacity: 0.35 }]}>
                    <TouchableOpacity
                      style={styles.voiceStepBtn}
                      disabled={voiceSet.distEvery <= 1}
                      onPress={() => updateVoiceSet({ distEvery: Math.max(1, voiceSet.distEvery - 1) })}
                    >
                      <Ionicons name="remove" size={24} color={T.TEXT_PRIMARY} />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.voiceStepValue}>{voiceSet.distEvery || 1}</Text>
                      <Text style={styles.voiceStepUnit}>{t('kilometer')}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.voiceStepBtn}
                      disabled={voiceSet.distEvery === 0 || voiceSet.distEvery >= 10}
                      onPress={() => updateVoiceSet({ distEvery: Math.min(10, voiceSet.distEvery + 1) })}
                    >
                      <Ionicons name="add" size={24} color={T.TEXT_PRIMARY} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.voiceFreqBlock}>
                  <View style={styles.voiceRowPlain}>
                    <Text style={styles.voiceRowLabel}>{t('Tid')}</Text>
                    <Switch
                      value={voiceSet.timeEvery > 0}
                      onValueChange={on => updateVoiceSet({ timeEvery: on ? 5 : 0 })}
                      trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={[styles.voiceStepper, voiceSet.timeEvery === 0 && { opacity: 0.35 }]}>
                    <TouchableOpacity
                      style={styles.voiceStepBtn}
                      disabled={voiceSet.timeEvery <= 1}
                      onPress={() => updateVoiceSet({ timeEvery: Math.max(1, voiceSet.timeEvery - 1) })}
                    >
                      <Ionicons name="remove" size={24} color={T.TEXT_PRIMARY} />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.voiceStepValue}>{voiceSet.timeEvery || 5}</Text>
                      <Text style={styles.voiceStepUnit}>{t('minuter')}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.voiceStepBtn}
                      disabled={voiceSet.timeEvery === 0 || voiceSet.timeEvery >= 60}
                      onPress={() => updateVoiceSet({ timeEvery: Math.min(60, voiceSet.timeEvery + 1) })}
                    >
                      <Ionicons name="add" size={24} color={T.TEXT_PRIMARY} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {voicePage === 'stats' && (
              <View style={styles.voiceList}>
                {([
                  { key: 'time' as const,      label: 'Tid' },
                  { key: 'distance' as const,  label: 'Distans' },
                  { key: 'avgPace' as const,   label: 'Genomsnittligt tempo' },
                  { key: 'curPace' as const,   label: 'Aktuellt tempo' },
                  { key: 'splitPace' as const, label: 'Split-tempo' },
                  { key: 'summary' as const,   label: 'Sammanfattning vid avslut' },
                ]).map(opt => (
                  <View key={opt.key} style={styles.voiceRow}>
                    <Text style={styles.voiceRowLabel}>{t(opt.label)}</Text>
                    <Switch
                      value={voiceSet.say[opt.key]}
                      onValueChange={on => updateVoiceSet({ say: { [opt.key]: on } })}
                      trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Målväljare — stegare i samma stil som röstinställningarna */}
      <Modal visible={goalModalOpen} transparent animationType="slide" onRequestClose={() => setGoalModalOpen(false)}>
        <Pressable style={styles.goalModalOverlay} onPress={() => setGoalModalOpen(false)}>
          <Pressable style={styles.goalModalSheet} onPress={() => {}}>
            <View style={styles.goalIconWrap}>
              <View style={styles.goalIconCircle}>
                <Ionicons name="flag-outline" size={28} color={CARDIO_ACCENT} />
              </View>
              <Text style={styles.goalModalTitle}>{t('Sätt mål')}</Text>
            </View>

            <View style={styles.voiceFreqBlock}>
              <View style={styles.voiceRowPlain}>
                <Text style={styles.voiceRowLabel}>{t('Distans')}</Text>
                <Switch
                  value={goalKmDraft > 0}
                  onValueChange={on => setGoalKmDraft(on ? 5 : 0)}
                  trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.voiceStepper, goalKmDraft === 0 && { opacity: 0.35 }]}>
                <TouchableOpacity
                  style={styles.voiceStepBtn}
                  disabled={goalKmDraft <= 0.5}
                  onPress={() => setGoalKmDraft(v => Math.max(0.5, Math.round((v - 0.5) * 2) / 2))}
                >
                  <Ionicons name="remove" size={24} color={T.TEXT_PRIMARY} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.voiceStepValue}>
                    {(goalKmDraft || 5).toFixed(goalKmDraft % 1 === 0 ? 0 : 1).replace('.', ',')}
                  </Text>
                  <Text style={styles.voiceStepUnit}>{unitLabel}</Text>
                </View>
                <TouchableOpacity
                  style={styles.voiceStepBtn}
                  disabled={goalKmDraft === 0 || goalKmDraft >= 100}
                  onPress={() => setGoalKmDraft(v => Math.min(100, Math.round((v + 0.5) * 2) / 2))}
                >
                  <Ionicons name="add" size={24} color={T.TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.voiceFreqBlock}>
              <View style={styles.voiceRowPlain}>
                <Text style={styles.voiceRowLabel}>{t('Tid')}</Text>
                <Switch
                  value={goalMinDraft > 0}
                  onValueChange={on => setGoalMinDraft(on ? 30 : 0)}
                  trackColor={{ false: '#333', true: CARDIO_ACCENT }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.voiceStepper, goalMinDraft === 0 && { opacity: 0.35 }]}>
                <TouchableOpacity
                  style={styles.voiceStepBtn}
                  disabled={goalMinDraft <= 5}
                  onPress={() => setGoalMinDraft(v => Math.max(5, v - 5))}
                >
                  <Ionicons name="remove" size={24} color={T.TEXT_PRIMARY} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.voiceStepValue}>{goalMinDraft || 30}</Text>
                  <Text style={styles.voiceStepUnit}>{t('minuter')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.voiceStepBtn}
                  disabled={goalMinDraft === 0 || goalMinDraft >= 300}
                  onPress={() => setGoalMinDraft(v => Math.min(300, v + 5))}
                >
                  <Ionicons name="add" size={24} color={T.TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.goalModalSave} onPress={saveGoal} activeOpacity={0.85}>
              <Text style={styles.goalModalSaveText}>{t('Spara mål')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goalModalClear}
              onPress={() => { setGoalKmNum(0); setGoalMinNum(0); setGoalModalOpen(false) }}
            >
              <Text style={styles.goalModalClearText}>{t('Inget mål')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Infosheet: passets upplägg (guidade pass) ── */}
      <Modal visible={infoSheet === 'plan'} transparent animationType="slide" onRequestClose={() => setInfoSheet(null)}>
        <Pressable style={styles.goalModalOverlay} onPress={() => setInfoSheet(null)}>
          <Pressable style={styles.goalModalSheet} onPress={() => {}}>
            <View style={styles.goalIconWrap}>
              <View style={styles.goalIconCircle}>
                <Ionicons name="flash" size={26} color={CARDIO_ACCENT} />
              </View>
              <Text style={styles.goalModalTitle}>{t('Passets upplägg')}</Text>
              <Text style={styles.infoSheetSub}>
                {t('Följ guidningen, rösten och bannern säger till när det är dags att växla')}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {guidedSegments?.map((seg, i) => {
                const icon: React.ComponentProps<typeof Ionicons>['name'] =
                  seg.kind === 'work' ? 'flash-outline'
                  : seg.kind === 'rest' ? 'pause-outline'
                  : seg.kind === 'cooldown' ? 'leaf-outline'
                  : 'walk-outline'
                const target = seg.distanceM
                  ? seg.distanceM >= 1000 && seg.distanceM % 100 === 0
                    ? `${String(seg.distanceM / 1000).replace('.', ',')} km`
                    : `${seg.distanceM} m`
                  : (seg.durationS ?? 0) < 120
                    ? `${seg.durationS} s`
                    : `${Math.round((seg.durationS ?? 0) / 60)} min`
                const isWork = seg.kind === 'work'
                return (
                  <View key={i} style={[styles.infoPlanRow, i > 0 && styles.infoPlanRowBorder]}>
                    <View style={[styles.infoPlanIcon, isWork && { backgroundColor: CARDIO_ACCENT + '22' }]}>
                      <Ionicons name={icon} size={15} color={isWork ? CARDIO_ACCENT : '#9BA0A6'} />
                    </View>
                    <Text style={[styles.infoPlanLabel, isWork && { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>
                      {seg.label}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.infoPlanTarget, isWork && { color: CARDIO_ACCENT }]}>{target}</Text>
                      {isWork && seg.paceSecLo && (
                        <Text style={styles.infoPlanPace}>
                          {t('ca')} {formatPace(1, paceForUnit(seg.paceSecLo, unit))}
                          {seg.paceSecHi && seg.paceSecHi !== seg.paceSecLo ? `–${formatPace(1, paceForUnit(seg.paceSecHi, unit))}` : ''} /{unitLabel}
                        </Text>
                      )}
                    </View>
                  </View>
                )
              })}
            </ScrollView>
            <TouchableOpacity style={styles.goalModalSave} onPress={() => setInfoSheet(null)}>
              <Text style={styles.goalModalSaveText}>{t('Jag är redo')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Infosheet: vad aktiviteten går ut på (guidade pass) ── */}
      <Modal visible={infoSheet === 'activity'} transparent animationType="slide" onRequestClose={() => setInfoSheet(null)}>
        <Pressable style={styles.goalModalOverlay} onPress={() => setInfoSheet(null)}>
          <Pressable style={styles.goalModalSheet} onPress={() => {}}>
            <View style={styles.goalIconWrap}>
              <View style={styles.goalIconCircle}>
                <Ionicons name={selectedExercise.icon} size={26} color={CARDIO_ACCENT} />
              </View>
              <Text style={styles.goalModalTitle}>{t(selectedExercise.label)}</Text>
            </View>
            <Text style={styles.infoSheetDesc}>{t(ACTIVITY_INFO[exercise].desc)}</Text>
            <Text style={styles.infoSheetTipsHead}>{t('TÄNK PÅ')}</Text>
            <View style={{ gap: 10 }}>
              {ACTIVITY_INFO[exercise].tips.map((tip, i) => (
                <View key={i} style={styles.infoTipRow}>
                  <View style={styles.infoTipDot}>
                    <Ionicons name="checkmark" size={11} color={CARDIO_ACCENT} />
                  </View>
                  <Text style={styles.infoTipText}>{t(tip)}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.goalModalSave} onPress={() => setInfoSheet(null)}>
              <Text style={styles.goalModalSaveText}>{t('Jag är redo')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <SafeScreen
        style={[
          status === 'idle' ? styles.bottomBarIdle : styles.bottomBar,
          status !== 'idle' && !LIQUID_GLASS && lightCard && { backgroundColor: 'rgba(250,250,252,0.97)' },
          status !== 'idle' && LIQUID_GLASS && styles.glassSurface,
        ]}
        edges={['bottom']}
      >
        {status !== 'idle' && LIQUID_GLASS && <GlassView glassEffectStyle="regular" colorScheme={lightCard ? 'light' : 'dark'} tintColor={lightCard ? 'rgba(250,250,252,0.55)' : 'rgba(12,12,14,0.5)'} style={StyleSheet.absoluteFill} />}
        {/* Tre sidor: Splits · Karta · Statistik */}
        <View style={styles.pageDots}>
          {[0, 1, 2].map(i => {
            const active = splitsOpen ? i === 2 : statsExpanded ? i === 1 : i === 0
            return <View key={i} style={[styles.pageDot, active && styles.pageDotOn]} />
          })}
        </View>
        <View style={styles.bottomInner}>

          {status === 'idle' ? (
            <View style={styles.idleWrap}>
              {/* Inställningsrutnät i eget flytande kort, Start separat under */}
              <View style={[styles.idleCard, lightCard && { backgroundColor: 'rgba(255,255,255,0.94)' }]}>
              <View style={styles.idleGrid}>
                {/* Guidade pass: planen äger aktivitet och mål — cellerna öppnar
                    infosheets istället för väljare */}
                <TouchableOpacity
                  style={styles.idleCell}
                  onPress={guided ? () => setInfoSheet('activity') : openPicker}
                  activeOpacity={0.75}
                >
                  <Ionicons name={selectedExercise.icon} size={20} color={CARDIO_ACCENT} />
                  <View style={styles.idleCellText}>
                    <Text style={styles.idleCellLabel}>{t('Aktivitet')}</Text>
                    <Text style={styles.idleCellValue}>{t(selectedExercise.label)}</Text>
                  </View>
                  {guided && <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />}
                </TouchableOpacity>
                <View style={styles.idleGridDivV} />
                <TouchableOpacity
                  style={styles.idleCell}
                  onPress={guided ? () => setInfoSheet('plan') : openGoalModal}
                  activeOpacity={0.75}
                >
                  <Ionicons name="flag-outline" size={20} color={CARDIO_ACCENT} />
                  <View style={styles.idleCellText}>
                    <Text style={styles.idleCellLabel}>{guided ? t('Upplägg') : t('Mål')}</Text>
                    <Text style={styles.idleCellValue} numberOfLines={1}>
                      {guided
                        ? totalWork > 1
                          ? t('{n} intervaller', { n: totalWork })
                          : t('Följer passet')
                        : goalKmNum > 0 || goalMinNum > 0
                          ? [
                              goalKmNum > 0 ? `${String(goalKmNum).replace('.', ',')} ${unitLabel}` : null,
                              goalMinNum > 0 ? `${goalMinNum} min` : null,
                            ].filter(Boolean).join(' · ')
                          : t('Inget')}
                    </Text>
                  </View>
                  {guided && <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />}
                </TouchableOpacity>
              </View>
              <View style={styles.idleGridDivH} />
              <View style={styles.idleGrid}>
                <TouchableOpacity style={styles.idleCell} onPress={() => { setVoicePage('main'); setVoiceModalOpen(true) }} activeOpacity={0.75}>
                  <Ionicons name={voiceOn ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color={CARDIO_ACCENT} />
                  <View style={styles.idleCellText}>
                    <Text style={styles.idleCellLabel}>{t('Röstguidning')}</Text>
                    <Text style={styles.idleCellValue} numberOfLines={1}>
                      {!voiceOn ? t('Av')
                        : [
                            voiceSet.distEvery > 0 ? `${voiceSet.distEvery} km` : null,
                            voiceSet.timeEvery > 0 ? `${voiceSet.timeEvery} min` : null,
                          ].filter(Boolean).join(' · ') || t('På')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.idleGridDivV} />
                <TouchableOpacity style={styles.idleCell} onPress={openStyleSheet} activeOpacity={0.75}>
                  <Ionicons name="layers-outline" size={20} color={CARDIO_ACCENT} />
                  <View style={styles.idleCellText}>
                    <Text style={styles.idleCellLabel}>{t('Karta')}</Text>
                    <Text style={styles.idleCellValue}>
                      {t(MAP_STYLES.find(m => m.key === activeStyle)?.label ?? 'Karta')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              </View>

              <TouchableOpacity style={styles.startWide} onPress={beginCountdown} activeOpacity={0.85}>
                <Text style={styles.startWideText}>{t('Start')}</Text>
              </TouchableOpacity>
            </View>
          ) : status === 'running' ? (
            // Under passet: bara en bred pausknapp
            <TouchableOpacity style={styles.pausePill} onPress={pauseTracking} activeOpacity={0.85}>
              <Ionicons name="pause" size={24} color="#fff" />
              <Text style={styles.pausePillText}>{t('Pausa')}</Text>
            </TouchableOpacity>
          ) : (
            // Pausad: bred Återuppta, mindre Avsluta så man inte råkar avsluta
            <>
              <TouchableOpacity style={[styles.pausePill, { flex: 2 }]} onPress={startTracking} activeOpacity={0.85}>
                <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 2 }} />
                <Text style={styles.pausePillText}>{t('Återuppta')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.finishPill, lightCard && { backgroundColor: '#E5E5EA' }, lightCard && { backgroundColor: '#E5E5EA' }]} onPress={handleFinish} activeOpacity={0.85}>
                <Ionicons name="stop" size={18} color="#fff" />
                <Text style={styles.finishPillText}>{t('Avsluta')}</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </SafeScreen>

    </View>
  )
}
