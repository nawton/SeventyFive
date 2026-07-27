import * as Notifications from 'expo-notifications'
import { registerPushToken, unregisterPushTokens } from '../pushTokens'
import { supabase } from '@/lib/supabase'
import { installTables, argsOf } from '@/testUtils/supabaseChain'

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, expoConfig: { extra: { eas: { projectId: 'proj-1' } } } },
}))
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}))
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}))

// Handlern registreras när modulen laddas — fånga den innan clearAllMocks
const handlerConfig = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0]?.[0]

const fromMock = supabase.from as jest.Mock
const permsMock = Notifications.getPermissionsAsync as jest.Mock
const tokenMock = Notifications.getExpoPushTokenAsync as jest.Mock

function signIn(uid: string | null) {
  ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: uid ? { user: { id: uid } } : null },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  signIn('me')
  permsMock.mockResolvedValue({ status: 'granted' })
  tokenMock.mockResolvedValue({ data: 'ExponentPushToken[abc]' })
})

describe('notishanteraren', () => {
  it('visar banners för notiser som kommer medan appen är öppen', async () => {
    expect(handlerConfig).toBeDefined()
    expect(await handlerConfig.handleNotification()).toEqual({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
    })
  })
})

describe('registerPushToken', () => {
  it('registrerar enhetens token på användaren med EAS-projektet', async () => {
    const calls = installTables(fromMock, { push_tokens: { data: null } })
    await registerPushToken()

    expect(tokenMock).toHaveBeenCalledWith({ projectId: 'proj-1' })
    const payload = argsOf(calls, 'push_tokens', 'upsert')[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({ user_id: 'me', token: 'ExponentPushToken[abc]' })
    expect(payload.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('utan beviljad rättighet hämtas inget token', async () => {
    permsMock.mockResolvedValue({ status: 'denied' })
    await registerPushToken()
    expect(tokenMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('utan token eller inloggning skrivs ingenting', async () => {
    tokenMock.mockResolvedValue({ data: null })
    await registerPushToken()
    expect(supabase.auth.getSession).not.toHaveBeenCalled()

    tokenMock.mockResolvedValue({ data: 'ExponentPushToken[abc]' })
    signIn(null)
    await registerPushToken()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('sväljer alla fel, pushtoken är aldrig kritiskt', async () => {
    permsMock.mockRejectedValue(new Error('modul saknas'))
    await expect(registerPushToken()).resolves.toBeUndefined()
  })
})

describe('unregisterPushTokens', () => {
  it('raderar användarens alla tokens vid utloggning', async () => {
    const calls = installTables(fromMock, { push_tokens: { data: null } })
    await unregisterPushTokens()
    expect(argsOf(calls, 'push_tokens', 'delete')).toHaveLength(1)
    expect(argsOf(calls, 'push_tokens', 'eq')[0]).toEqual(['user_id', 'me'])
  })

  it('utloggad eller felande session är ofarligt', async () => {
    signIn(null)
    await unregisterPushTokens()
    expect(fromMock).not.toHaveBeenCalled()

    ;(supabase.auth.getSession as jest.Mock).mockRejectedValue(new Error('nät'))
    await expect(unregisterPushTokens()).resolves.toBeUndefined()
  })
})

describe('i Expo Go', () => {
  it('registreras varken handler eller token, modulen saknas där', async () => {
    jest.resetModules()
    jest.doMock('expo-constants', () => ({ __esModule: true, default: { appOwnership: 'expo' } }))
    const notif = { setNotificationHandler: jest.fn(), getPermissionsAsync: jest.fn() }
    jest.doMock('expo-notifications', () => notif)

    let mod!: typeof import('../pushTokens')
    jest.isolateModules(() => { mod = require('../pushTokens') })
    await mod.registerPushToken()

    expect(notif.setNotificationHandler).not.toHaveBeenCalled()
    expect(notif.getPermissionsAsync).not.toHaveBeenCalled()
  })
})
