import { create } from 'zustand'
import type { ItineraryActivity, ItineraryDay, ItineraryDetail } from '@/services/contracts'
import type { PlanningSection } from '@/utils/activity-classification'
import { groupActivitiesForPlanning, flattenSectionsToActivities } from '@/utils/activity-classification'
import {
  reorderActivityInBlock,
  insertActivityInBlock,
  insertActivityAsNewBlock,
  deleteActivity,
  updateActivity,
  moveActivityBetweenBlocks,
  breakBlock,
} from '@/utils/day-edit-transforms'

interface DayEditState {
  itineraryId: string | null
  dayNumber: number | null
  sections: PlanningSection[]

  // Lifecycle
  loadDay: (itinerary: ItineraryDetail, dayNumber: number) => boolean

  // Mutations
  reorderInBlock: (blockKey: string, oldIndex: number, newIndex: number) => void
  addActivity: (blockKey: string, activity: ItineraryActivity, position?: number) => void
  addActivityAsNewBlock: (blockKey: string, activity: ItineraryActivity, dividerLabel?: string) => void
  removeActivity: (activityId: string) => void
  editActivity: (updatedActivity: ItineraryActivity) => void
  editDividerLabel: (blockKey: string, newLabel: string) => void
  moveBetweenBlocks: (activityId: string, targetBlockKey: string, targetPosition: number) => void
  splitBlock: (blockKey: string) => void

  // Server sync
  applyServerState: (day: ItineraryDay) => void

  // Queries
  getFlatActivities: () => ItineraryActivity[]
}

export const useDayEditStore = create<DayEditState>((set, get) => ({
  itineraryId: null,
  dayNumber: null,
  sections: [],

  loadDay: (itinerary, dayNumber) => {
    const day = itinerary.days.find((d) => d.dayNumber === dayNumber)
    if (!day) return false

    const { sections } = groupActivitiesForPlanning(day.activities)
    set({
      itineraryId: itinerary.id,
      dayNumber,
      sections,
    })
    return true
  },

  reorderInBlock: (blockKey, oldIndex, newIndex) => {
    set((state) => ({
      sections: reorderActivityInBlock(state.sections, blockKey, oldIndex, newIndex),
    }))
  },

  addActivity: (blockKey, activity, position) => {
    set((state) => ({
      sections: insertActivityInBlock(state.sections, blockKey, activity, position),
    }))
  },

  addActivityAsNewBlock: (blockKey, activity, dividerLabel) => {
    set((state) => ({
      sections: insertActivityAsNewBlock(state.sections, blockKey, activity, dividerLabel),
    }))
  },

  removeActivity: (activityId) => {
    set((state) => ({
      sections: deleteActivity(state.sections, activityId),
    }))
  },

  editActivity: (updatedActivity) => {
    set((state) => ({
      sections: updateActivity(state.sections, updatedActivity),
    }))
  },

  editDividerLabel: (blockKey, newLabel) => {
    set((state) => ({
      sections: state.sections.map((s) => {
        if (s.type !== 'flexible') return s
        if (`flex-${s.blockIndex}` !== blockKey) return s
        return { ...s, dividerLabel: newLabel || undefined }
      }),
    }))
  },

  moveBetweenBlocks: (activityId, targetBlockKey, targetPosition) => {
    set((state) => ({
      sections: moveActivityBetweenBlocks(state.sections, activityId, targetBlockKey, targetPosition),
    }))
  },

  splitBlock: (blockKey) => {
    set((state) => ({
      sections: breakBlock(state.sections, blockKey),
    }))
  },

  applyServerState: (day) => {
    const { sections } = groupActivitiesForPlanning(day.activities)
    set({
      sections,
    })
  },

  getFlatActivities: () => {
    return flattenSectionsToActivities(get().sections)
  },
}))
