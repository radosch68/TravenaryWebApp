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

// Journey activities that may end after midnight (timeEnd < time), producing an
// "arrival" trailing tile on the next day — the time-granular cousin of a span
// activity's day-granular checkout. Other timed activities keep treating a
// timeEnd before time as an input error (see validateActivity).
export const OVERNIGHT_ARRIVAL_TYPES: readonly ActivityType[] = ['flight', 'transfer']

// i18n key (common namespace) for the closure label on an overnight arrival's
// trailing tile (e.g. "Arrival: 00:30").
export const OVERNIGHT_ARRIVAL_LABEL_KEY = 'itineraryView.overnightArrivalLabel'

export function isOvernightArrivalType(type: ActivityType): boolean {
  return OVERNIGHT_ARRIVAL_TYPES.includes(type)
}

// Lucide icons (size 18) inlined for the live editor's DOM widget decoration,
// which renders outside React and can't use the icon component. Mirror the React
// ACTIVITY_TYPE_ICON for flight (Plane) and transfer (Route) so the live arrival
// tile matches the static one.
const PLANE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>'
const ROUTE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>'

const OVERNIGHT_ARRIVAL_ICON_SVG: Partial<Record<ActivityType, string>> = {
  flight: PLANE_ICON_SVG,
  transfer: ROUTE_ICON_SVG,
}

// Inline SVG icon for a trailing tile of `type`: a span config's icon, or the
// overnight journey-type icon. '' when none (callers render no icon).
export function getTrailingTileIconSvg(type: ActivityType): string {
  return getSpanActivityConfig(type)?.iconSvg ?? OVERNIGHT_ARRIVAL_ICON_SVG[type] ?? ''
}

// True when this activity is a journey type whose end time falls on the next
// day. Implicit overnight model: a populated timeEnd strictly before time means
// "+1 day" (see the overnight-handling discussion).
export function isOvernightArrival(activity: ItineraryActivity): boolean {
  if (!isOvernightArrivalType(activity.type)) {
    return false
  }

  const time = activity.time?.trim()
  const timeEnd = activity.timeEnd?.trim()
  return Boolean(time && timeEnd && timeEnd < time)
}

// The closure label key for a trailing tile of `type`: a span activity's
// check-out/return key, or the arrival key for overnight journey types. null
// when the type produces no trailing tile. Single source of truth shared by the
// static tile and the live-editor widget so their labels never drift.
export function getClosureLabelKey(type: ActivityType): string | null {
  const config = getSpanActivityConfig(type)
  if (config) {
    return config.checkoutLabelKey
  }

  return isOvernightArrivalType(type) ? OVERNIGHT_ARRIVAL_LABEL_KEY : null
}

// Footer warning for an overnight journey activity (flight/transfer ending after
// midnight) whose arrival day falls past the itinerary's last day, so no trailing
// arrival tile is produced. Mirrors getSpanBeyondItineraryFooterItems.
export function getOvernightBeyondItineraryFooterItems(
  activity: ItineraryActivity,
  dayNumber: number,
  lastDayNumber: number,
  labelByType: Partial<Record<ActivityType, string>>,
): ActivityFooterItem[] {
  if (lastDayNumber < 1 || !isOvernightArrival(activity)) {
    return []
  }

  if (dayNumber + 1 <= lastDayNumber) {
    return []
  }

  const text = labelByType[activity.type]
  return text ? [{ severity: 'warning', text }] : []
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
