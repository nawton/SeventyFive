import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { State, type PanGesture } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
import { CardioSummaryView } from '../CardioSummaryView'
import { updateCardioEffort } from '@/services/workouts'
import type { CardioWorkout } from '@/services/cardioWorkouts'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('@/services/workouts', () => ({ updateCardioEffort: jest.fn().mockResolvedValue(undefined) }))

function makeWorkout(over: Partial<CardioWorkout['data']> = {}): CardioWorkout {
  return {
    id: 'w1',
    name: 'Löpning',
    created_at: '2026-07-20T10:00:00Z',
    data: {
      category: 'cardio',
      type: 'running',
      distance_km: 5,
      duration_seconds: 1500,
      calories: 320,
      ...over,
    },
  }
}

function renderView(workout: CardioWorkout, unit: 'metric' | 'imperial' = 'metric') {
  return render(
    <CardioSummaryView
      workout={workout}
      title="Morgonrunda"
      dateLabel="måndag 20 juli"
      avatarUrl={null}
      unit={unit}
      onClose={jest.fn()}
    />
  )
}

describe('CardioSummaryView — statistik', () => {
  it('visar titel, datum och alla fyra mätvärden', async () => {
    renderView(makeWorkout())
    expect(await screen.findByText('Morgonrunda')).toBeOnTheScreen()
    expect(screen.getByText('måndag 20 juli')).toBeOnTheScreen()
    expect(screen.getByText('Distans (km)')).toBeOnTheScreen()
    expect(screen.getByText('5.00')).toBeOnTheScreen()
    expect(screen.getByText('25:00')).toBeOnTheScreen()    // 1500 s
    expect(screen.getByText('5:00')).toBeOnTheScreen()     // snittempo /km
    expect(screen.getByText('320')).toBeOnTheScreen()      // kcal
  })

  it('miles-läget konverterar distans och tempo', async () => {
    renderView(makeWorkout(), 'imperial')
    expect(await screen.findByText('Distans (mi)')).toBeOnTheScreen()
    expect(screen.getByText('3.11')).toBeOnTheScreen()     // 5 km
    expect(screen.getByText('Snitt /mi')).toBeOnTheScreen()
    expect(screen.getByText('8:02')).toBeOnTheScreen()     // 5:00/km ≈ 8:02/mi (golvat)
  })

  it('nolldistans visar streckat tempo istället för Infinity', async () => {
    renderView(makeWorkout({ distance_km: 0, duration_seconds: 600 }))
    expect(await screen.findByText('0.00')).toBeOnTheScreen()
    expect(screen.getByText('--:--')).toBeOnTheScreen()
  })
})

describe('CardioSummaryView — intervaller och splittar', () => {
  it('guidade pass visar intervallkortet med "X av Y"', async () => {
    renderView(makeWorkout({
      intervals: [
        { label: 'Intervall 1 av 6', distanceM: 1000, durationS: 300, paceSec: 300 },
        { label: 'Intervall 2 av 6', distanceM: 1000, durationS: 290, paceSec: 290 },
        { label: 'Intervall 3 av 6', distanceM: 1000, durationS: 310, paceSec: 310 },
      ],
      intervals_planned: 6,
    }))
    expect(await screen.findByText('Intervaller · 3 av 6')).toBeOnTheScreen()
    // Raderna numreras och visar distansen i km när den är jämn
    expect(screen.getAllByText(/1 km/)).not.toHaveLength(0)
    expect(screen.getByText('4:50')).toBeOnTheScreen()     // snabbaste intervallen
  })

  it('korta intervaller visas i meter', async () => {
    renderView(makeWorkout({
      intervals: [{ label: 'Intervall 1 av 4', distanceM: 400, durationS: 96, paceSec: 240 }],
    }))
    expect(await screen.findByText(/400 m/)).toBeOnTheScreen()
  })

  it('namngivna arbetssegment (Tempo) visar etiketten istället för nummer', async () => {
    renderView(makeWorkout({
      intervals: [{ label: 'Tempo', distanceM: 4000, durationS: 1260, paceSec: 315 }],
    }))
    expect(await screen.findByText(/Tempo/)).toBeOnTheScreen()
  })

  it('kilometersplittar renderas med etikett och tempo', async () => {
    renderView(makeWorkout({
      splits: [
        { label: '1 km', paceSec: 305 },
        { label: '2 km', paceSec: 295 },
        { label: '0,5 km', paceSec: 315 },
      ],
    }))
    expect(await screen.findByText('Kilometersplittar')).toBeOnTheScreen()
    expect(screen.getByText('2 km')).toBeOnTheScreen()
    expect(screen.getByText('4:55')).toBeOnTheScreen()     // snabbaste splitten
    expect(screen.getByText('0,5 km')).toBeOnTheScreen()
  })

  it('vanliga pass utan guidning har inget intervallkort', async () => {
    renderView(makeWorkout({ splits: [{ label: '1 km', paceSec: 300 }] }))
    expect(await screen.findByText('Kilometersplittar')).toBeOnTheScreen()
    expect(screen.queryByText(/Intervaller ·/)).toBeNull()
  })
})

const ROUTE: [number, number][] = [[59.33, 18.06], [59.335, 18.065], [59.34, 18.07]]

describe('CardioSummaryView — kartstil och dragbara ark', () => {
  it('lagerknappen öppnar kartväljaren och ett stilbyte stänger den', async () => {
    renderView(makeWorkout({ route: ROUTE }))
    fireEvent.press(await screen.findByText('glassbtn:layers-outline'))
    expect(screen.getByText('Välj karta')).toBeOnTheScreen()
    expect(screen.getByText('Satellit')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Satellit'))
    await waitFor(() => expect(screen.queryByText('Välj karta')).toBeNull())
  })

  it('liten dragning i väljaren studsar tillbaka, lång dragning stänger', async () => {
    renderView(makeWorkout({ route: ROUTE }))
    fireEvent.press(await screen.findByText('glassbtn:layers-outline'))

    fireGestureHandler<PanGesture>(getByGestureTestId('cardioStylePan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: -30 },   // uppåt bromsas med gummiband
      { state: State.ACTIVE, translationY: 20 },
      { state: State.END, translationY: 20, velocityY: 0 },
    ])
    expect(screen.getByText('Välj karta')).toBeOnTheScreen()

    fireGestureHandler<PanGesture>(getByGestureTestId('cardioStylePan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: 140 },
      { state: State.END, translationY: 140, velocityY: 900 },
    ])
    await waitFor(() => expect(screen.queryByText('Välj karta')).toBeNull())
  })

  it('detaljarket snäpper mellan helskärm, mitten och botten', async () => {
    renderView(makeWorkout())
    await screen.findByText('Morgonrunda')

    // Uppåtfling nära mitten → helskärmsläget tar över nästa fling
    fireGestureHandler<PanGesture>(getByGestureTestId('cardioDetailPan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: 40 },
      { state: State.END, translationY: 40, velocityY: -900 },
    ])
    // Nedåtfling → botten
    fireGestureHandler<PanGesture>(getByGestureTestId('cardioDetailPan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: 30 },
      { state: State.END, translationY: 30, velocityY: 900 },
    ])
    // Långsam dragning uppåt från botten → snäpper till mitten
    fireGestureHandler<PanGesture>(getByGestureTestId('cardioDetailPan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: -600 },
      { state: State.END, translationY: -600, velocityY: 0 },
    ])
    // Liten dragning → tillbaka till närmaste läget
    fireGestureHandler<PanGesture>(getByGestureTestId('cardioDetailPan'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: -10 },
      { state: State.END, translationY: -10, velocityY: 0 },
    ])
    expect(screen.getByText('Morgonrunda')).toBeOnTheScreen()
  })
})

describe('CardioSummaryView — ansträngning', () => {
  it('sparat betyg visas med etikett', async () => {
    renderView(makeWorkout({ effort: 7 }))
    expect(await screen.findByText('Ansträngning')).toBeOnTheScreen()
    expect(screen.getByText('7')).toBeOnTheScreen()
    expect(screen.getByText('Svår')).toBeOnTheScreen()
  })

  it('utan betyg uppmanas man att sätta ett', async () => {
    renderView(makeWorkout())
    expect(await screen.findByText('Tryck för att betygsätta')).toBeOnTheScreen()
  })

  it('betygslagret öppnas vid tryck med nuvarande betyg förvalt', async () => {
    renderView(makeWorkout({ effort: 4 }))
    fireEvent.press(await screen.findByText('Ansträngning'))
    expect(screen.getByText('Hur kändes passet?')).toBeOnTheScreen()
    // Betyget syns både på kortet och som förval i lagret
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(2)
    // Samma betyg bekräftat → ingen onödig skrivning till databasen
    fireEvent.press(screen.getByText('Klar'))
    await waitFor(() => expect(screen.queryByText('Hur kändes passet?')).toBeNull())
    expect(updateCardioEffort).not.toHaveBeenCalled()
  })
})
