import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { GlassView } from 'expo-glass-effect'
import { LIQUID_GLASS } from '@/lib/glass'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

// Instagram-stil: flytande glaspill med en ljus bubbla bakom aktiv flik.
// Aktiv ikon = fylld variant i vitt, inaktiv = outline i dämpat vitt.
function TabBubble({ icon, iconActive, focused }: {
  icon: IoniconName
  iconActive: IoniconName
  focused: boolean
}) {
  return (
    <View style={[styles.bubble, focused && styles.bubbleActive]}>
      <Ionicons
        name={focused ? iconActive : icon}
        size={24}
        color={focused ? '#fff' : 'rgba(255,255,255,0.55)'}
      />
    </View>
  )
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: styles.tabItem,
        tabBarBackground: () =>
          LIQUID_GLASS ? (
            // Äkta liquid glass — innehållet scrollar bakom och bryts i pillen
            <GlassView glassEffectStyle="regular" style={styles.barBg} />
          ) : (
            <View style={[styles.barBg, styles.barBgFallback]} />
          ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarIcon: ({ focused }) => <TabBubble icon="home-outline" iconActive="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="add"
        options={{ tabBarIcon: ({ focused }) => <TabBubble icon="barbell-outline" iconActive="barbell" focused={focused} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ tabBarIcon: ({ focused }) => <TabBubble icon="bar-chart-outline" iconActive="bar-chart" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabBubble icon="person-outline" iconActive="person" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="manage-sessions"
        options={{ href: null }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  // Flytande pill à la Instagram
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
    height: 64,
    borderRadius: 32,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    elevation: 0,
    overflow: 'hidden',
  },
  tabItem: {
    height: 64,
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
    width: 62,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
})
