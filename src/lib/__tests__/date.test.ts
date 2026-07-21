import { toLocalDateString, parseLocalDate, weekdayOf, startOfWeek, isoWeekNum } from '../date'
import { indexToDate, dateToIndex, CENTER_IDX } from '../scheduleDates'

describe('toLocalDateString / parseLocalDate', () => {
  it('formaterar lokala datum med nollutfyllnad', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toLocalDateString(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
  it('parsar som LOKAL midnatt — inte UTC', () => {
    const d = parseLocalDate('2026-07-20')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(20)
    expect(d.getHours()).toBe(0)
  })
  it('round-trippar', () => {
    expect(toLocalDateString(parseLocalDate('2026-02-28'))).toBe('2026-02-28')
  })
})

describe('weekdayOf / startOfWeek', () => {
  it('ISO-veckodagar: måndag 1, söndag 7', () => {
    expect(weekdayOf(new Date(2026, 6, 20))).toBe(1) // mån 20 jul 2026
    expect(weekdayOf(new Date(2026, 6, 19))).toBe(7) // sön 19 jul 2026
  })
  it('veckan startar på måndag midnatt', () => {
    const wed = new Date(2026, 6, 22, 15, 30)
    const mon = startOfWeek(wed)
    expect(toLocalDateString(mon)).toBe('2026-07-20')
    expect(mon.getHours()).toBe(0)
  })
  it('en söndag hör till veckan som började sex dagar tidigare', () => {
    expect(toLocalDateString(startOfWeek(new Date(2026, 6, 26)))).toBe('2026-07-20')
  })
})

describe('isoWeekNum', () => {
  it('mitt i året', () => {
    expect(isoWeekNum(new Date(2026, 6, 20))).toBe(30) // mån 20 jul 2026 = v30
  })
  it('årsskiften: torsdagen avgör veckans ISO-år', () => {
    // 2026 börjar på en torsdag → v1 2026 är 29 dec 2025–4 jan 2026
    expect(isoWeekNum(new Date(2025, 11, 29))).toBe(1)
    expect(isoWeekNum(new Date(2026, 0, 5))).toBe(2)
    // 2026 har 53 ISO-veckor — 28 dec 2026 är v53, inte v1
    expect(isoWeekNum(new Date(2026, 11, 28))).toBe(53)
    // 2025: 30 dec 2024–5 jan 2025 är v1
    expect(isoWeekNum(new Date(2024, 11, 30))).toBe(1)
  })
})

describe('scheduleDates pager', () => {
  it('mittenindexet är idag', () => {
    expect(toLocalDateString(indexToDate(CENTER_IDX))).toBe(toLocalDateString(new Date()))
  })
  it('index ↔ datum round-trippar över hela spannet', () => {
    for (const i of [0, 100, CENTER_IDX, 250, 364]) {
      expect(dateToIndex(indexToDate(i))).toBe(i)
    }
  })
  it('imorgon är ett steg åt höger', () => {
    // Midnatt, som kalendern alltid skickar — new Date() med klockslag skulle
    // göra testet tidsberoende (rundas till 2 dagar efter lunch)
    const tomorrow = new Date()
    tomorrow.setHours(0, 0, 0, 0)
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(dateToIndex(tomorrow)).toBe(CENTER_IDX + 1)
  })
})
