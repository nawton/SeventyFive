import { render, screen, waitFor } from '@testing-library/react-native'
import { ExerciseInfoSheet } from '../ExerciseInfoSheet'
import type { Exercise } from '@/services/exercises'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() } } }))

const BASE: Exercise = {
  id: 'x1', name: 'Sittande kabelcurl över huvudet', description: null,
  category: 'strength', difficulty: 'beginner', video_url: null,
  equipment: 'cable', primary_muscle: 'biceps', other_muscles: ['forearm'],
  image_path: 'lib/edb-0001.gif',
}

describe('ExerciseInfoSheet — instruktioner från databasen', () => {
  beforeAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  })

  afterEach(() => { jest.restoreAllMocks(); delete (global as Record<string, unknown>).fetch })

  it('radens instructions visas direkt utan hämtning', () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock as never
    render(
      <ExerciseInfoSheet
        exercise={{ ...BASE, instructions: [{ sv: 'Sätt dig vid maskinen.', en: 'Sit at the machine.' }] }}
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByText('GENOMFÖRANDE')).toBeOnTheScreen()
    expect(screen.getByText('Sätt dig vid maskinen.')).toBeOnTheScreen()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('utan lokala steg hämtas de via REST på namnet', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => [{ instructions: [{ sv: 'Greppa stången.', en: 'Grab the bar.' }] }],
    }) as never
    render(<ExerciseInfoSheet exercise={BASE} onClose={jest.fn()} />)

    expect(await screen.findByText('Greppa stången.')).toBeOnTheScreen()
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('/rest/v1/exercises')
    expect(url).toContain(encodeURIComponent('Sittande kabelcurl över huvudet'))
    // Muskelchips och utrustning från radens kolumner
    expect(screen.getByText('Biceps')).toBeOnTheScreen()
    expect(screen.getByText('Kabel')).toBeOnTheScreen()
  })
})
