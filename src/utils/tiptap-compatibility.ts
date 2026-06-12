import type { DayDocumentNode, ItineraryActivity, ItineraryDay } from '@/services/contracts'

function cloneActivity(activity: ItineraryActivity): ItineraryActivity {
  return {
    ...activity,
    references: activity.references ? [...activity.references] : [],
    locations: activity.locations ? [...activity.locations] : [],
    details: activity.details ? { ...activity.details } : undefined,
  }
}

function collectTileActivities(nodes: DayDocumentNode[], activities: ItineraryActivity[] = []): ItineraryActivity[] {
  nodes.forEach((node) => {
    if (node.type === 'activityTile') {
      const activity = node.attrs?.activity as ItineraryActivity | undefined
      if (activity?.id) {
        activities.push(cloneActivity(activity))
      }
    }

    if (Array.isArray(node.content) && node.content.length > 0) {
      collectTileActivities(node.content, activities)
    }
  })

  return activities
}

export function toDayActivities(day: Pick<ItineraryDay, 'document'>): ItineraryActivity[] {
  return collectTileActivities(day.document ?? [])
}
