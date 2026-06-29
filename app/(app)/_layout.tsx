import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ORANGE = '#FF8F00'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_H      = 64
const TAB_RADIUS = 32
const TAB_MARGIN = 20
const TAB_BOTTOM = 16

// ── Glass bar background ──────────────────────────────────────────────────────

function GlassBar() {
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: TAB_RADIUS, overflow: 'hidden' }]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.07)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassBarBorder} />
    </View>
  )
}

// ── Tab icon with active glass bubble ─────────────────────────────────────────

function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      {focused && (
        <View style={[StyleSheet.absoluteFill, { borderRadius: 20, overflow: 'hidden' }]}>
          <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.45)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.bubbleBorder} />
        </View>
      )}
      <Ionicons
        name={name}
        size={22}
        color={focused ? '#111' : 'rgba(255,255,255,0.6)'}
      />
    </View>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => <GlassBar />,
        sceneContainerStyle: { paddingBottom: TAB_H + TAB_BOTTOM },
        tabBarStyle: {
          position: 'absolute',
          bottom: TAB_BOTTOM + insets.bottom,
          left: TAB_MARGIN,
          right: TAB_MARGIN,
          height: TAB_H,
          borderRadius: TAB_RADIUS,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="body" focused={focused} /> }}
      />
      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.addBtn, focused && styles.addBtnFocused]}>
              <Ionicons name="add" size={28} color="#000" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="bar-chart" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="person-outline" focused={focused} /> }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{ href: null }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  glassBarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  iconWrap: {
    width: 54,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  addBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  addBtnFocused: {
    shadowOpacity: 0.8,
    shadowRadius: 18,
  },
})
