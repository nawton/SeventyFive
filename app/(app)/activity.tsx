import { View, Text, StyleSheet } from 'react-native'

export default function ActivityScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Aktivitet</Text>
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
