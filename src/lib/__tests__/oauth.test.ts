import * as WebBrowser from 'expo-web-browser'
import { signInWithGoogle } from '../oauth'
import { supabase } from '../supabase'
import { getProfile, updateProfile } from '@/services/profile'

jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'seventyfive://auth-callback') }))
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}))
jest.mock('../supabase', () => ({
  supabase: { auth: { signInWithOAuth: jest.fn(), exchangeCodeForSession: jest.fn() } },
}))
jest.mock('@/services/profile', () => ({ getProfile: jest.fn(), updateProfile: jest.fn() }))

// Anropas vid modulladdning — fånga innan clearAllMocks
const completedAtImport = (WebBrowser.maybeCompleteAuthSession as jest.Mock).mock.calls.length > 0

const oauthMock = supabase.auth.signInWithOAuth as jest.Mock
const browserMock = WebBrowser.openAuthSessionAsync as jest.Mock
const exchangeMock = supabase.auth.exchangeCodeForSession as jest.Mock
const profileMock = getProfile as jest.Mock

function happyPath(userMeta: Record<string, unknown> = { full_name: 'Elin Berg' }) {
  oauthMock.mockResolvedValue({ data: { url: 'https://accounts.google.com/auth' }, error: null })
  browserMock.mockResolvedValue({ type: 'success', url: 'seventyfive://auth-callback?code=abc123' })
  exchangeMock.mockResolvedValue({
    data: { session: { user: { id: 'u1', user_metadata: userMeta } } },
    error: null,
  })
  profileMock.mockResolvedValue({ name: null })
}

beforeEach(() => jest.clearAllMocks())

describe('signInWithGoogle', () => {
  it('städar upp hängande auth-sessioner redan vid appstart', () => {
    expect(completedAtImport).toBe(true)
  })

  it('hela vägen: OAuth-URL, webbläsare, kodbyte och profilnamn från Google', async () => {
    happyPath({ full_name: '  Elin Berg  ' })
    expect(await signInWithGoogle()).toBe(true)

    expect(oauthMock).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'seventyfive://auth-callback', skipBrowserRedirect: true },
    })
    expect(browserMock).toHaveBeenCalledWith('https://accounts.google.com/auth', 'seventyfive://auth-callback')
    expect(exchangeMock).toHaveBeenCalledWith('abc123')
    expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Elin Berg' })
  })

  it('OAuth-fel eller saknad URL öppnar aldrig webbläsaren', async () => {
    oauthMock.mockResolvedValue({ data: { url: null }, error: { message: 'nere' } })
    expect(await signInWithGoogle()).toBe(false)

    oauthMock.mockResolvedValue({ data: { url: null }, error: null })
    expect(await signInWithGoogle()).toBe(false)
    expect(browserMock).not.toHaveBeenCalled()
  })

  it('avbruten inloggning byter aldrig någon kod', async () => {
    happyPath()
    browserMock.mockResolvedValue({ type: 'cancel' })
    expect(await signInWithGoogle()).toBe(false)
    expect(exchangeMock).not.toHaveBeenCalled()
  })

  it('callback utan kod eller misslyckat kodbyte ger falskt', async () => {
    happyPath()
    browserMock.mockResolvedValue({ type: 'success', url: 'seventyfive://auth-callback?error=denied' })
    expect(await signInWithGoogle()).toBe(false)
    expect(exchangeMock).not.toHaveBeenCalled()

    happyPath()
    exchangeMock.mockResolvedValue({ data: {}, error: { message: 'ogiltig kod' } })
    expect(await signInWithGoogle()).toBe(false)
    expect(profileMock).not.toHaveBeenCalled()
  })

  it('metadatans name-fält duger när full_name saknas', async () => {
    happyPath({ name: 'Hugo Lind' })
    expect(await signInWithGoogle()).toBe(true)
    expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Hugo Lind' })
  })

  it('skriver aldrig över ett namn användaren redan valt', async () => {
    happyPath()
    profileMock.mockResolvedValue({ name: 'Vera Holm' })
    expect(await signInWithGoogle()).toBe(true)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('utan namn i metadatan lämnas profilen orörd', async () => {
    happyPath({})
    expect(await signInWithGoogle()).toBe(true)
    expect(profileMock).not.toHaveBeenCalled()
  })

  it('profilfel stoppar aldrig inloggningen', async () => {
    happyPath()
    profileMock.mockRejectedValue(new Error('rls'))
    expect(await signInWithGoogle()).toBe(true)
  })
})
