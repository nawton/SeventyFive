import type { ImageSourcePropType } from 'react-native'

// =============================================================================
// VÄLKOMSTBILDER — helskärmsfoton bakom onboarding-sliderna (Runna-känsla).
// Släpp egna träningsbilder (porträttformat, gärna mörka/stämningsfulla) i
// assets/onboarding/ och avkommentera raden — tills dess visas en gradient.
// Bilderna väljs manuellt, lägg aldrig in något här på eget bevåg.
// Filnamn = slidens nyckel i app/(auth)/welcome.tsx.
// =============================================================================

export const ONBOARDING_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  // brand:     require('../../assets/onboarding/brand.jpg'),
  // tasks:     require('../../assets/onboarding/tasks.jpg'),
  // training:  require('../../assets/onboarding/training.jpg'),
  // progress:  require('../../assets/onboarding/progress.jpg'),
  // community: require('../../assets/onboarding/community.jpg'),
}
