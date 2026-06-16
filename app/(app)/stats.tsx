import { View, Text, StyleSheet } from 'react-native'

export default function StatsScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Statistik</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 20,
  },
})
