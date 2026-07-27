import { reportContent } from '../reports'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}))

const fromMock = supabase.from as jest.Mock

function signIn(uid: string | null) {
  ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: uid ? { user: { id: uid } } : null },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  signIn('me')
})

describe('reportContent', () => {
  it('skriver anmälan med rätt kolumner: target_kind och details', async () => {
    const calls = installTables(fromMock, { reports: { data: null } })
    await reportContent('post', 'p1', '  Spam i flödet  ')
    expect(argsOf(calls, 'reports', 'insert')[0][0]).toEqual({
      reporter_id: 'me',
      target_kind: 'post',
      target_id: 'p1',
      details: 'Spam i flödet',
    })
  })

  it('tomma eller utelämnade detaljer blir null', async () => {
    let calls = installTables(fromMock, { reports: { data: null } })
    await reportContent('user', 'u2')
    expect(argsOf(calls, 'reports', 'insert')[0][0]).toMatchObject({ details: null })

    calls = installTables(fromMock, { reports: { data: null } })
    await reportContent('comment', 'k1', '   ')
    expect(argsOf(calls, 'reports', 'insert')[0][0]).toMatchObject({ details: null })
  })

  it('utloggad användare skickar ingen anmälan alls', async () => {
    signIn(null)
    await reportContent('post', 'p1', 'Spam')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('kastar vidare fel från databasen', async () => {
    installTables(fromMock, { reports: { data: null, error: { message: 'rls' } } })
    await expect(reportContent('post', 'p1')).rejects.toMatchObject({ message: 'rls' })
  })
})
