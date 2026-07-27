import AsyncStorage from '@react-native-async-storage/async-storage'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { getRouteColorKey, setRouteColorKey, useRouteColor, ROUTE_COLORS } from '../routeColor'

// OBS: modulen har delat tillstånd (current/loaded) — testordningen är medveten:
// läsningarna först, sedan hooken som laddar, sist liveuppdateringarna.

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('getRouteColorKey', () => {
  it('blå som standard, sparade giltiga val gäller, okända faller tillbaka', async () => {
    expect(await getRouteColorKey()).toBe('blue')

    await AsyncStorage.setItem('routeColor', 'green')
    expect(await getRouteColorKey()).toBe('green')

    await AsyncStorage.setItem('routeColor', 'rosa')
    expect(await getRouteColorKey()).toBe('blue')
  })

  it('lagringsfel ger blå istället för krasch', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'))
    expect(await getRouteColorKey()).toBe('blue')
  })
})

describe('useRouteColor', () => {
  it('laddar det sparade valet vid första monteringen', async () => {
    await AsyncStorage.setItem('routeColor', 'red')
    const { result } = renderHook(() => useRouteColor())
    await waitFor(() => expect(result.current).toBe('#FF3B4A'))
  })

  it('alla monterade kartor byter direkt när valet ändras', async () => {
    const a = renderHook(() => useRouteColor())
    const b = renderHook(() => useRouteColor())

    act(() => setRouteColorKey('purple'))
    expect(a.result.current).toBe('#B45CFF')
    expect(b.result.current).toBe('#B45CFF')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('routeColor', 'purple')

    // Avmonterade kartor slutar lyssna
    b.unmount()
    act(() => setRouteColorKey('orange'))
    expect(a.result.current).toBe('#FC4C02')
    expect(b.result.current).toBe('#B45CFF')
  })

  it('skrivfel mot lagringen sväljs, färgen byts ändå', async () => {
    ;(AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk'))
    const { result } = renderHook(() => useRouteColor())
    act(() => setRouteColorKey('green'))
    expect(result.current).toBe('#2EBF6B')
    await act(async () => {})   // låt det avvisade löftet hanteras
  })
})

describe('paletten', () => {
  it('fem färger med unika nycklar och giltiga hexvärden', () => {
    expect(ROUTE_COLORS).toHaveLength(5)
    expect(new Set(ROUTE_COLORS.map(c => c.key)).size).toBe(5)
    for (const c of ROUTE_COLORS) {
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/i)
      expect(c.label.length).toBeGreaterThan(1)
    }
  })
})
