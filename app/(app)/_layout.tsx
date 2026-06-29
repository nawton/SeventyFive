import { Tabs } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  View,
  StyleSheet,
  Animated,
  TouchableOpacity,
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
  const insets   = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(0)).current
  const [barW, setBarW] = useState(0)

  // Only the routes that have a TAB_CFG entry (excludes href:null screens)
  const routes = state.routes.filter(r => TAB_CFG.some(c => c.name === r.name))
  const tabW   = barW > 0 ? barW / routes.length : 0

  const visIdx = routes.findIndex(r => r.key === state.routes[state.index]?.key)

  // Spring to new tab when state.index changes
  useEffect(() => {
    if (visIdx < 0 || tabW <= 0) return
    Animated.spring(slideAnim, {
      toValue: visIdx,
      useNativeDriver: false,
      tension: 220,
      friction: 22,
    }).start()
  }, [visIdx, tabW])

  // PanResponder — drag finger to slide between tabs
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (tabW <= 0) return
        const rawIdx = (g.moveX - TAB_SIDE) / tabW
        slideAnim.setValue(Math.max(0, Math.min(routes.length - 1, rawIdx)))
      },
      onPanResponderRelease: (_, g) => {
        if (tabW <= 0) return
        const rawIdx  = (g.moveX - TAB_SIDE) / tabW
        const snapIdx = Math.round(Math.max(0, Math.min(routes.length - 1, rawIdx)))
        Animated.spring(slideAnim, {
          toValue: snapIdx,
          useNativeDriver: false,
          tension: 220,
          friction: 22,
        }).start()
        const target = routes[snapIdx]
        if (target && target.key !== state.routes[state.index]?.key) {
          navigation.navigate(target.name)
        }
      },
    })
  ).current

  const bubbleW = tabW - PAD * 2
  const bubbleH = TAB_H - PAD * 2
  const bubbleR = bubbleH / 2

  const translateX =
    tabW > 0
      ? slideAnim.interpolate({
          inputRange:  routes.map((_, i) => i),
          outputRange: routes.map((_, i) => i * tabW + PAD),
        })
      : slideAnim

  return (
    <View
      style={[styles.wrap, { bottom: TAB_BOT + insets.bottom }]}
      onLayout={e => setBarW(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      {/* ── Frosted glass bar ── */}
      <View style={[StyleSheet.absoluteFill, styles.barClip]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.barBorder]} />
      </View>

      {/* ── Sliding glass bubble ── */}
      {bubbleW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            { width: bubbleW, height: bubbleH, borderRadius: bubbleR,
              transform: [{ translateX }] },
          ]}
        >
          <View style={[StyleSheet.absoluteFill, { borderRadius: bubbleR, overflow: 'hidden' }]}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.52)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={[StyleSheet.absoluteFill, { borderRadius: bubbleR,
            borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)' }]} />
        </Animated.View>
      )}

      {/* ── Tab buttons ── */}
      {routes.map(route => {
        const cfg      = TAB_CFG.find(c => c.name === route.name)!
        const isFocused = route.key === state.routes[state.index]?.key

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabBtn}
            onPress={() => {
              const ev = navigation.emit({
                type: 'tabPress', target: route.key, canPreventDefault: true,
              })
              if (!isFocused && !ev.defaultPrevented) navigation.navigate(route.name)
            }}
            activeOpacity={1}
          >
            {cfg.isAdd ? (
              <View style={[styles.addCircle, isFocused && styles.addCircleFocused]}>
                <Ionicons name="add" size={26} color="#000" />
              </View>
            ) : (
              <Ionicons
                name={cfg.icon}
                size={22}
                color={isFocused ? '#111' : 'rgba(255,255,255,0.55)'}
              />
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AppLayout() {
  return (
    <Tabs
      tabBar={props => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneContainerStyle: { paddingBottom: TAB_H + TAB_BOT },
      }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
    </Tabs>
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
  barClip: {
    borderRadius: TAB_R,
    overflow: 'hidden',
  },
  barBorder: {
    borderRadius: TAB_R,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  bubble: {
    position: 'absolute',
    top: PAD,
  },
  tabBtn: {
    flex: 1,
    height: TAB_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  addCircleFocused: {
    shadowOpacity: 0.85,
    shadowRadius: 18,
  },
})
