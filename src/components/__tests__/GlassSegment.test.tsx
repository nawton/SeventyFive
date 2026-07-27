import { render, screen, fireEvent } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { GlassSegment } from '../GlassSegment'

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

const OPTIONS = [
  { key: 'week', label: 'Vecka' },
  { key: 'month', label: 'Månad' },
  { key: 'year', label: 'År' },
]

function layoutTrack() {
  // Tummen ritas först när spåret vet sin bredd
  const track = screen.UNSAFE_root.findAll(
    (n: { props: Record<string, unknown> }) => typeof n.props.onLayout === 'function',
  )[0]
  fireEvent(track, 'layout', { nativeEvent: { layout: { width: 309 } } })
}

beforeEach(() => jest.clearAllMocks())

describe('GlassSegment', () => {
  it('tap på ett annat läge haptikar och rapporterar bytet', () => {
    const onChange = jest.fn()
    render(<GlassSegment value="week" options={OPTIONS} onChange={onChange} />)
    layoutTrack()

    fireEvent.press(screen.getByText('Månad'))
    expect(Haptics.selectionAsync).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('month')
  })

  it('tap på det redan valda läget gör ingenting', () => {
    const onChange = jest.fn()
    render(<GlassSegment value="week" options={OPTIONS} onChange={onChange} />)
    layoutTrack()

    fireEvent.press(screen.getByText('Vecka'))
    expect(onChange).not.toHaveBeenCalled()
    expect(Haptics.selectionAsync).not.toHaveBeenCalled()
  })

  it('följer value-propen när föräldern byter läge, och otonat glas renderar', () => {
    const onChange = jest.fn()
    const view = render(
      <GlassSegment value="week" options={OPTIONS} onChange={onChange} tint={null} />,
    )
    layoutTrack()
    view.rerender(<GlassSegment value="year" options={OPTIONS} onChange={onChange} tint={null} />)
    expect(screen.getByText('År')).toBeOnTheScreen()
  })
})
