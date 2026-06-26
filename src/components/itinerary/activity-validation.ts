import type { ActivityType, ItineraryActivity } from '@/services/contracts'
import {
  getSpanActivityConfig,
  getSpanBeyondItineraryFooterItems,
  getOvernightBeyondItineraryFooterItems,
  isOvernightArrivalType,
  type ActivityFooterItem,
} from '@/components/itinerary/span-activity'

// Pure, per-activity validation shared by the editor form (which blocks save on
// `error` issues) and the read-only tile footer (which surfaces every issue,
// `error` or `warning`, for content the form never gated — AI-generated drafts,
// legacy data, or activities edited elsewhere). Deliberately stateless and
// context-free: anything needing itinerary-wide context (e.g. a span running
// past the last day) lives in span-activity and is merged in below.

export type ActivityIssueSeverity = 'error' | 'warning'

export type ActivityIssueField =
  | 'title'
  | 'time'
  | 'transferRoute'
  | 'checkInWindow'
  | 'closureTime'

export interface ActivityIssue {
  field: ActivityIssueField
  severity: ActivityIssueSeverity
  // i18n key (common namespace) for the human-readable message.
  messageKey: string
}

// Fixed tier-1 message keys. Span-related warning keys come from the per-type
// SpanActivityConfig (missingClosureTimeLabelKey), so they aren't listed here.
export const ACTIVITY_VALIDATION_MESSAGE_KEYS = [
  'itineraryView.validation.titleRequired',
  'itineraryView.validation.timeEndBeforeStart',
  'itineraryView.validation.transferRouteIncomplete',
  'itineraryView.validation.checkInWindowInvalid',
] as const

export function validateActivity(activity: ItineraryActivity): ActivityIssue[] {
  const issues: ActivityIssue[] = []

  // Empty title.
  if (!activity.title?.trim()) {
    issues.push({ field: 'title', severity: 'error', messageKey: 'itineraryView.validation.titleRequired' })
  }

  // End time before start time — only when both are populated. For journey types
  // (flight/transfer) this is a valid overnight arrival (implicit "+1 day"),
  // shown via the "+1" badge and next-day arrival tile, so it is not an error;
  // for every other type it stays a blocking error.
  const time = activity.time?.trim()
  const timeEnd = activity.timeEnd?.trim()
  if (time && timeEnd && timeEnd < time && !isOvernightArrivalType(activity.type)) {
    issues.push({ field: 'time', severity: 'error', messageKey: 'itineraryView.validation.timeEndBeforeStart' })
  }

  const details = activity.details as Record<string, unknown> | undefined

  // Transfer must carry both endpoints or neither — one without the other is an
  // incomplete route. (The form drops a lone endpoint before reaching here, so
  // this mainly guards stored AI/legacy data; the form adds its own form-state
  // check for the partially-filled case.)
  if (activity.type === 'transfer' && details && Boolean(details.from) !== Boolean(details.to)) {
    issues.push({ field: 'transferRoute', severity: 'error', messageKey: 'itineraryView.validation.transferRouteIncomplete' })
  }

  // Accommodation check-in window: "from" must precede "until" when both set.
  // (Check-out is on a later day, so it is never compared against check-in.)
  if (activity.type === 'accommodation' && details) {
    const from = typeof details.checkInFrom === 'string' ? details.checkInFrom.trim() : ''
    const until = typeof details.checkInUntil === 'string' ? details.checkInUntil.trim() : ''
    if (from && until && from >= until) {
      issues.push({ field: 'checkInWindow', severity: 'error', messageKey: 'itineraryView.validation.checkInWindowInvalid' })
    }
  }

  // Span activity with a span set but no closure time (warning, not blocking).
  const spanConfig = getSpanActivityConfig(activity.type)
  if (spanConfig && details) {
    const spanValue = details[spanConfig.spanField]
    const span = typeof spanValue === 'number' ? Math.floor(spanValue) : 0
    const closure = details[spanConfig.closureTimeField]
    const hasClosure = typeof closure === 'string' && closure.trim().length > 0
    if (span >= 1 && !hasClosure) {
      issues.push({ field: 'closureTime', severity: 'warning', messageKey: spanConfig.missingClosureTimeLabelKey })
    }
  }

  return issues
}

function issuesToFooterItems(
  issues: ActivityIssue[],
  validationMessages: Record<string, string>,
): ActivityFooterItem[] {
  return issues
    .map((issue) => ({ severity: issue.severity, text: validationMessages[issue.messageKey] ?? '' }))
    .filter((item) => item.text.length > 0)
}

// All footer items for a tile: per-activity validation issues (errors surface
// here only for content the form didn't gate) merged with the itinerary-context
// span-beyond-last-day warning.
export function buildActivityFooterItems(
  activity: ItineraryActivity,
  context: {
    dayNumber: number
    lastDayNumber: number
    validationMessages: Record<string, string>
    spanBeyondLabelByType: Partial<Record<ActivityType, string>>
  },
): ActivityFooterItem[] {
  return [
    ...issuesToFooterItems(validateActivity(activity), context.validationMessages),
    ...getSpanBeyondItineraryFooterItems(
      activity,
      context.dayNumber,
      context.lastDayNumber,
      context.spanBeyondLabelByType,
    ),
    ...getOvernightBeyondItineraryFooterItems(
      activity,
      context.dayNumber,
      context.lastDayNumber,
      context.spanBeyondLabelByType,
    ),
  ]
}
