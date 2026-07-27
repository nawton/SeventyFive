import { Alert, ActionSheetIOS, Platform } from 'react-native'
import { promptReport, postReportMenu } from '../report'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}))

const fromMock = supabase.from as jest.Mock
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

type SheetCb = (index: number) => void
type AlertBtn = { text: string; onPress?: () => void }

beforeEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'u1' } } },
  })
})

describe('promptReport på iOS', () => {
  it('vald anledning skrivs till reports med rätt kolumner', async () => {
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {})
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const calls = installTables(fromMock, { reports: { error: null } })

    promptReport('group', 'g1', 'Anmäl gruppen')
    const [options, cb] = sheet.mock.calls[0] as [Record<string, unknown>, SheetCb]
    expect(options.title).toBe('Anmäl gruppen')
    expect(options.options).toEqual(['Avbryt', 'Spam eller vilseledande', 'Stötande innehåll', 'Trakasserier', 'Annat'])

    cb(2)   // Stötande innehåll
    await flush()
    expect(argsOf(calls, 'reports', 'insert')[0][0]).toEqual({
      reporter_id: 'u1', target_kind: 'group', target_id: 'g1', details: 'Stötande innehåll',
    })
    expect(alert).toHaveBeenCalledWith('Tack för din anmälan', expect.any(String))
  })

  it('Avbryt skickar ingenting, fel ger ett ärligt besked', async () => {
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {})
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    installTables(fromMock, { reports: { error: null } })
    promptReport('post', 'p1', 'Anmäl inlägget')
    ;(sheet.mock.calls[0][1] as SheetCb)(0)
    await flush()
    expect(fromMock).not.toHaveBeenCalled()

    installTables(fromMock, { reports: { error: { message: 'nere' } } })
    promptReport('post', 'p1', 'Anmäl inlägget')
    ;(sheet.mock.calls[1][1] as SheetCb)(1)
    await flush()
    expect(alert).toHaveBeenCalledWith('Kunde inte skicka anmälan', expect.any(String))
  })
})

describe('promptReport på Android', () => {
  it('anledningarna visas som Alert-knappar', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const calls = installTables(fromMock, { reports: { error: null } })

    promptReport('user', 'u9', 'Anmäl Kalle')
    const buttons = alert.mock.calls[0][2] as AlertBtn[]
    expect(buttons.map(b => b.text)).toEqual(['Avbryt', 'Spam eller vilseledande', 'Stötande innehåll', 'Trakasserier', 'Annat'])

    buttons.find(b => b.text === 'Trakasserier')!.onPress!()
    await flush()
    expect(argsOf(calls, 'reports', 'insert')[0][0]).toMatchObject({
      target_kind: 'user', target_id: 'u9', details: 'Trakasserier',
    })
  })
})

describe('postReportMenu', () => {
  it('iOS: valen öppnar anmälningsflödet för inlägg respektive författare', () => {
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {})
    postReportMenu('p1', 'u2', 'Kalle')
    const [options, cb] = sheet.mock.calls[0] as [Record<string, unknown>, SheetCb]
    expect(options.options).toEqual(['Avbryt', 'Anmäl inlägget', 'Anmäl Kalle'])

    cb(1)
    expect((sheet.mock.calls[1][0] as Record<string, unknown>).title).toBe('Anmäl inlägget')
    cb(2)
    expect((sheet.mock.calls[2][0] as Record<string, unknown>).title).toBe('Anmäl Kalle')
  })

  it('Android: menyn byggs med Alert', () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    postReportMenu('p1', 'u2', 'Kalle')
    const buttons = alert.mock.calls[0][2] as AlertBtn[]
    expect(buttons.map(b => b.text)).toEqual(['Avbryt', 'Anmäl inlägget', 'Anmäl Kalle'])
    buttons[1].onPress!()
    // Undermenyn (promptReport) öppnas också via Alert på Android
    expect(alert.mock.calls[1][0]).toBe('Anmäl inlägget')
  })
})

describe('inloggningskravet', () => {
  it('utloggad anmälan slutar i felbeskedet i stället för en skriven rad', async () => {
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } })
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {})
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    promptReport('post', 'p1', 'Anmäl inlägget')
    ;(sheet.mock.calls[0][1] as SheetCb)(1)
    await flush()
    expect(fromMock).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledWith('Kunde inte skicka anmälan', expect.any(String))
  })
})
