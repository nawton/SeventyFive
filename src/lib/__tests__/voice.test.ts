import { Linking } from 'react-native'
import * as Speech from 'expo-speech'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CoachVoice } from '../voice'

jest.mock('expo-speech', () => ({
  getAvailableVoicesAsync: jest.fn(),
  speak: jest.fn(),
  stop: jest.fn(),
}))
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

// Modulen cachar röstlistan — ladda om den per test så cachen börjar tom
type VoiceModule = typeof import('../voice')
function loadVoice(): VoiceModule {
  let mod: VoiceModule
  jest.isolateModules(() => { mod = require('../voice') })
  return mod!
}

const VOICES = [
  { identifier: 'sv-alva-compact', name: 'Alva', language: 'sv-SE', quality: 'Default' },
  { identifier: 'sv-alva-premium', name: 'Alva (Premium)', language: 'sv-SE', quality: 'Default' },
  { identifier: 'sv-klara-enhanced', name: 'Klara', language: 'sv-SE', quality: 'Enhanced' },
  { identifier: 'en-sam', name: 'Samantha', language: 'en-US', quality: 'Enhanced' },
]

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  ;(Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue(VOICES)
})

describe('namn- och kvalitetsetiketter', () => {
  const voice = (over: Partial<CoachVoice>): CoachVoice =>
    ({ identifier: 'id', name: 'Alva', quality: 'Default', ...over })

  it('kvalitetssuffixet lyfts ur namnet och blir egen etikett', () => {
    const { voiceDisplayName, voiceQualityLabel } = loadVoice()
    expect(voiceDisplayName(voice({ name: 'Alva (Premium)' }))).toBe('Alva')
    expect(voiceDisplayName(voice({ name: 'Klara (Förbättrad) ' }))).toBe('Klara')
    expect(voiceQualityLabel(voice({ name: 'Alva (Premium)' }))).toBe('Premium')
    expect(voiceQualityLabel(voice({ quality: 'Enhanced' }))).toBe('Förbättrad')
    expect(voiceQualityLabel(voice({}))).toBe('Standard')
  })
})

describe('getSwedishVoices', () => {
  it('filtrerar till svenska, sorterar premium först och cachar svaret', async () => {
    const { getSwedishVoices } = loadVoice()
    const voices = await getSwedishVoices()
    expect(voices.map(v => v.identifier)).toEqual([
      'sv-alva-premium', 'sv-klara-enhanced', 'sv-alva-compact',
    ])
    await getSwedishVoices()
    expect(Speech.getAvailableVoicesAsync).toHaveBeenCalledTimes(1)
  })

  it('tom lista när rösterna inte går att hämta', async () => {
    ;(Speech.getAvailableVoicesAsync as jest.Mock).mockRejectedValue(new Error('nere'))
    const { getSwedishVoices } = loadVoice()
    expect(await getSwedishVoices()).toEqual([])
  })
})

describe('getCoachVoiceId', () => {
  it('användarens sparade val vinner över automatiken', async () => {
    await AsyncStorage.setItem('coachVoiceId', 'sv-alva-compact')
    const { getCoachVoiceId } = loadVoice()
    expect(await getCoachVoiceId()).toBe('sv-alva-compact')
    expect(Speech.getAvailableVoicesAsync).not.toHaveBeenCalled()
  })

  it('utan sparat val väljs bästa tillgängliga svenska rösten', async () => {
    const { getCoachVoiceId } = loadVoice()
    expect(await getCoachVoiceId()).toBe('sv-alva-premium')
  })

  it('null när inga svenska röster finns', async () => {
    ;(Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValue([VOICES[3]])
    const { getCoachVoiceId } = loadVoice()
    expect(await getCoachVoiceId()).toBeNull()
  })

  it('setCoachVoiceId sparar valet', async () => {
    const { setCoachVoiceId } = loadVoice()
    setCoachVoiceId('sv-klara-enhanced')
    await new Promise(r => setTimeout(r, 0))
    expect(await AsyncStorage.getItem('coachVoiceId')).toBe('sv-klara-enhanced')
  })
})

describe('previewVoice', () => {
  it('stoppar pågående tal och läser provmeningen med vald röst', () => {
    const { previewVoice } = loadVoice()
    previewVoice('sv-alva-premium')
    expect(Speech.stop).toHaveBeenCalled()
    expect(Speech.speak).toHaveBeenCalledWith(expect.stringContaining('kilometer'), {
      language: 'sv-SE',
      voice: 'sv-alva-premium',
    })
  })
})

describe('openVoiceSettings', () => {
  it('siktar på Hjälpmedel och faller tillbaka steg för steg', async () => {
    const openURL = jest.spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('privat schema'))
      .mockRejectedValueOnce(new Error('privat schema'))
      .mockResolvedValueOnce(true)
    const { openVoiceSettings } = loadVoice()
    openVoiceSettings()
    await new Promise(r => setTimeout(r, 0))
    expect(openURL.mock.calls.map(c => c[0])).toEqual([
      'App-Prefs:root=ACCESSIBILITY', 'App-Prefs:', 'app-settings:',
    ])
  })
})
