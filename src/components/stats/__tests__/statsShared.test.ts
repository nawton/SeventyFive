import { getWeekBounds, nextMilestone, monthLabel, sessDateLabel } from '../statsShared'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() } } }))

describe('statsShared', () => {
  it('getWeekBounds: måndag till söndag, denna vecka etiketteras särskilt', () => {
    const now = getWeekBounds(0)
    expect(now.label).toBe('Denna vecka')
    expect(now.start <= now.end).toBe(true)
    // start är alltid en måndag och spannet är exakt sju dagar
    const start = new Date(now.start + 'T12:00:00')
    expect(start.getDay()).toBe(1)
    const diff = (new Date(now.end + 'T12:00:00').getTime() - start.getTime()) / 86_400_000
    expect(diff).toBe(6)

    const prev = getWeekBounds(-1)
    expect(prev.end < now.start).toBe(true)
    expect(prev.label).toContain('till')
  })

  it('nextMilestone: närmaste stenen framåt, null efter 75', () => {
    expect(nextMilestone(0)?.day).toBe(7)
    expect(nextMilestone(0)?.daysLeft).toBe(7)
    expect(nextMilestone(7)?.day).toBe(10)
    expect(nextMilestone(37)?.day).toBe(38)
    expect(nextMilestone(38)?.daysLeft).toBeGreaterThan(0)
    expect(nextMilestone(75)).toBeNull()
  })

  it('datumetiketterna formateras på valt språk', () => {
    expect(monthLabel('2026-07-15')).toMatch(/juli/i)
    expect(sessDateLabel('2026-07-15')).toMatch(/15/)
  })
})
