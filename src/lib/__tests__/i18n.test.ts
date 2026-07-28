import AsyncStorage from '@react-native-async-storage/async-storage'
import { t, setLanguage, getLanguage, loadLanguage, dateLocale } from '../i18n'

jest.mock('@/lib/i18n/en', () => ({
  EN: {
    'Hej': 'Hello',
    'Dag {n} av 75': 'Day {n} of 75',
  },
}))

afterEach(() => {
  setLanguage('sv')
})

describe('i18n', () => {
  it('svenska är standard och returnerar texten orörd', () => {
    expect(getLanguage()).toBe('sv')
    expect(t('Hej')).toBe('Hej')
    expect(dateLocale()).toBe('sv-SE')
  })

  it('engelska slår upp översättningen och sparas', () => {
    setLanguage('en')
    expect(t('Hej')).toBe('Hello')
    expect(dateLocale()).toBe('en-GB')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('appLanguage', 'en')
  })

  it('saknad översättning faller tillbaka på svenskan, aldrig tomt', () => {
    setLanguage('en')
    expect(t('Text utan översättning')).toBe('Text utan översättning')
  })

  it('platshållare ersätts på båda språken', () => {
    expect(t('Dag {n} av 75', { n: 42 })).toBe('Dag 42 av 75')
    setLanguage('en')
    expect(t('Dag {n} av 75', { n: 42 })).toBe('Day 42 of 75')
  })

  it('sparat språk läses in vid start', async () => {
    await AsyncStorage.setItem('appLanguage', 'en')
    expect(await loadLanguage()).toBe('en')
    expect(t('Hej')).toBe('Hello')
  })
})
