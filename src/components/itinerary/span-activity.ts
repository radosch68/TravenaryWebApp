import { BedDouble, KeyRound, type LucideIcon } from 'lucide-react'

import type { ActivityType } from '@/services/contracts'

// A "span" activity occupies a number of days and produces a virtual checkout
// (closure) tile on the day it ends — e.g. accommodation (nights, check-out) or,
// later, a car rental (days, return-by). Each entry below describes how to read
// the span and the closure deadline from the activity's details, plus how to
// present its checkout tile.
export interface SpanActivityConfig {
  type: ActivityType
  // Details field holding the span length in whole units (nights, days, …).
  spanField: 'nights' | 'days'
  // Details field holding the closure deadline time ("HH:MM").
  closureTimeField: 'checkOutUntil' | 'returnUntil'
  // Icon for the React-rendered checkout tile (static / read-only view).
  icon: LucideIcon
  // The same icon as an inline SVG (size 18) for the live editor's widget
  // decoration, which renders DOM outside React and can't use the component.
  iconSvg: string
  // i18n key (common namespace) for the closure label shown on the tile.
  checkoutLabelKey: string
}

// Lucide icons (size 18), inlined for the editor's DOM widget decoration.
const BED_DOUBLE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>'
const KEY_ROUND_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>'

// One entry per spanning activity type.
export const SPAN_ACTIVITY_CONFIGS: readonly SpanActivityConfig[] = [
  {
    type: 'accommodation',
    spanField: 'nights',
    closureTimeField: 'checkOutUntil',
    icon: BedDouble,
    iconSvg: BED_DOUBLE_ICON_SVG,
    checkoutLabelKey: 'itineraryView.accommodationSummaryCheckOut',
  },
  {
    type: 'rental',
    spanField: 'days',
    closureTimeField: 'returnUntil',
    icon: KeyRound,
    iconSvg: KEY_ROUND_ICON_SVG,
    checkoutLabelKey: 'itineraryView.rentalReturnBy',
  },
]

export function getSpanActivityConfig(type: ActivityType): SpanActivityConfig | undefined {
  return SPAN_ACTIVITY_CONFIGS.find((config) => config.type === type)
}
