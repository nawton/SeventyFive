import { render, screen, fireEvent } from '@testing-library/react-native'
import { LikersSheet } from '../LikersSheet'
import type { FollowProfile } from '@/services/follows'

const LIKERS: FollowProfile[] = [
  { id: 'u1', name: 'Elin Berg', avatar_url: null },
  { id: 'u2', name: 'Hugo Lind', avatar_url: null },
  { id: 'u3', name: null as unknown as string, avatar_url: null },
]

describe('LikersSheet', () => {
  it('stängd (likers null) renderar ingenting alls', () => {
    const view = render(<LikersSheet likers={null} count={0} onClose={jest.fn()} />)
    expect(view.toJSON()).toBeNull()
  })

  it('öppen visar antalet och alla som gillat, namnlösa får fallback', () => {
    render(<LikersSheet likers={LIKERS} count={3} onClose={jest.fn()} />)
    expect(screen.getByText('3')).toBeOnTheScreen()
    expect(screen.getByText('Elin Berg')).toBeOnTheScreen()
    expect(screen.getByText('Hugo Lind')).toBeOnTheScreen()
    expect(screen.getByText('Namnlös')).toBeOnTheScreen()
  })

  it('tap på en person lämnar över profilen, krysset stänger', () => {
    const onClose = jest.fn()
    const onPressPerson = jest.fn()
    render(<LikersSheet likers={LIKERS} count={3} onClose={onClose} onPressPerson={onPressPerson} />)

    fireEvent.press(screen.getByText('Elin Berg'))
    expect(onPressPerson).toHaveBeenCalledWith(LIKERS[0])

    fireEvent.press(screen.getByTestId('likersClose'))
    expect(onClose).toHaveBeenCalled()
  })

  it('utan onPressPerson är raderna inaktiva', () => {
    render(<LikersSheet likers={LIKERS} count={3} onClose={jest.fn()} />)
    fireEvent.press(screen.getByText('Elin Berg'))   // ska inte kasta
  })
})
