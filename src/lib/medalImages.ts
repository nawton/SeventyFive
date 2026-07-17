import type { ImageSourcePropType } from 'react-native'

// =============================================================================
// MEDALJBILDER
// Släpp genererade PNG:er (1024×1024, transparent bakgrund) i assets/medals/
// och avkommentera raden — appen visar då bilden istället för SVG-hexagonen.
// Filnamn = medaljens id i src/lib/achievements.ts.
// =============================================================================

export const MEDAL_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  // day1:      require('../../assets/medals/day1.png'),
  // day10:     require('../../assets/medals/day10.png'),
  // day25:     require('../../assets/medals/day25.png'),
  // day50:     require('../../assets/medals/day50.png'),
  // day75:     require('../../assets/medals/day75.png'),
  // streak7:   require('../../assets/medals/streak7.png'),
  // streak30:  require('../../assets/medals/streak30.png'),
  // workout1:  require('../../assets/medals/workout1.png'),
  // workout25: require('../../assets/medals/workout25.png'),
  // workout75: require('../../assets/medals/workout75.png'),
  // run1:      require('../../assets/medals/run1.png'),
  // km25:      require('../../assets/medals/km25.png'),
  // km100:     require('../../assets/medals/km100.png'),
  // pr1:       require('../../assets/medals/pr1.png'),
  // pr5:       require('../../assets/medals/pr5.png'),
}
