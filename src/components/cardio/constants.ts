import { Dimensions } from 'react-native'
import { Ionicons } from '@/components/Icon'
import type { ExerciseType } from '@/lib/cardioUtils'

export type Status = 'idle' | 'running' | 'paused'

export const EXERCISES: { key: ExerciseType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'running',  label: 'Löpning',  icon: 'fitness-outline' },
  { key: 'cycling',  label: 'Cykling',  icon: 'bicycle-outline' },
  { key: 'interval', label: 'Intervall', icon: 'flash-outline' },
  { key: 'walking',  label: 'Promenad', icon: 'walk-outline' },
]

// Vad aktiviteten går ut på + vad man ska tänka på — visas i infosheeten
// när man trycker på Aktivitet-cellen under ett guidat pass
export const ACTIVITY_INFO: Record<ExerciseType, { desc: string; tips: string[] }> = {
  running: {
    desc: 'Löpning i din egen takt, grunden i all distansträning. Lugna kilometrar bygger motorn som gör de snabba passen möjliga.',
    tips: [
      'Starta lugnare än det känns nödvändigt, de första minuterna ljuger alltid',
      'Landa mjukt med foten under kroppen och blicken framåt',
      'Kan du prata i korta meningar ligger du rätt i lugnt tempo',
    ],
  },
  interval: {
    desc: 'Korta upprepningar i hög fart med vila emellan. Inget pass höjer din maxfart och ditt flås mer, men bara om farten är jämn och vilan används.',
    tips: [
      'Håll jämn fart genom hela intervallen, starta inte i sprint',
      'Använd vilan aktivt: gå eller jogga lätt så pulsen hinner sjunka',
      'Sista intervallen ska kännas tuff, men du ska klara alla i samma fart',
      'Tappar du tekniken, sakta ner hellre än att kämpa dig sönder',
    ],
  },
  cycling: {
    desc: 'Cykling, kondition med minimal belastning på leder och senor. Perfekt som volymträning och aktiv återhämtning.',
    tips: [
      'Håll jämn kadens, runt 80–90 tramptag per minut',
      'Växla lättare i backarna istället för att trampa tungt',
      'Slappna av i axlar och grepp, kraften kommer från benen',
    ],
  },
  walking: {
    desc: 'Promenad, aktiv återhämtning som bygger grundkondition utan att slita. Underskattat verktyg mellan de tuffa passen.',
    tips: [
      'Håll ett tempo där du blir lätt andfådd',
      'Ta ut steget och låt armarna jobba med',
      'Perfekt dagen efter ett tufft pass, blodflödet snabbar på återhämtningen',
    ],
  },
}

export const LIVE_W = Dimensions.get('window').width

// Apple Maps (MapKit) via react-native-maps — stilarna mappar till mapType.
// Terräng finns inte hos Apple; sparade 'terrain'-val faller tillbaka på Karta.
export const MAP_STYLES = [
  { key: 'standard',  label: 'Karta',    icon: 'map-outline' as const },
  { key: 'satellite', label: 'Satellit', icon: 'earth-outline' as const },
  { key: 'dark',      label: 'Natt',     icon: 'moon-outline' as const },
]
export const APPLE_MAP_TYPES: Record<string, 'standard' | 'satellite' | 'mutedStandard'> = {
  standard: 'standard',
  satellite: 'satellite',
  dark: 'mutedStandard',
}
