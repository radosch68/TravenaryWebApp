import { BedDouble, KeyRound, type LucideIcon } from 'lucide-react'

import type { ActivityType, ItineraryActivity } from '@/services/contracts'

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
  // i18n key (common namespace) for the footer warning shown on the source tile
  // when its span runs past the last day of the itinerary (closure falls off the
  // end, so no virtual checkout tile is produced).
  beyondItineraryLabelKey: string
  // i18n key (common namespace) for the footer warning shown when a span is set
  // but its closure time (check-out / return) is left empty.
  missingClosureTimeLabelKey: string
}

export type ActivityFooterSeverity = 'note' | 'warning' | 'error'

// A dynamic, non-persisted note/warning/error surfaced in an activity tile's
// footer. Computed at render time from itinerary context, never stored.
export interface ActivityFooterItem {
  severity: ActivityFooterSeverity
  text: string
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
    beyondItineraryLabelKey: 'itineraryView.footer.accommodationCheckOutBeyondItinerary',
    missingClosureTimeLabelKey: 'itineraryView.footer.accommodationCheckOutTimeMissing',
  },
  {
    type: 'rental',
    spanField: 'days',
    closureTimeField: 'returnUntil',
    icon: KeyRound,
    iconSvg: KEY_ROUND_ICON_SVG,
    checkoutLabelKey: 'itineraryView.rentalReturnBy',
    beyondItineraryLabelKey: 'itineraryView.footer.rentalReturnBeyondItinerary',
    missingClosureTimeLabelKey: 'itineraryView.footer.rentalReturnTimeMissing',
  },
]

export function getSpanActivityConfig(type: ActivityType): SpanActivityConfig | undefined {
  return SPAN_ACTIVITY_CONFIGS.find((config) => config.type === type)
}

// Footer warning for a span activity (accommodation, rental, …) whose span runs
// past the itinerary's last day — i.e. its closure (check-out / return) lands on
// a day that doesn't exist, so the user never sees a virtual checkout tile for
// it. `dayNumber` is the activity's own day; `lastDayNumber` the max day number
// in the itinerary. Returns [] when not a span activity, no/zero span, the span
// stays within the itinerary, or no localized text is supplied.
export function getSpanBeyondItineraryFooterItems(
  activity: ItineraryActivity,
  dayNumber: number,
  lastDayNumber: number,
  labelByType: Partial<Record<ActivityType, string>>,
): ActivityFooterItem[] {
  if (lastDayNumber < 1) {
    return []
  }

  const config = getSpanActivityConfig(activity.type)
  if (!config) {
    return []
  }

  const details = activity.details as Record<string, unknown> | undefined
  const spanValue = details?.[config.spanField]
  const span = typeof spanValue === 'number' ? Math.floor(spanValue) : 0
  if (span < 1 || dayNumber + span <= lastDayNumber) {
    return []
  }

  const text = labelByType[activity.type]
  return text ? [{ severity: 'warning', text }] : []
}
