import { render } from '@testing-library/react-native'
import { EquipmentIcon } from '../EquipmentIcon'
import { EQUIPMENT_LABELS } from '@/services/exercises'
import type { ExerciseEquipment } from '@/services/exercises'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn() } } }))

describe('EquipmentIcon', () => {
  it('renderar en ikon för varje utrustningstyp plus alla-läget', () => {
    const kinds = ['all', ...Object.keys(EQUIPMENT_LABELS)] as Array<ExerciseEquipment | 'all'>
    for (const kind of kinds) {
      const { unmount, toJSON } = render(<EquipmentIcon equipment={kind} color="#FFA817" />)
      // Varje variant ska rita någonting, ingen får vara tom
      expect(toJSON()).not.toBeNull()
      unmount()
    }
  })
})
