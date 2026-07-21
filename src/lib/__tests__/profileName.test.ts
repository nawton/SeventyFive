import { splitName, combineName } from '../profileName'

describe('splitName / combineName', () => {
  it('delar på första mellanslaget', () => {
    expect(splitName('Anton Wretenberg')).toEqual({ first: 'Anton', last: 'Wretenberg' })
    expect(splitName('Anna Maria Berg')).toEqual({ first: 'Anna', last: 'Maria Berg' })
  })
  it('hanterar enkla och tomma namn', () => {
    expect(splitName('Anton')).toEqual({ first: 'Anton', last: '' })
    expect(splitName('')).toEqual({ first: '', last: '' })
    expect(splitName(null)).toEqual({ first: '', last: '' })
    expect(splitName('  Anton   Wretenberg  ')).toEqual({ first: 'Anton', last: 'Wretenberg' })
  })
  it('rundtrippar', () => {
    for (const n of ['Anton Wretenberg', 'Anna Maria Berg', 'Cher']) {
      const { first, last } = splitName(n)
      expect(combineName(first, last)).toBe(n)
    }
  })
  it('kombinerar utan hängande mellanslag', () => {
    expect(combineName('Anton', '')).toBe('Anton')
    expect(combineName('', 'Wretenberg')).toBe('Wretenberg')
    expect(combineName(' Anton ', ' Wretenberg ')).toBe('Anton Wretenberg')
  })
})
