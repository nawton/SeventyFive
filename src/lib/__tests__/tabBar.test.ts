import { renderHook } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  tabBarShrink, getTabBarShrinkEnabled, setTabBarShrinkEnabled, useTabBarShrinkOnScroll,
} from '../tabBar'

jest.mock('react-native-reanimated', () => ({
  makeMutable: <T,>(v: T) => ({ value: v }),
  withTiming: <T,>(v: T) => v,
}))
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

const scrollEvent = (y: number) =>
  ({ nativeEvent: { contentOffset: { y } } }) as never

beforeEach(async () => {
  await AsyncStorage.clear()
  setTabBarShrinkEnabled(false)
  tabBarShrink.value = 0
})

describe('inställningen', () => {
  it('är avstängd som standard och kommer ihåg påslag', async () => {
    expect(await getTabBarShrinkEnabled()).toBe(false)
    setTabBarShrinkEnabled(true)
    expect(await AsyncStorage.getItem('tabBarShrinkEnabled')).toBe('1')
    expect(await getTabBarShrinkEnabled()).toBe(true)
  })

  it('avstängning återställer pillen till full storlek', () => {
    setTabBarShrinkEnabled(true)
    tabBarShrink.value = 1
    setTabBarShrinkEnabled(false)
    expect(tabBarShrink.value).toBe(0)
  })
})

describe('useTabBarShrinkOnScroll', () => {
  it('gör ingenting när funktionen är avstängd', () => {
    const { result } = renderHook(() => useTabBarShrinkOnScroll())
    result.current(scrollEvent(50))
    result.current(scrollEvent(300))
    expect(tabBarShrink.value).toBe(0)
  })

  it('krymper vid scroll ner, växer vid scroll upp och alltid vid toppen', () => {
    setTabBarShrinkEnabled(true)
    const { result } = renderHook(() => useTabBarShrinkOnScroll())

    result.current(scrollEvent(100))   // första positionen
    result.current(scrollEvent(160))   // ner (+60) → krymp
    expect(tabBarShrink.value).toBe(1)

    result.current(scrollEvent(120))   // upp (-40) → full storlek
    expect(tabBarShrink.value).toBe(0)

    result.current(scrollEvent(140))   // ner igen → krymp
    expect(tabBarShrink.value).toBe(1)

    result.current(scrollEvent(10))    // nära toppen → alltid full storlek
    expect(tabBarShrink.value).toBe(0)
  })

  it('småryck under tröskeln ändrar ingenting', () => {
    setTabBarShrinkEnabled(true)
    const { result } = renderHook(() => useTabBarShrinkOnScroll())
    result.current(scrollEvent(100))   // ner → krymp
    result.current(scrollEvent(60))    // upp → full storlek
    expect(tabBarShrink.value).toBe(0)
    result.current(scrollEvent(62))    // +2, under tröskeln → oförändrat
    expect(tabBarShrink.value).toBe(0)
  })
})
