import { View, Text, StyleSheet } from 'react-native'

export default function AddScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Lägg till</Text>
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
