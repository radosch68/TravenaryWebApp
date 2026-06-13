import type { ItineraryActivity, ItineraryDay } from '@/services/contracts'
import { toDayActivities } from '@/utils/tiptap-compatibility'

/** An activity is anchored when it carries a non-empty explicit anchorDate. */
export function isActivityAnchored(activity: Pick<ItineraryActivity, 'anchorDate'>): boolean {
  return typeof activity.anchorDate === 'string' && activity.anchorDate.length > 0
}

/** True when any activity in the day's document is anchored. */
export function dayHasAnchoredActivity(day: Pick<ItineraryDay, 'document'>): boolean {
  return toDayActivities(day).some(isActivityAnchored)
}

/**
 * Highest dayNumber that contains an anchored activity, or 0 when none.
 *
 * Inserting a day before position P shifts the dates of every day >= P, and
 * deleting day D shifts every day > D — either silently re-dates anchored
 * activities, which the backend rejects with 409. Both operations are safe
 * exactly when their pivot lies strictly after the last anchored day, so this
 * single scalar drives all client-side eligibility:
 *   - insert before day P is allowed iff P > lastAnchoredDayNumber
 *   - delete day D is allowed iff D > lastAnchoredDayNumber
 * Inserting at the end (P = dayCount + 1) is therefore always allowed.
 */
export function getLastAnchoredDayNumber(days: ReadonlyArray<ItineraryDay>): number {
  let lastAnchored = 0
  for (const day of days) {
    if (day.dayNumber > lastAnchored && dayHasAnchoredActivity(day)) {
      lastAnchored = day.dayNumber
    }
  }
  return lastAnchored
}
