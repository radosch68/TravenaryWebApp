import type { ActivityType, ItineraryActivity } from '@/services/contracts'
import { generateClientId } from '@/utils/client-id'

const ANCHORED_BY_DEFAULT: ReadonlySet<ActivityType> = new Set([
  'flight',
  'accommodation',
  'transfer',
])

export function isAnchoredByDefault(type: ActivityType): boolean {
  return ANCHORED_BY_DEFAULT.has(type)
}

export function getEffectiveAnchored(activity: ItineraryActivity): boolean {
  return activity.isAnchored
}

/* ---- Section-based grouping for Planning view ---- */

export type PlanningSection =
  | { type: 'anchored'; activities: ItineraryActivity[] }
  | { type: 'flexible'; blockIndex: number; dividerId?: string; dividerLabel?: string; activities: ItineraryActivity[] }

export interface PlanningDayGroups {
  sections: PlanningSection[]
  anchoredActivities: ItineraryActivity[]
  flexibleBlockCount: number
}

/**
 * Groups activities into interleaved sections preserving the original array order.
 *
 * Rules:
 * - Consecutive anchored activities form an `anchored` section.
 * - Consecutive flexible activities form a `flexible` section (block).
 * - A `divider` activity starts a new flexible block, taking the divider's title as the label.
 *   The divider itself is NOT included in the activity list — it's metadata.
 * - A leading divider labels the first flexible block of a day; otherwise the first flexible block
 *   is the implicit default block with no divider metadata.
 */
export function groupActivitiesForPlanning(activities: ItineraryActivity[]): PlanningDayGroups {
  const sections: PlanningSection[] = []
  const allAnchored: ItineraryActivity[] = []
  let flexibleBlockCount = 0

  let currentAnchored: ItineraryActivity[] = []
  let currentFlexible: ItineraryActivity[] = []
  let currentDividerId: string | undefined
  let currentDividerLabel: string | undefined

  function flushAnchored(): void {
    if (currentAnchored.length > 0) {
      sections.push({ type: 'anchored', activities: currentAnchored })
      allAnchored.push(...currentAnchored)
      currentAnchored = []
    }
  }

  function flushFlexible(): void {
    if (currentFlexible.length > 0) {
      sections.push({
        type: 'flexible',
        blockIndex: flexibleBlockCount,
        dividerId: currentDividerId,
        dividerLabel: currentDividerLabel,
        activities: currentFlexible,
      })
      flexibleBlockCount++
      currentFlexible = []
      currentDividerId = undefined
      currentDividerLabel = undefined
    }
  }

  for (const activity of activities) {
    if (activity.type === 'divider') {
      // Divider starts a new flexible block — flush any in-progress flexible block first
      flushFlexible()
      currentDividerId = activity.id
      currentDividerLabel = activity.title || undefined
      continue
    }

    if (getEffectiveAnchored(activity)) {
      flushFlexible()
      currentAnchored.push(activity)
    } else {
      flushAnchored()
      currentFlexible.push(activity)
    }
  }

  flushAnchored()
  flushFlexible()

  return { sections, anchoredActivities: allAnchored, flexibleBlockCount }
}

export function sortActivitiesForTimeline(activities: ItineraryActivity[]): ItineraryActivity[] {
  const timed: ItineraryActivity[] = []
  const untimed: ItineraryActivity[] = []

  for (const activity of activities) {
    if (activity.type === 'divider') {
      continue
    }

    if (activity.time) {
      timed.push(activity)
    } else {
      untimed.push(activity)
    }
  }

  timed.sort((a, b) => a.time!.localeCompare(b.time!))

  return [...timed, ...untimed]
}

/**
 * Converts sections back to a flat activity array, re-inserting divider activities
 * before each flexible block.
 */
export function flattenSectionsToActivities(sections: PlanningSection[]): ItineraryActivity[] {
  const result: ItineraryActivity[] = []
  let prevWasFlexible = false

  for (const section of sections) {
    if (section.type === 'anchored') {
      result.push(...section.activities)
      prevWasFlexible = false
    } else {
      if (section.dividerId !== undefined || section.dividerLabel !== undefined) {
        result.push({
          id: section.dividerId ?? generateClientId(),
          type: 'divider',
          title: section.dividerLabel ?? '',
          isAnchored: false,
        })
      } else if (prevWasFlexible) {
        // Insert empty divider to preserve block boundary
        result.push({
          id: generateClientId(),
          type: 'divider',
          title: '',
          isAnchored: false,
        })
      }
      result.push(...section.activities)
      prevWasFlexible = true
    }
  }
  return result
}
