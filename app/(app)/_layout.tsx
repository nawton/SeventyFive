import { Tabs } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'

const ORANGE   = '#FF8F00'
const TAB_H    = 68
const TAB_R    = 34
const TAB_SIDE = 20
const TAB_BOT  = 16
const PAD      = 7

type IconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_CFG: { name: string; icon: IconName; isAdd?: boolean }[] = [
  { name: 'dashboard', icon: 'home' },
  { name: 'activity',  icon: 'body' },
  { name: 'add',       icon: 'add', isAdd: true },
  { name: 'stats',     icon: 'bar-chart' },
  { name: 'settings',  icon: 'person-outline' },
]

// ─── Custom liquid-glass tab bar ──────────────────────────────────────────────

function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets    = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(0)).current
  const [barW, setBarW] = useState(0)

  const routes = state.routes.filter(r => TAB_CFG.some(c => c.name === r.name))
  const tabW   = barW > 0 ? barW / routes.length : 0
  const visIdx = routes.findIndex(r => r.key === state.routes[state.index]?.key)

  // Refs so PanResponder callbacks (created once) always read fresh values
  const tabWRef   = useRef(tabW)
  const visIdxRef = useRef(visIdx)
  const routesRef = useRef(routes)
  useEffect(() => { tabWRef.current = tabW },     [tabW])
  useEffect(() => { visIdxRef.current = visIdx }, [visIdx])
  useEffect(() => { routesRef.current = routes },  [routes])

  // Spring bubble to current tab whenever navigation changes
  useEffect(() => {
    if (visIdx < 0 || tabW <= 0) return
    Animated.spring(slideAnim, {
      toValue: visIdx, useNativeDriver: false, tension: 220, friction: 22,
    }).start()
  }, [visIdx, tabW])

  const snap = (x: number) =>
    Math.round(Math.max(0, Math.min(routesRef.current.length - 1, (x - TAB_SIDE) / tabWRef.current)))

  // Instagram-style: capture touch immediately → bubble jumps to finger, follows drag, snaps on release
  const barPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,   // claim the touch right away

      onPanResponderGrant: e => {
        if (tabWRef.current <= 0) return
        const raw = (e.nativeEvent.pageX - TAB_SIDE) / tabWRef.current
        // Move bubble instantly to touch position (no animation lag)
        slideAnim.setValue(Math.max(0, Math.min(routesRef.current.length - 1, raw)))
      },

      onPanResponderMove: (_, g) => {
        if (tabWRef.current <= 0) return
        const raw = (g.moveX - TAB_SIDE) / tabWRef.current
        slideAnim.setValue(Math.max(0, Math.min(routesRef.current.length - 1, raw)))
      },

      onPanResponderRelease: (_, g) => {
        if (tabWRef.current <= 0) return
        const idx = snap(g.moveX)
        Animated.spring(slideAnim, {
          toValue: idx, useNativeDriver: false, tension: 220, friction: 22,
        }).start()
        const target = routesRef.current[idx]
        if (target) {
          const ev = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true })
          if (!ev.defaultPrevented) navigation.navigate(target.name)
        }
      },

      // If OS steals the gesture (e.g. notification pull-down) snap back to current tab
      onPanResponderTerminate: () => {
        Animated.spring(slideAnim, {
          toValue: visIdxRef.current, useNativeDriver: false, tension: 220, friction: 22,
        }).start()
      },
    })
  ).current

  const bubbleW = tabW - PAD * 2
  const bubbleH = TAB_H - PAD * 2
  const bubbleR = bubbleH / 2

  const translateX = tabW > 0
    ? slideAnim.interpolate({
        inputRange:  routes.map((_, i) => i),
        outputRange: routes.map((_, i) => i * tabW + PAD),
      })
    : slideAnim

  return (
    <View
      style={[styles.wrap, { bottom: TAB_BOT + insets.bottom }]}
      onLayout={e => setBarW(e.nativeEvent.layout.width)}
      {...barPan.panHandlers}
    >
      {/* Frosted glass bar */}
      <View style={[StyleSheet.absoluteFill, styles.barClip]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.barBorder]} />
      </View>

      {/* Sliding glass bubble */}
      {bubbleW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.bubble, { width: bubbleW, height: bubbleH, borderRadius: bubbleR, transform: [{ translateX }] }]}
        >
          <View style={[StyleSheet.absoluteFill, { borderRadius: bubbleR, overflow: 'hidden' }]}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.52)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={[StyleSheet.absoluteFill, { borderRadius: bubbleR, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)' }]} />
        </Animated.View>
      )}

      {/* Tab items — no TouchableOpacity needed; PanResponder handles both taps and drags */}
      {routes.map(route => {
        const cfg      = TAB_CFG.find(c => c.name === route.name)!
        const isFocused = route.key === state.routes[state.index]?.key
        return (
          <View key={route.key} style={styles.tabBtn}>
            {cfg.isAdd ? (
              <View style={[styles.addCircle, isFocused && styles.addCircleFocused]}>
                <Ionicons name="add" size={26} color="#000" />
              </View>
            ) : (
              <Ionicons name={cfg.icon} size={22} color={isFocused ? '#111' : 'rgba(255,255,255,0.55)'} />
            )}
          </View>
        )
      })}
    </View>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const insets = useSafeAreaInsets()

  // Refs so the swipe PanResponder (created once) can always read current nav state
  const stateRef = useRef<any>(null)
  const navRef   = useRef<any>(null)

  // Horizontal swipe on any screen content → switch tab
  const screenSwipe = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Only claim clear horizontal swipes; let vertical scroll pass through
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5,
      onPanResponderRelease: (_, g) => {
        const state = stateRef.current
        const nav   = navRef.current
        if (!state || !nav) return
        const routes = state.routes.filter((r: any) => TAB_CFG.some(c => c.name === r.name))
        const visIdx = routes.findIndex((r: any) => r.key === state.routes[state.index]?.key)
        if (g.dx < -40 && visIdx < routes.length - 1) nav.navigate(routes[visIdx + 1].name)
        else if (g.dx > 40 && visIdx > 0)             nav.navigate(routes[visIdx - 1].name)
      },
    })
  ).current

  // padding = tab bar height + its gap from bottom + safe-area so NO screen is ever covered
  const bottomPad = TAB_H + TAB_BOT + insets.bottom

  return (
    <View style={{ flex: 1 }} {...screenSwipe.panHandlers}>
      <Tabs
        tabBar={props => {
          // Keep refs fresh on every render so the swipe handler sees the latest state
          stateRef.current = props.state
          navRef.current   = props.navigation
          return <GlassTabBar {...props} />
        }}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          sceneContainerStyle: { paddingBottom: bottomPad },
        }}
      >
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="activity" />
        <Tabs.Screen name="add" />
        <Tabs.Screen name="stats" />
        <Tabs.Screen name="settings" />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
      </Tabs>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: TAB_SIDE, right: TAB_SIDE,
    height: TAB_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: TAB_R,
  },
  barClip:   { borderRadius: TAB_R, overflow: 'hidden' },
  barBorder: { borderRadius: TAB_R, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  bubble:    { position: 'absolute', top: PAD },
  tabBtn: {
    flex: 1, height: TAB_H,
    alignItems: 'center', justifyContent: 'center',
  },
  addCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55, shadowRadius: 10,
  },
  addCircleFocused: { shadowOpacity: 0.85, shadowRadius: 18 },
})
