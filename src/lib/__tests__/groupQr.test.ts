import { groupQrValue, parseGroupQr } from '../groupQr'

const ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

describe('groupQr', () => {
  it('rundtur: värdet vi genererar går att parsa tillbaka', () => {
    expect(parseGroupQr(groupQrValue(ID))).toBe(ID)
  })

  it('versaler i koden normaliseras till gemener', () => {
    expect(parseGroupQr(`seventyfive://group?groupId=${ID.toUpperCase()}`)).toBe(ID)
  })

  it('främmande koder ger null', () => {
    expect(parseGroupQr('https://example.com')).toBeNull()
    expect(parseGroupQr('seventyfive://group?groupId=inte-ett-uuid')).toBeNull()
    expect(parseGroupQr('')).toBeNull()
  })
})
