import { splitName, combineName } from '../profileName'

describe('splitName / combineName', () => {
  it('delar på första mellanslaget', () => {
    expect(splitName('Erik Larsson')).toEqual({ first: 'Erik', last: 'Larsson' })
    expect(splitName('Anna Maria Berg')).toEqual({ first: 'Anna', last: 'Maria Berg' })
  })
  it('hanterar enkla och tomma namn', () => {
    expect(splitName('Erik')).toEqual({ first: 'Erik', last: '' })
    expect(splitName('')).toEqual({ first: '', last: '' })
    expect(splitName(null)).toEqual({ first: '', last: '' })
    expect(splitName('  Erik   Larsson  ')).toEqual({ first: 'Erik', last: 'Larsson' })
  })
  it('rundtrippar', () => {
    for (const n of ['Erik Larsson', 'Anna Maria Berg', 'Cher']) {
      const { first, last } = splitName(n)
      expect(combineName(first, last)).toBe(n)
    }
  })
  it('kombinerar utan hängande mellanslag', () => {
    expect(combineName('Erik', '')).toBe('Erik')
    expect(combineName('', 'Larsson')).toBe('Larsson')
    expect(combineName(' Erik ', ' Larsson ')).toBe('Erik Larsson')
  })
})
