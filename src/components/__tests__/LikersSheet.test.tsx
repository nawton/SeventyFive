import { render, screen, fireEvent } from '@testing-library/react-native'
import { State, type PanGesture } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
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

describe('LikersSheet — draggesten', () => {
  it('snabb dragning nedåt stänger arket', () => {
    const onClose = jest.fn()
    render(<LikersSheet likers={LIKERS} count={3} onClose={onClose} />)
    fireGestureHandler<PanGesture>(getByGestureTestId('likersPan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: 200 },
      { state: State.END, translationY: 420, velocityY: 1400 },
    ])
    expect(onClose).toHaveBeenCalled()
  })

  it('dragning uppåt fäster i helskärm utan att stänga', () => {
    const onClose = jest.fn()
    render(<LikersSheet likers={LIKERS} count={3} onClose={onClose} />)
    fireGestureHandler<PanGesture>(getByGestureTestId('likersPan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: -200 },
      { state: State.END, translationY: -300, velocityY: -1400 },
    ])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('liten dragning snäpper tillbaka till halvläget', () => {
    const onClose = jest.fn()
    render(<LikersSheet likers={LIKERS} count={3} onClose={onClose} />)
    fireGestureHandler<PanGesture>(getByGestureTestId('likersPan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: 15 },
      { state: State.END, translationY: 15, velocityY: 0 },
    ])
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Elin Berg')).toBeOnTheScreen()
  })
})
