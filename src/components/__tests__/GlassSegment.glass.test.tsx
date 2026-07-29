// Samma kontroll men med liquid glass PÅ — tummen blir en riktig glasvy
// och den aktiva fliken får vit text istället för svart
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native')
  return { GlassView: View, isLiquidGlassAvailable: () => true }
})

import { render, screen, fireEvent } from '@testing-library/react-native'
import { GlassSegment } from '../GlassSegment'

describe('GlassSegment — liquid glass-läget', () => {
  const OPTIONS = [
    { key: 'week', label: 'Vecka' },
    { key: 'month', label: 'Månad' },
  ] as const

  it('accenttonad glastumme: flikbyte funkar som vanligt', () => {
    const onChange = jest.fn()
    render(<GlassSegment value="week" options={[...OPTIONS]} onChange={onChange} />)
    fireEvent(screen.getByTestId('glassSegTrack'), 'layout', { nativeEvent: { layout: { width: 306 } } })

    expect(screen.getByText('Vecka')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Månad'))
    expect(onChange).toHaveBeenCalledWith('month')
  })

  it('otonat glas (tint null) renderar utan att kasta och byter flik', () => {
    const onChange = jest.fn()
    render(<GlassSegment value="month" options={[...OPTIONS]} onChange={onChange} tint={null} />)
    fireEvent(screen.getByTestId('glassSegTrack'), 'layout', { nativeEvent: { layout: { width: 306 } } })

    fireEvent.press(screen.getByText('Vecka'))
    expect(onChange).toHaveBeenCalledWith('week')
  })
})
