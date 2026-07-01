import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const ORANGE   = '#FF8F00'
const TAB_BG   = '#1C1C1E'
const INACTIVE = '#555555'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({ name, color }: { name: IoniconName; color: string }) {
  return <Ionicons name={name} size={24} color={color} />
}

function SchemaIcon({ color }: { color: string }) {
  return (
    <View style={styles.addButton}>
      <Ionicons name="barbell-outline" size={24} color="#000000" />
    </View>
  )
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ tabBarIcon: ({ color }) => <TabIcon name="body" color={color} /> }}
      />
      <Tabs.Screen
        name="add"
        options={{ tabBarIcon: ({ color }) => <SchemaIcon color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ tabBarIcon: ({ color }) => <TabIcon name="bar-chart" color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarIcon: ({ color }) => <TabIcon name="person-outline" color={color} /> }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{ href: null }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: TAB_BG,
    borderTopWidth: 0,
    height: 80,
    paddingBottom: 20,
    paddingTop: 12,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
})
