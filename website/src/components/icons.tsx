// Linjeikoner i samma stil som förlagan: stroke, rundade ändar, currentColor.
import type { ReactNode } from 'react'

type IconProps = { size?: number; strokeWidth?: number }

function Svg({ size = 22, strokeWidth = 2, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconCheck = (p: IconProps) => <Svg {...p}><path d="M20 6L9 17l-5-5" /></Svg>
export const IconArrow = (p: IconProps) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
export const IconChevDown = (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
export const IconClose = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const IconMenu = (p: IconProps) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>

export const IconFlame = (p: IconProps) => (
  <Svg {...p}><path d="M12 2c1.5 4.5-4 6-4 10.5a4 4 0 0 0 8 0c0-1.8-1-3-1-3s3.5 1.2 3.5 5a6.5 6.5 0 0 1-13 0C5.5 8.5 10.5 7 12 2z" /></Svg>
)
export const IconMedal = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="9" r="5" /><path d="M9 13.5L7 21l5-3 5 3-2-7.5" /></Svg>
)
export const IconLayers = (p: IconProps) => (
  <Svg {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13.5l9 5 9-5" /></Svg>
)
export const IconTasks = (p: IconProps) => (
  <Svg {...p}><path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 5l1.5 1.5L8 4" /><path d="M4 11l1.5 1.5L8 10" /><path d="M4 17l1.5 1.5L8 16" /></Svg>
)
export const IconChart = (p: IconProps) => (
  <Svg {...p}><path d="M4 20v-6M10 20V8M16 20v-9M22 20H2" /></Svg>
)
export const IconBell = (p: IconProps) => (
  <Svg {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></Svg>
)
export const IconUsers = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.6" /><path d="M15.5 14.6c2.9 0.4 5.5 2.6 5.5 5.4" /></Svg>
)
export const IconHeart = (p: IconProps) => (
  <Svg {...p}><path d="M12 21s-7-4.6-9.2-8.6C1.2 9.5 3 6 6.5 6c2 0 3.5 1 4.5 2.5C12 7 13.5 6 15.5 6 19 6 20.8 9.5 21.2 12.4 19 16.4 12 21 12 21z" /></Svg>
)
export const IconTrophy = (p: IconProps) => (
  <Svg {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4a2 2 0 0 0 2 5M17 6h3a2 2 0 0 1-2 5" /></Svg>
)
export const IconTarget = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></Svg>
)
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>
)
export const IconDumbbell = (p: IconProps) => (
  <Svg {...p}><path d="M6.5 5.5v13M17.5 5.5v13M3 8.5v7M21 8.5v7M6.5 12h11" /></Svg>
)
export const IconCamera = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="7" width="18" height="14" rx="3" /><circle cx="12" cy="14" r="4" /><path d="M9 7l1.5-3h3L15 7" /></Svg>
)
export const IconTrending = (p: IconProps) => (
  <Svg {...p}><path d="M12 15l4-5" /><path d="M4 18a9 9 0 0 1 16 0" /></Svg>
)
