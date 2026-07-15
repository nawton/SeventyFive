import { getGreetingSubtitle } from '../getGreetingSubtitle'

// Run with: npx jest src/lib/__tests__/getGreetingSubtitle.test.ts
// (requires jest + ts-jest: npm i -D jest @types/jest ts-jest)

describe('getGreetingSubtitle', () => {
  describe('all done', () => {
    it('returns completion message regardless of hour', () => {
      expect(getGreetingSubtitle(9,  5, 5, 3)).toBe('Dag 3 i hamn. Vi ses imorgon.')
      expect(getGreetingSubtitle(22, 5, 5, 3)).toBe('Dag 3 i hamn. Vi ses imorgon.')
    })
  })

  describe('morning (05–12)', () => {
    it('returns motivational start when nothing done', () => {
      expect(getGreetingSubtitle(8, 0, 5, 1)).toBe('Ny dag, nytt blad. Börja med vattnet?')
    })
    it('shows remaining count when some done', () => {
      expect(getGreetingSubtitle(10, 3, 5, 2)).toBe('Bra start! 2 uppgifter kvar.')
    })
    it('shows single remaining', () => {
      expect(getGreetingSubtitle(11, 4, 5, 2)).toBe('En uppgift kvar — du är nästan i mål.')
    })
  })

  describe('afternoon (12–17)', () => {
    it('urges start when nothing done', () => {
      expect(getGreetingSubtitle(14, 0, 5, 5)).toBe('Eftermiddag och inget loggat än — kom igång nu.')
    })
    it('shows single remaining', () => {
      expect(getGreetingSubtitle(15, 4, 5, 5)).toBe('En uppgift kvar — du fixar den.')
    })
    it('shows count when multiple remaining', () => {
      expect(getGreetingSubtitle(16, 2, 5, 5)).toBe('3 uppgifter kvar — håll farten.')
    })
  })

  describe('evening (17–21)', () => {
    it('urges start when nothing done', () => {
      expect(getGreetingSubtitle(19, 0, 5, 10)).toBe('Kväll och inget klart ännu — nu kör vi.')
    })
    it('shows single remaining', () => {
      expect(getGreetingSubtitle(20, 4, 5, 10)).toBe('En uppgift kvar — spurta hem.')
    })
    it('shows count when multiple remaining', () => {
      expect(getGreetingSubtitle(18, 1, 5, 10)).toBe('4 uppgifter kvar — kom igen.')
    })
  })

  describe('night (21–05)', () => {
    it('shows single remaining at night', () => {
      expect(getGreetingSubtitle(23, 4, 5, 7)).toBe('En uppgift kvar — sista chansen.')
    })
    it('shows multiple remaining at night', () => {
      expect(getGreetingSubtitle(22, 2, 5, 7)).toBe('3 uppgifter kvar — sista chansen idag.')
    })
    it('works for early morning before 5', () => {
      expect(getGreetingSubtitle(3, 0, 5, 7)).toBe('5 uppgifter kvar — sista chansen idag.')
    })
  })
})
