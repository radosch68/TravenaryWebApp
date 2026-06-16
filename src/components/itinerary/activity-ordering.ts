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
  time?: string
  timeEnd?: string
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
// section breaks and prose per the chosen scope). Returns null when nothing
// should move: the activity is untimed, missing, the only timed tile, or already
// correctly placed relative to its timed neighbours.
export function planActivityReposition(
  tilesInDocOrder: ReadonlyArray<OrderableActivity>,
  changedId: string,
): RepositionPlan | null {
  const changedIndex = tilesInDocOrder.findIndex((tile) => tile.id === changedId)
  if (changedIndex === -1) {
    return null
  }

  const changed = tilesInDocOrder[changedIndex]
  if (!isActivityTimed(changed)) {
    return null
  }

  const timedOthers = tilesInDocOrder.filter((tile) => tile.id !== changedId && isActivityTimed(tile))
  if (timedOthers.length === 0) {
    return null
  }

  // Already correctly placed if it sits at/after the previous timed tile and
  // at/before the next timed tile in document order.
  const prevTimed = [...tilesInDocOrder.slice(0, changedIndex)].reverse().find(isActivityTimed)
  const nextTimed = tilesInDocOrder.slice(changedIndex + 1).find(isActivityTimed)
  const afterPrev = !prevTimed || compareTimedActivities(prevTimed, changed) <= 0
  const beforeNext = !nextTimed || compareTimedActivities(changed, nextTimed) <= 0
  if (afterPrev && beforeNext) {
    return null
  }

  // Slot it immediately before the first timed tile it strictly precedes;
  // otherwise after the last timed tile.
  const before = timedOthers.find((tile) => compareTimedActivities(changed, tile) < 0)
  return { beforeId: before ? before.id : null }
}
