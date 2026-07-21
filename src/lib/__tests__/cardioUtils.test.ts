import {
  nameToType,
  cardinalLabel,
  formatTime,
  spokenTime,
  formatPace,
  haversineDistance,
} from '../cardioUtils'

describe('nameToType', () => {
  it('känner igen aktiviteter på svenska och engelska, oavsett skiftläge', () => {
    expect(nameToType('Cykling')).toBe('cycling')
    expect(nameToType('kvällens cykeltur')).toBe('cycling')
    expect(nameToType('Intervaller 3')).toBe('interval')
    expect(nameToType('INTERVAL')).toBe('interval')
    expect(nameToType('Promenad')).toBe('walking')
    expect(nameToType('Power Walk')).toBe('walking')
  })
  it('allt annat blir löpning', () => {
    expect(nameToType('Löpning')).toBe('running')
    expect(nameToType('Tempopass')).toBe('running')
    expect(nameToType('')).toBe('running')
  })
})

describe('cardinalLabel', () => {
  it('mappar grader till väderstreck', () => {
    expect(cardinalLabel(0)).toBe('N')
    expect(cardinalLabel(90)).toBe('Ö')
    expect(cardinalLabel(180)).toBe('S')
    expect(cardinalLabel(270)).toBe('V')
    expect(cardinalLabel(45)).toBe('NÖ')
    expect(cardinalLabel(225)).toBe('SV')
  })
  it('rundar till närmaste väderstreck och wrappar runt norr', () => {
    expect(cardinalLabel(30)).toBe('NÖ')   // närmare 45 än 0
    expect(cardinalLabel(350)).toBe('N')   // wrap: 350° ≈ norr
    expect(cardinalLabel(337)).toBe('NV')
  })
})

describe('formatTime', () => {
  it('formaterar HH:MM:SS med nollutfyllnad', () => {
    expect(formatTime(0)).toBe('00:00:00')
    expect(formatTime(59)).toBe('00:00:59')
    expect(formatTime(60)).toBe('00:01:00')
    expect(formatTime(3661)).toBe('01:01:01')
    expect(formatTime(35999)).toBe('09:59:59')
  })
})

describe('spokenTime', () => {
  it('säger tiden naturligt med singular/plural', () => {
    expect(spokenTime(0)).toBe('0 sekunder')
    expect(spokenTime(30)).toBe('30 sekunder')
    expect(spokenTime(60)).toBe('1 minut')
    expect(spokenTime(120)).toBe('2 minuter')
    expect(spokenTime(90)).toBe('1 minut och 30 sekunder')
    expect(spokenTime(3600)).toBe('1 timme')
    expect(spokenTime(7200)).toBe('2 timmar')
    expect(spokenTime(3725)).toBe('1 timme och 2 minuter och 5 sekunder')
  })
  it('utelämnar nolldelar i mitten', () => {
    expect(spokenTime(3605)).toBe('1 timme och 5 sekunder')
    expect(spokenTime(3660)).toBe('1 timme och 1 minut')
  })
})

describe('formatPace', () => {
  it('räknar min/km ur distans + tid', () => {
    expect(formatPace(5, 1500)).toBe('5:00')   // 25 min på 5 km
    expect(formatPace(10, 3599)).toBe('5:59')
    expect(formatPace(2, 750)).toBe('6:15')
  })
  it('visar platshållare innan man rört sig', () => {
    expect(formatPace(0, 100)).toBe('--:--')
    expect(formatPace(0.005, 100)).toBe('--:--')
  })
})

describe('haversineDistance', () => {
  it('samma punkt är noll', () => {
    const p = { latitude: 59.3293, longitude: 18.0686 }
    expect(haversineDistance(p, p)).toBe(0)
  })
  it('en breddgrad är ~111 km', () => {
    const a = { latitude: 59, longitude: 18 }
    const b = { latitude: 60, longitude: 18 }
    expect(haversineDistance(a, b)).toBeCloseTo(111.19, 0)
  })
  it('Stockholm–Göteborg är ~40 mil fågelvägen', () => {
    const sthlm = { latitude: 59.3293, longitude: 18.0686 }
    const gbg   = { latitude: 57.7089, longitude: 11.9746 }
    const d = haversineDistance(sthlm, gbg)
    expect(d).toBeGreaterThan(390)
    expect(d).toBeLessThan(405)
  })
  it('GPS-upplösning: ett vanligt steg mellan två punkter blir rimliga meter', () => {
    // ~0,0001° latitud ≈ 11 m — samma storleksordning som GPS-ticks vid löpning
    const a = { latitude: 59.32930, longitude: 18.0686 }
    const b = { latitude: 59.32940, longitude: 18.0686 }
    expect(haversineDistance(a, b) * 1000).toBeCloseTo(11.1, 0)
  })
})
