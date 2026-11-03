import type { SVGProps } from 'react'

/** 16px line icons, 1.5 stroke, drawn for the Studio. */
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

type P = SVGProps<SVGSVGElement>

export const IconScreens = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4" y="1.75" width="8" height="12.5" rx="2" />
    <path d="M7 11.75h2" />
  </svg>
)
export const IconFlows = (p: P) => (
  <svg {...base} {...p}>
    <rect x="1.75" y="2.5" width="4.5" height="4" rx="1" />
    <rect x="9.75" y="9.5" width="4.5" height="4" rx="1" />
    <path d="M6.25 4.5h2a1.5 1.5 0 0 1 1.5 1.5v3.5" />
  </svg>
)
export const IconComponents = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="2.5" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <path d="M11.5 9v5M9 11.5h5" />
  </svg>
)
export const IconPlayground = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" />
  </svg>
)
export const IconPublish = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 10.5V2.5M5 5.25 8 2.25l3 3" />
    <path d="M3 9.5v2.75A1.75 1.75 0 0 0 4.75 14h6.5A1.75 1.75 0 0 0 13 12.25V9.5" />
  </svg>
)
export const IconSpark = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 1.75v3M8 11.25v3M1.75 8h3M11.25 8h3" />
    <path d="M8 5.25 9 7l1.75 1-1.75 1L8 10.75 7 9 5.25 8 7 7z" />
  </svg>
)
export const IconPlus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 3v10M3 8h10" />
  </svg>
)
export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2.75 4.5h10.5M6.5 4.5V3h3v1.5M4.25 4.5l.6 8.25a1 1 0 0 0 1 .95h4.3a1 1 0 0 0 1-.95l.6-8.25" />
  </svg>
)
export const IconUp = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 10l4-4 4 4" />
  </svg>
)
export const IconDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 6l4 4 4-4" />
  </svg>
)
export const IconIndent = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 3.5h6.5M7 8h6.5M7 12.5h6.5M2.5 5.5 5 8l-2.5 2.5" />
  </svg>
)
export const IconOutdent = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 3.5h6.5M7 8h6.5M7 12.5h6.5M5 5.5 2.5 8 5 10.5" />
  </svg>
)
export const IconRotate = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2" y="6" width="9" height="7.5" rx="1.5" />
    <path d="M7.5 2.25h2.25a3 3 0 0 1 3 3v1.5M11.25 5.25l1.5 1.5 1.5-1.5" />
  </svg>
)
export const IconSafeArea = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.25" y="1.75" width="9.5" height="12.5" rx="2" />
    <path d="M5.5 4.5h5v7h-5z" strokeDasharray="1.5 1.5" />
  </svg>
)
export const IconRestart = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.77M2.5 2.5v2.75h2.75" />
  </svg>
)
export const IconBack = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9.5 3.5 5 8l4.5 4.5" />
  </svg>
)
export const IconShield = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 1.75 13 3.5v4c0 3.1-2.1 5.4-5 6.75C5.1 12.9 3 10.6 3 7.5v-4z" />
    <path d="m5.75 8 1.6 1.6 2.9-3.1" />
  </svg>
)
export const IconSun = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
  </svg>
)
export const IconMoon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13.5 9.5A5.75 5.75 0 0 1 6.5 2.5a5.75 5.75 0 1 0 7 7z" />
  </svg>
)

/** The freshed mark: a phone outline with a fresh leaf of content sliding in. */
export const Mark = (p: P) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden {...p}>
    <rect
      x="5"
      y="1.5"
      width="14"
      height="21"
      rx="4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    />
    <rect x="8.25" y="6" width="7.5" height="4.5" rx="1.25" fill="var(--signal)" />
    <rect x="8.25" y="12.5" width="7.5" height="1.75" rx=".875" fill="currentColor" opacity=".35" />
    <rect
      x="8.25"
      y="15.75"
      width="4.5"
      height="1.75"
      rx=".875"
      fill="currentColor"
      opacity=".35"
    />
  </svg>
)
