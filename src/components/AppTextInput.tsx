import { forwardRef } from 'react'
import { StyleSheet, TextInput, useColorScheme, type TextInputProps } from 'react-native'
import { useThemeStrings } from '@/lib/theme'

// =============================================================================
// TextInput som tål temaväxling. RN applicerar inte dynamiska färgobjekt
// (DynamicColorIOS) pålitligt på inmatningstext — i ljust läge ritades
// texten i mörka lägets vita på vita fält. Här ersätts en dynamisk/saknad
// textfärg med temats råa sträng; uttryckliga strängfärger respekteras.
// =============================================================================

export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput(props, ref) {
  const T = useThemeStrings()
  const light = useColorScheme() === 'light'
  const flat = StyleSheet.flatten(props.style) ?? {}
  const color = typeof flat.color === 'string' ? flat.color : T.TEXT_PRIMARY
  const placeholder = props.placeholderTextColor
    ?? (light ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.28)')
  return (
    <TextInput
      ref={ref}
      {...props}
      placeholderTextColor={placeholder}
      style={[props.style, { color }]}
    />
  )
})
