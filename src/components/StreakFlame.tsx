import Svg, { Path } from 'react-native-svg'

// =============================================================================
// STREAKFLAMMAN — egen flerlagrad flamma i platt stil istället för 🔥-emojin:
// yttre flamma i klar orange med en spets på vänstersidan, inre flamma i
// djupare orange och en gul droppkärna längst ner.
// =============================================================================

export function StreakFlame({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.18} viewBox="0 0 100 118">
      {/* Yttre flamman */}
      <Path
        d="M50 118C26 118 10 100 10 78C10 62 18 50 27 38C26 48 30 55 36 57C33 40 42 22 60 2C58 20 66 30 76 44C85 56 90 66 90 78C90 100 74 118 50 118Z"
        fill="#FB8C2C"
      />
      {/* Inre flamman */}
      <Path
        d="M50 116C34 116 24 104 24 88C24 76 31 66 40 55C39 64 43 70 49 71C46 58 52 46 62 34C64 48 76 60 76 87C76 104 66 116 50 116Z"
        fill="#F2652A"
      />
      {/* Kärnan */}
      <Path
        d="M50 114C42.5 114 37 108 37 100C37 91 44 85 50 75C56 85 63 91 63 100C63 108 57.5 114 50 114Z"
        fill="#FFD54D"
      />
    </Svg>
  )
}
