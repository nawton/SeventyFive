import type { ImageSourcePropType } from 'react-native'

// =============================================================================
// ONBOARDINGBILDER — fotona i välkomstflödets collage (sida 1).
// Släpp egna bilder i assets/onboarding/ och avkommentera raden; tills dess
// visas en märkt platshållare som beskriver motivet. Motiven ska kännas
// naturliga och livsstilsbaserade: löpning i morgonljus, gympass, promenad.
// Bilderna väljs manuellt, lägg aldrig in något här på eget bevåg.
// =============================================================================

export const ONBOARDING_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  // heroRun:  require('../../assets/onboarding/hero-run.jpg'),   // löpning i morgonljus
  // heroGym:  require('../../assets/onboarding/hero-gym.jpg'),   // fokuserat gympass
  // heroWalk: require('../../assets/onboarding/hero-walk.jpg'),  // promenad med träningsväska
}
