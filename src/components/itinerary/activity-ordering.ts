// Time-based ordering for activities within a day, per the sorting-rules table.
//
// Each activity reduces to a sort key (start*, end*) with the missing field
// falling back to the other one:
//   start* = time   ?? timeEnd   (From, else To)
//   end*   = timeEnd ?? time     (To, else From)
// Order is ascending by start*, then by end*. This is provably equivalent to the
// table's "(s1 < s2) OR (e1 < e2)" predicate for every non-overlapping pair, and
// it deterministically resolves the overlapping/nested pairs the raw predicate
// leaves contradictory (earlier start wins, then earlier end). An activity with
// neither time field is non-comparable and keeps its manual position.

export interface OrderableActivity {
  id: string
  type?: string
  time?: string
  timeEnd?: string
}

// Activity types that change timezone and therefore act as hard ordering
// boundaries: auto-reordering never moves a tile across one, so an origin-local
// time is never compared against a destination-local time. Flight is the first
// such type; the set is the home for the "TZ-changing activity" concept.
const TIMEZONE_BOUNDARY_TYPES: ReadonlySet<string> = new Set(['flight'])

export function isTimezoneBoundary(activity: OrderableActivity): boolean {
  return activity.type !== undefined && TIMEZONE_BOUNDARY_TYPES.has(activity.type)
}

function sortKey(activity: OrderableActivity): [string, string] | null {
  const start = activity.time?.trim() || activity.timeEnd?.trim() || ''
  const end = activity.timeEnd?.trim() || activity.time?.trim() || ''
  if (!start || !end) {
    return null
  }
  return [start, end]
}

export function isActivityTimed(activity: OrderableActivity): boolean {
  return sortKey(activity) !== null
}

// Strict order between two timed activities: -1 if `a` precedes `b`, 1 if it
// follows, 0 if their keys are equal. Both activities must be timed.
function compareTimedActivities(a: OrderableActivity, b: OrderableActivity): number {
  const ka = sortKey(a)
  const kb = sortKey(b)
  if (!ka || !kb) {
    return 0
  }
  if (ka[0] !== kb[0]) {
    return ka[0] < kb[0] ? -1 : 1
  }
  if (ka[1] !== kb[1]) {
    return ka[1] < kb[1] ? -1 : 1
  }
  return 0
}

export interface RepositionPlan {
  // Move the changed activity to sit immediately before the tile with this id,
  // or — when null — after the last timed tile in the day.
  beforeId: string | null
}

// Decide whether and where to move the changed activity within the day's
// activity tiles (given in document order, across the whole day, ignoring
// section breaks and prose per the chosen scope — but never crossing a timezone
// boundary such as a flight). Returns null when nothing should move: the
// activity is untimed, a boundary itself, missing, alone in its segment, or
// already correctly placed relative to its timed neighbours in the segment.
export function planActivityReposition(
  tilesInDocOrder: ReadonlyArray<OrderableActivity>,
  changedId: string,
): RepositionPlan | null {
  const changedIndex = tilesInDocOrder.findIndex((tile) => tile.id === changedId)
  if (changedIndex === -1) {
    return null
  }

  const changed = tilesInDocOrder[changedIndex]
  // Boundary tiles (flights) are placed manually and never auto-moved.
  if (isTimezoneBoundary(changed) || !isActivityTimed(changed)) {
    return null
  }

  // Confine ordering to the segment between the surrounding boundary tiles, so
  // the activity never crosses a flight (and an origin-local time is never
  // compared against a destination-local time).
  let segmentStart = 0
  for (let index = changedIndex - 1; index >= 0; index -= 1) {
    if (isTimezoneBoundary(tilesInDocOrder[index])) {
      segmentStart = index + 1
      break
    }
  }
  let segmentEnd = tilesInDocOrder.length
  let trailingBoundaryId: string | null = null
  for (let index = changedIndex + 1; index < tilesInDocOrder.length; index += 1) {
    if (isTimezoneBoundary(tilesInDocOrder[index])) {
      segmentEnd = index
      trailingBoundaryId = tilesInDocOrder[index].id
      break
    }
  }
  const segment = tilesInDocOrder.slice(segmentStart, segmentEnd)
  const segmentIndex = changedIndex - segmentStart

  const timedOthers = segment.filter((tile) => tile.id !== changedId && isActivityTimed(tile))
  if (timedOthers.length === 0) {
    return null
  }

  // Already correctly placed if it sits at/after the previous timed tile and
  // at/before the next timed tile within its segment.
  const prevTimed = [...segment.slice(0, segmentIndex)].reverse().find(isActivityTimed)
  const nextTimed = segment.slice(segmentIndex + 1).find(isActivityTimed)
  const afterPrev = !prevTimed || compareTimedActivities(prevTimed, changed) <= 0
  const beforeNext = !nextTimed || compareTimedActivities(changed, nextTimed) <= 0
  if (afterPrev && beforeNext) {
    return null
  }

  // Slot it immediately before the first timed tile in the segment it strictly
  // precedes; otherwise at the segment's end — before the trailing boundary if
  // there is one, else at the end of the day.
  const before = timedOthers.find((tile) => compareTimedActivities(changed, tile) < 0)
  return { beforeId: before ? before.id : trailingBoundaryId }
}
