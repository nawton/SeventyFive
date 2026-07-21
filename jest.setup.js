// AsyncStorage saknar native-modul i testmiljön — officiella jest-mocken
// ger en fungerande in-memory-implementation
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

// ─── Komponenttester ─────────────────────────────────────────────────────────
// Native-moduler utan JS-implementation i test ersätts med officiella mockar
// eller enkla View-attrapper. Ren logik (node-tester) påverkas inte — mockarna
// aktiveras bara när modulen faktiskt importeras.

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
require('react-native-gesture-handler/jestSetup')
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  }
})

// Ikonfonterna drar in expo-font/expo-asset som saknar testimplementation —
// varje ikon renderas som texten "icon:<namn>" (går att asserta på)
jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  const Icon = ({ name }) => React.createElement(Text, null, `icon:${name}`)
  return new Proxy({}, { get: () => Icon })
})

// Liquid glass (iOS 26) — i test: vanliga vyer utan glaseffekt
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native')
  return { GlassView: View, isLiquidGlassAvailable: () => false }
})

// Glasknapparna är geststyrda (Gesture.Tap) och kan inte tryckas via
// fireEvent — i test blir de vanliga knappar med texten "glassbtn:<ikon>"
jest.mock('@/components/GlassButton', () => {
  const React = require('react')
  const { TouchableOpacity, Text } = require('react-native')
  const Btn = ({ icon, onPress, children }) =>
    React.createElement(
      TouchableOpacity,
      { onPress },
      children ?? null,
      icon ? React.createElement(Text, null, `glassbtn:${icon}`) : null,
    )
  return { GlassCircleButton: Btn, GlassPill: Btn }
})

// Apples inbyggda hjulväljare — i test: tomma vyer (värden ändras via onChange-mockar)
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native')
  return { __esModule: true, default: View }
})
jest.mock('@react-native-picker/picker', () => {
  const React = require('react')
  const { View } = require('react-native')
  const Picker = ({ children }) => React.createElement(View, null, children)
  Picker.Item = () => null
  return { Picker }
})

// Apple Maps — karta/polyline/markörer renderas som tomma vyer, och
// kamerametoderna på ref:en är no-ops så spårningsloopen kan anropa dem
jest.mock('react-native-maps', () => {
  const React = require('react')
  const { View } = require('react-native')
  const MapView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      animateCamera: () => {},
      animateToRegion: () => {},
      fitToCoordinates: () => {},
    }))
    return React.createElement(View, props, props.children)
  })
  return { __esModule: true, default: MapView, Polyline: View, Marker: View }
})
