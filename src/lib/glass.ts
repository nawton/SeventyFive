import { isLiquidGlassAvailable } from 'expo-glass-effect'

// Liquid glass (iOS 26+). När tabbaren är glas ligger den absolut ovanpå
// innehållet — flikskärmarnas scroll behöver extra bottenluft för att
// sista raden inte ska hamna bakom glaset.
export const LIQUID_GLASS = isLiquidGlassAvailable()
export const TAB_CONTENT_PAD = LIQUID_GLASS ? 96 : 0
