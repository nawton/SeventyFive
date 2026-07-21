import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getUnitSystem,
  setUnitSystem,
  toDisplayDistance,
  fromDisplayDistance,
  distanceUnitLabel,
  paceForUnit,
  KM_PER_MILE,
} from '../units'

beforeEach(() => AsyncStorage.clear())

describe('distanskonvertering', () => {
  it('metric är identitet', () => {
    expect(toDisplayDistance(10, 'metric')).toBe(10)
    expect(fromDisplayDistance(10, 'metric')).toBe(10)
  })
  it('imperial konverterar km ↔ miles', () => {
    expect(toDisplayDistance(KM_PER_MILE, 'imperial')).toBeCloseTo(1)
    expect(fromDisplayDistance(1, 'imperial')).toBeCloseTo(1.60934)
  })
  it('fram och tillbaka landar på samma värde', () => {
    expect(fromDisplayDistance(toDisplayDistance(7.3, 'imperial'), 'imperial')).toBeCloseTo(7.3)
  })
})

describe('tempo och etiketter', () => {
  it('tempo per mile är långsammare i sekunder räknat', () => {
    expect(paceForUnit(300, 'metric')).toBe(300)
    expect(paceForUnit(300, 'imperial')).toBeCloseTo(482.8, 1) // 5:00/km ≈ 8:03/mi
  })
  it('enhetsetiketter', () => {
    expect(distanceUnitLabel('metric')).toBe('km')
    expect(distanceUnitLabel('imperial')).toBe('mi')
  })
})

describe('lagring av enhetsval', () => {
  it('defaultar till metric', async () => {
    expect(await getUnitSystem()).toBe('metric')
  })
  it('sparar och läser tillbaka valet', async () => {
    await setUnitSystem('imperial')
    expect(await getUnitSystem()).toBe('imperial')
    await setUnitSystem('metric')
    expect(await getUnitSystem()).toBe('metric')
  })
  it('skräp i lagringen faller tillbaka på metric', async () => {
    await AsyncStorage.setItem('unitSystem', 'banankontakt')
    expect(await getUnitSystem()).toBe('metric')
  })
})
