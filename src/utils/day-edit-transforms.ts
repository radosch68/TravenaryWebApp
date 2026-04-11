import type { ItineraryActivity } from '@/services/contracts'
import {
  flattenSectionsToActivities,
  groupActivitiesForPlanning,
  type PlanningSection,
} from '@/utils/activity-classification'

/**
 * Shared mutation helpers for block/activity insert, move, split, delete, and empty-block cleanup.
 * Used by both the day editor and the itinerary overview page.
 */

/** Reorder an activity within the same block */
export function reorderActivityInBlock(
  sections: PlanningSection[],
  blockKey: string,
  oldIndex: number,
  newIndex: number,
): PlanningSection[] {
  return sections.map((section) => {
    const key = sectionKey(section)
    if (key !== blockKey) return section

    const activities = [...section.activities]
    const [moved] = activities.splice(oldIndex, 1)
    activities.splice(newIndex, 0, moved)
    return { ...section, activities }
  })
}

/** Insert a new activity into a specific block at a given position */
export function insertActivityInBlock(
  sections: PlanningSection[],
  blockKey: string,
  activity: ItineraryActivity,
  position?: number,
): PlanningSection[] {
  return sections.map((section) => {
    const key = sectionKey(section)
    if (key !== blockKey) return section

    const activities = [...section.activities]
    const insertAt = position ?? activities.length
    activities.splice(insertAt, 0, activity)
    return { ...section, activities }
  })
}

/** Insert a new activity into its own flexible block immediately after the given block */
export function insertActivityAsNewBlock(
  sections: PlanningSection[],
  blockKey: string,
  activity: ItineraryActivity,
  dividerLabel?: string,
): PlanningSection[] {
  const nextSections: PlanningSection[] = []
  let inserted = false
  const normalizedLabel = dividerLabel?.trim()

  for (const section of sections) {
    nextSections.push(section)

    if (inserted || sectionKey(section) !== blockKey) {
      continue
    }

    nextSections.push({
      type: 'flexible',
      blockIndex: -1,
      dividerId: crypto.randomUUID(),
      ...(normalizedLabel ? { dividerLabel: normalizedLabel } : {}),
      activities: [activity],
    })
    inserted = true
  }

  return inserted ? cleanupEmptyBlocks(nextSections) : sections
}

/** Delete an activity by ID from any section, with auto-cleanup of empty blocks */
export function deleteActivity(
  sections: PlanningSection[],
  activityId: string,
): PlanningSection[] {
  const updated = sections.map((section) => ({
    ...section,
    activities: section.activities.filter((a) => a.id !== activityId),
  }))
  return cleanupEmptyBlocks(updated)
}

/** Update an activity in place across all sections */
export function updateActivity(
  sections: PlanningSection[],
  updatedActivity: ItineraryActivity,
): PlanningSection[] {
  return sections.map((section) => ({
    ...section,
    activities: section.activities.map((a) =>
      a.id === updatedActivity.id ? updatedActivity : a,
    ),
  }))
}

/** Move an activity from one block to another at a specific position */
export function moveActivityBetweenBlocks(
  sections: PlanningSection[],
  activityId: string,
  targetBlockKey: string,
  targetPosition: number,
): PlanningSection[] {
  // Find and remove the activity from its source
  let movedActivity: ItineraryActivity | undefined
  const afterRemove = sections.map((section) => {
    const idx = section.activities.findIndex((a) => a.id === activityId)
    if (idx === -1) return section
    movedActivity = section.activities[idx]
    return {
      ...section,
      activities: section.activities.filter((_, i) => i !== idx),
    }
  })

  if (!movedActivity) return sections

  // Insert into target block
  const afterInsert = afterRemove.map((section) => {
    const key = sectionKey(section)
    if (key !== targetBlockKey) return section
    const activities = [...section.activities]
    activities.splice(targetPosition, 0, movedActivity!)
    return { ...section, activities }
  })

  return groupActivitiesForPlanning(
    flattenSectionsToActivities(cleanupEmptyBlocks(afterInsert)),
  ).sections
}

/** Break a flexible block into individual activities (removes the divider grouping) */
export function breakBlock(
  sections: PlanningSection[],
  blockKey: string,
): PlanningSection[] {
  const result: PlanningSection[] = []
  let flexCounter = 0
  for (const section of sections) {
    const key = sectionKey(section)
    if (key !== blockKey || section.type !== 'flexible') {
      if (section.type === 'flexible') {
        result.push({ ...section, blockIndex: flexCounter++ })
      } else {
        result.push(section)
      }
      continue
    }

    // Replace the block with individual flexible sections (no divider)
    for (const [index, activity] of section.activities.entries()) {
      result.push({
        type: 'flexible',
        blockIndex: flexCounter++,
        ...(index > 0 ? { dividerId: crypto.randomUUID() } : {}),
        activities: [activity],
      })
    }
  }

  return result
}

/** Remove empty flexible blocks (blocks with no activities after mutations) */
export function cleanupEmptyBlocks(sections: PlanningSection[]): PlanningSection[] {
  const filtered = sections.filter((section) => {
    if (section.type === 'anchored' && section.activities.length === 0) return false
    if (section.type === 'flexible' && section.activities.length === 0) return false
    return true
  })

  // Renumber flexible block indices
  let flexIndex = 0
  return filtered.map((section) => {
    if (section.type === 'flexible') {
      return { ...section, blockIndex: flexIndex++ }
    }
    return section
  })
}

/** Generate a stable key for a section */
export function sectionKey(section: PlanningSection): string {
  if (section.type === 'anchored') {
    return `anchored-${section.activities[0]?.id ?? 'empty'}`
  }
  return `flex-${section.blockIndex}`
}
