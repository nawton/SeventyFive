import { useEffect, useRef, useState } from 'react'
import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { GlassView } from 'expo-glass-effect'
import * as Haptics from 'expo-haptics'
import { LIQUID_GLASS } from '@/lib/glass'
import { tabBarShrink } from '@/lib/tabBar'
import { ORANGE } from '@/lib/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

// Flikarna i pillen — övriga rutter i mappen är dolda (href: null)
const TABS: Array<{ name: string; icon: IoniconName; iconActive: IoniconName }> = [
  { name: 'dashboard', icon: 'home-outline',      iconActive: 'home' },
  { name: 'add',       icon: 'barbell-outline',   iconActive: 'barbell' },
  { name: 'stats',     icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { name: 'profile',   icon: 'person-outline',    iconActive: 'person' },
]

const SP = { damping: 16, stiffness: 260, mass: 0.7 } as const
const BUBBLE_H = 46

// =============================================================================
// Flytande glaspill med iPhone-känsla: håll fingret på pillen och dra —
// bubblan följer fingret mellan ikonerna, ikonen under fingret blir orange,
// och fliken väljs när du släpper. Ett vanligt tryck fungerar precis som innan.
// =============================================================================

function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const activeName = state.routes[state.index]?.name
  const activeIdx  = Math.max(0, TABS.findIndex(t => t.name === activeName))
  const n = TABS.length

  const [barW, setBarW] = useState(0)
  const slotW = barW / n

  // Bubblans position i slot-enheter (0..n-1) — flyter fritt under drag
  const pos = useSharedValue(activeIdx)
  const [hotIdx, setHotIdx] = useState<number | null>(null)
  const hotRef = useRef<number | null>(null)

  useEffect(() => {
    if (hotRef.current === null) pos.value = withSpring(activeIdx, SP)
  }, [activeIdx, slotW])

  function setHot(i: number) {
    if (hotRef.current !== i) {
      hotRef.current = i
      setHotIdx(i)
      Haptics.selectionAsync()
    }
  }

  // Indexet räknas ut i själva släpp-händelsen från fingrets x-position —
  // deterministiskt oavsett om JS-tråden hunnit ikapp markeringen eller inte
  function commit(i: number) {
    hotRef.current = null
    setHotIdx(null)
    const tab = TABS[i]
    if (tab && tab.name !== activeName) navigation.navigate(tab.name as never)
  }

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => {
      if (slotW <= 0) return
      const i = Math.min(n - 1, Math.max(0, Math.floor(e.x / slotW)))
      pos.value = withSpring(i, SP)
      runOnJS(setHot)(i)
    })
    .onUpdate(e => {
      if (slotW <= 0) return
      // Bubblan centreras under fingret och glider fritt mellan platserna
      const f = Math.min(n - 1, Math.max(0, e.x / slotW - 0.5))
      pos.value = f
      runOnJS(setHot)(Math.min(n - 1, Math.max(0, Math.round(f))))
    })
    .onFinalize(e => {
      if (slotW <= 0) return
      const i = Math.min(n - 1, Math.max(0, Math.floor(e.x / slotW)))
      pos.value = withSpring(i, SP)
      runOnJS(commit)(i)
    })

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * slotW }],
  }))

  // Krymper när man scrollar ner, växer tillbaka när man scrollar upp
  const shrinkStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: tabBarShrink.value * 18 },
      { scale: 1 - tabBarShrink.value * 0.18 },
    ],
  }))

  const shownIdx = hotIdx ?? activeIdx

  return (
    <Animated.View style={[styles.wrap, shrinkStyle]} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <View style={styles.pill} onLayout={e => setBarW(e.nativeEvent.layout.width)}>
          {LIQUID_GLASS ? (
            <GlassView glassEffectStyle="regular" style={styles.barBg} />
          ) : (
            <View style={[styles.barBg, styles.barBgFallback]} />
          )}

          {barW > 0 && (
            <Animated.View
              style={[styles.bubble, { width: slotW - 14, marginLeft: 7 }, bubbleStyle]}
            />
          )}

          <View style={styles.row} pointerEvents="none">
            {TABS.map((t, i) => {
              const on = i === shownIdx
              return (
                <View key={t.name} style={styles.slot}>
                  <Ionicons
                    name={on ? t.iconActive : t.icon}
                    size={24}
                    color={on ? ORANGE : 'rgba(255,255,255,0.55)'}
                  />
                </View>
              )
            })}
          </View>
        </View>
      </GestureDetector>
    </Animated.View>
  )
}

export default function AppLayout() {
  return (
    <Tabs
      tabBar={props => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="manage-sessions" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
  },
  pill: {
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    overflow: 'hidden',
  },
  barBgFallback: {
    backgroundColor: 'rgba(22,22,24,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bubble: {
    position: 'absolute',
    height: BUBBLE_H,
    top: (64 - BUBBLE_H) / 2,
    borderRadius: BUBBLE_H / 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
  },
})
