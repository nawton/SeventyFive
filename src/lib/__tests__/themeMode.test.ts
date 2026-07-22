import { Appearance } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getThemeMode, setThemeMode, applyStoredTheme } from '../themeMode'

describe('themeMode', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.restoreAllMocks()
  })

  it('mörkt är standard när inget är sparat', async () => {
    expect(await getThemeMode()).toBe('dark')
  })

  it('ljust läge sparas och appliceras direkt', async () => {
    const spy = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {})
    setThemeMode('light')
    expect(spy).toHaveBeenCalledWith('light')
    await new Promise(r => setTimeout(r, 0))
    expect(await getThemeMode()).toBe('light')
  })

  it('appstart: mörkt först, sedan det sparade ljusa valet', async () => {
    await AsyncStorage.setItem('themeMode', 'light')
    const spy = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {})
    applyStoredTheme()
    expect(spy).toHaveBeenNthCalledWith(1, 'dark')
    await new Promise(r => setTimeout(r, 0))
    expect(spy).toHaveBeenNthCalledWith(2, 'light')
  })

  it('trasigt lagrat värde faller tillbaka till mörkt', async () => {
    await AsyncStorage.setItem('themeMode', 'banana')
    expect(await getThemeMode()).toBe('dark')
  })
})
