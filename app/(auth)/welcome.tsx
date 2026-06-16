import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'

export default function Welcome() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>NAWTON</Text>
      <Text style={styles.title}>SeventyFive</Text>
      <Text style={styles.subtitle}>75 dagar. En utmaning. En ny version av dig.</Text>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.buttonText}>Kom igång</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logo: {
    color: '#fff',
    fontSize: 12,
    letterSpacing: 6,
    marginBottom: 24,
    opacity: 0.5,
  },
  title: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 16,
  },
  subtitle: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 64,
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 4,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
})
