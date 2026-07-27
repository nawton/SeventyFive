import { render, screen } from '@testing-library/react-native'
import { GroupScanSheet } from '../GroupScanSheet'

// Kameramodulen saknas i den här byggnationen — kraschfri fallback förväntas
jest.mock('expo-camera', () => { throw new Error('saknas i byggnationen') })
jest.mock('@/services/groups', () => ({ getGroup: jest.fn() }))

it('utan kameramodul visas ett ärligt besked istället för en krasch', () => {
  render(<GroupScanSheet visible onClose={jest.fn()} onFound={jest.fn()} />)
  expect(screen.getByText('Kameran är inte tillgänglig')).toBeOnTheScreen()
})
