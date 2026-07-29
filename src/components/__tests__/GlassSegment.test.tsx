import { render, screen, fireEvent, act } from '@testing-library/react-native'
import { State, type PanGesture } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
import { GlassSegment } from '../GlassSegment'

describe('GlassSegment', () => {
  const OPTIONS = [
    { key: 'feed', label: 'Flöde' },
    { key: 'groups', label: 'Grupper' },
  ] as const

  it('renderar alla flikar och rapporterar byten', () => {
    const onChange = jest.fn()
    render(<GlassSegment value="feed" options={[...OPTIONS]} onChange={onChange} tint={null} />)

    expect(screen.getByText('Flöde')).toBeOnTheScreen()
    expect(screen.getByText('Grupper')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Grupper'))
    expect(onChange).toHaveBeenCalledWith('groups')
  })

  it('tryck på redan vald flik är en no-op', () => {
    const onChange = jest.fn()
    render(<GlassSegment value="feed" options={[...OPTIONS]} onChange={onChange} tint={null} />)
    fireEvent.press(screen.getByText('Flöde'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('dragning av tummen snäpper till närmaste flik och rapporterar bytet', async () => {
    const onChange = jest.fn()
    render(<GlassSegment value="feed" options={[...OPTIONS]} onChange={onChange} tint={null} />)
    // Layouten ger tummen bredd — 306 px ram ger två 150 px-fack
    fireEvent(screen.getByTestId('glassSegTrack'), 'layout', { nativeEvent: { layout: { width: 306 } } })
    // Gesthanteraren byter till de nya callbackarna i en mikrotask
    await act(async () => {})

    fireGestureHandler<PanGesture>(getByGestureTestId('glassSegPan'), [
      { state: State.BEGAN, x: 30 },
      { state: State.ACTIVE, x: 120 },
      { state: State.ACTIVE, x: 260 },
      { state: State.END, x: 260 },
    ])
    expect(onChange).toHaveBeenCalledWith('groups')
  })

  it('avbruten dragning fjädrar tillbaka utan byte', async () => {
    const onChange = jest.fn()
    render(<GlassSegment value="feed" options={[...OPTIONS]} onChange={onChange} tint={null} />)
    fireEvent(screen.getByTestId('glassSegTrack'), 'layout', { nativeEvent: { layout: { width: 306 } } })
    await act(async () => {})

    fireGestureHandler<PanGesture>(getByGestureTestId('glassSegPan'), [
      { state: State.BEGAN, x: 30 },
      { state: State.ACTIVE, x: 200 },
      { state: State.CANCELLED, x: 200 },
    ])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('dragning som slutar på samma flik byter ingenting', async () => {
    const onChange = jest.fn()
    render(<GlassSegment value="feed" options={[...OPTIONS]} onChange={onChange} tint={null} />)
    fireEvent(screen.getByTestId('glassSegTrack'), 'layout', { nativeEvent: { layout: { width: 306 } } })
    await act(async () => {})

    fireGestureHandler<PanGesture>(getByGestureTestId('glassSegPan'), [
      { state: State.BEGAN, x: 30 },
      { state: State.ACTIVE, x: 60 },
      { state: State.END, x: 60 },
    ])
    expect(onChange).not.toHaveBeenCalled()
  })
})
