import { render, screen, fireEvent } from '@testing-library/react-native'
import { EffortRating, effortColor, effortLabel } from '../EffortRating'

describe('effortLabel / effortColor', () => {
  it('etiketter över hela skalan', () => {
    expect(effortLabel(1)).toBe('Mycket lätt')
    expect(effortLabel(3)).toBe('Lätt')
    expect(effortLabel(5)).toBe('Måttlig')
    expect(effortLabel(8)).toBe('Svår')
    expect(effortLabel(10)).toBe('Maximal')
  })
  it('färgskalan går grönt → rött och klampar utanför skalan', () => {
    expect(effortColor(1)).toBe(effortColor(0))    // under skalan klampas
    expect(effortColor(10)).toBe(effortColor(99))  // över skalan klampas
    expect(effortColor(1)).not.toBe(effortColor(10))
    for (const n of [1, 5, 10]) expect(effortColor(n)).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('EffortRating', () => {
  it('renderar inget när den är dold', () => {
    render(<EffortRating visible={false} onDone={jest.fn()} />)
    expect(screen.queryByText('Hur kändes passet?')).toBeNull()
  })

  it('utan förval: hint visas och Klar gör ingenting', () => {
    const onDone = jest.fn()
    render(<EffortRating visible initial={null} onDone={onDone} />)
    expect(screen.getByText('Dra eller tryck på staplarna')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Klar'))
    expect(onDone).not.toHaveBeenCalled()
  })

  it('med förval: badge + etikett visas och Klar bekräftar valet', () => {
    const onDone = jest.fn()
    render(<EffortRating visible initial={6} onDone={onDone} />)
    expect(screen.getByText('6')).toBeOnTheScreen()
    expect(screen.getByText('Måttlig')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Klar'))
    expect(onDone).toHaveBeenCalledWith(6)
  })

  it('Hoppa över ger null', () => {
    const onDone = jest.fn()
    render(<EffortRating visible initial={8} onDone={onDone} />)
    fireEvent.press(screen.getByText('Hoppa över'))
    expect(onDone).toHaveBeenCalledWith(null)
  })
})
