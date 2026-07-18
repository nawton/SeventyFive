import { isLiquidGlassAvailable } from 'expo-glass-effect'

export const LIQUID_GLASS = isLiquidGlassAvailable()

// Tabbaren är en flytande pill (Instagram-stil) som ligger absolut ovanpå
// innehållet — flikskärmarnas scroll behöver bottenluft så sista raden
// kan scrollas fram ovanför pillen (64 hög + 28 från botten + marginal).
export const TAB_CONTENT_PAD = 108
