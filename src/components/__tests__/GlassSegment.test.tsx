import { render, screen, fireEvent } from '@testing-library/react-native'
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
})
