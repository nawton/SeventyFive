import * as Speech from 'expo-speech'
import AsyncStorage from '@react-native-async-storage/async-storage'

// =============================================================================
// Coachrösten. iOS standardröst är kompaktvarianten (robotig) — här listas
// alla svenska röster med de förbättrade först, och bästa tillgängliga
// väljs automatiskt tills användaren valt själv i röstguidningen.
// Ännu mjukare röster (t.ex. Alva Förbättrad/Premium) laddas ner i iOS:
// Inställningar → Hjälpmedel → Uppläst innehåll → Röster → Svenska.
// =============================================================================

export interface CoachVoice {
  identifier: string
  name: string
  /** 'Enhanced' = förbättrad, allt annat behandlas som standard */
  quality: string
}

let cached: CoachVoice[] | null = null

export async function getSwedishVoices(): Promise<CoachVoice[]> {
  if (cached) return cached
  try {
    const all = await Speech.getAvailableVoicesAsync()
    cached = all
      .filter(v => (v.language ?? '').toLowerCase().startsWith('sv'))
      .map(v => ({ identifier: v.identifier, name: v.name, quality: String(v.quality ?? 'Default') }))
      .sort((a, b) =>
        Number(b.quality === 'Enhanced') - Number(a.quality === 'Enhanced')
        || a.name.localeCompare(b.name, 'sv'))
  } catch {
    cached = []
  }
  return cached
}

const KEY = 'coachVoiceId'

/** Sparat val, annars bästa tillgängliga (förbättrad före standard) */
export async function getCoachVoiceId(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY)
    if (v) return v
  } catch { /* fall vidare till auto */ }
  const voices = await getSwedishVoices()
  return voices[0]?.identifier ?? null
}

export function setCoachVoiceId(id: string): void {
  AsyncStorage.setItem(KEY, id).catch(() => {})
}

export function previewVoice(id: string): void {
  Speech.stop()
  Speech.speak('Så här låter jag. En kilometer avklarad — håll tempot!', {
    language: 'sv-SE',
    voice: id,
  })
}
