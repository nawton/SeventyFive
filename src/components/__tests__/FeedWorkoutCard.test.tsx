import { render, screen, fireEvent } from '@testing-library/react-native'
import { FeedWorkoutCard, strengthToPosts, type StrengthPost } from '../FeedWorkoutCard'
import type { StrengthWorkout } from '@/services/strengthWorkouts'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() },
  storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://test/${p}` } }) }) },
} }))
jest.mock('react-native-maps', () => {
  const { View } = require('react-native')
  return { __esModule: true, default: View, Polyline: View, Marker: View }
})
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))

const w = (id: string, name: string): StrengthWorkout => ({
  id, name: 'Gympass', created_at: '2026-07-27T10:00:00Z',
  data: { exercise_name: name, sets: [{ reps: 10, weight_kg: 60 }, { reps: 8, weight_kg: 70 }], workout_date: '2026-07-27' },
} as StrengthWorkout)

const POST: StrengthPost = {
  kind: 'strength', id: 'p1', authorId: 'u1', authorName: 'Elin Berg', authorAvatar: null,
  typeLabel: 'Gympass', createdAt: '2026-07-27T10:00:00Z',
  exercises: 4, sets: 8, volumeKg: 520, workoutDate: '2026-07-27', passKey: '',
  workouts: [w('w1', 'Bänkpress'), w('w2', 'Knäböj'), w('w3', 'Marklyft'), w('w4', 'Sidolyft')],
}

describe('strengthToPosts — pass-nyckeln håller isär pass', () => {
  it('två pass samma dag blir två inlägg, äldre rader utan nyckel grupperas per dag', () => {
    const mk = (id: string, passKey?: string) => ({
      ...w(id, 'Bänkpress'),
      data: { ...w(id, 'Bänkpress').data, ...(passKey ? { pass_key: passKey } : {}) },
    })
    const posts = strengthToPosts(
      [mk('a1', 'pass-1'), mk('a2', 'pass-1'), mk('b1', 'pass-2'), mk('c1'), mk('c2')],
      'u1', 'Elin Berg', null,
    )
    expect(posts).toHaveLength(3)
    const sizes = posts.map(p => p.workouts.length).sort()
    expect(sizes).toEqual([1, 2, 2])
    // Äldre id-formatet utan nyckel är oförändrat så gillanden överlever
    expect(posts.find(p => p.passKey === '')?.id).toBe('gym-u1-2026-07-27')
  })
})

describe('FeedWorkoutCard — gympassets övningsförhandsvisning', () => {
  it('visar de tre första övningarna med setantal och en till-rad', () => {
    render(<FeedWorkoutCard post={POST} onOpen={jest.fn()} />)

    expect(screen.getByText('Bänkpress')).toBeOnTheScreen()
    expect(screen.getByText('Knäböj')).toBeOnTheScreen()
    expect(screen.getByText('Marklyft')).toBeOnTheScreen()
    // Fjärde övningen visas inte som rad utan som en till-rad
    expect(screen.queryByText('Sidolyft')).toBeNull()
    expect(screen.getByText('+ 1 övning till')).toBeOnTheScreen()
    expect(screen.getAllByText('2 set')).toHaveLength(3)
    // Alla tre förhandsraderna finns med GIF-platta
    expect(screen.getByTestId('preview-w1')).toBeOnTheScreen()
    expect(screen.getByTestId('preview-w3')).toBeOnTheScreen()
  })

  it('granskningens titel ersätter dygnsrubriken och kommentaren visas under', () => {
    render(
      <FeedWorkoutCard
        post={POST}
        meta={{ title: 'Tungt benpass', note: 'Sjukt bra pass' }}
        onOpen={jest.fn()}
      />,
    )
    expect(screen.getByText('Tungt benpass')).toBeOnTheScreen()
    expect(screen.getByText('Sjukt bra pass')).toBeOnTheScreen()
  })

  it('tryck på kortet öppnar passet, övningsraderna fångar inte trycket', () => {
    const onOpen = jest.fn()
    render(<FeedWorkoutCard post={POST} onOpen={onOpen} />)
    fireEvent.press(screen.getByTestId(`post-${POST.id}`))
    expect(onOpen).toHaveBeenCalledWith(POST)
    expect(screen.queryByTestId('exerciseInfoSheet')).toBeNull()
  })
})
