import { Extension, Node, mergeAttributes, type JSONContent, type Range } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { TextSelection } from '@tiptap/pm/state'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Suggestion } from '@tiptap/suggestion'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { ActivityType, DayDocumentNode, ItineraryActivity, ItineraryDay } from '@/services/contracts'
import {
  ActivityTile,
  ACTIVITY_EDITOR_CONFIRMED_EVENT,
  ACTIVITY_TILE_LABELS_CHANGED_EVENT,
  createActivityTileNode,
  type ActivityTileLabels,
  type PhotoThumbnailSize,
} from '@/tiptap/activity-tile-extension'
import { formatLocalTimeRange } from '@/utils/date-format'
import { toDayActivities } from '@/utils/tiptap-compatibility'

import styles from './DayRichTextEditor.module.css'

type DaySavePayload = Omit<ItineraryDay, 'date'> & { activityBench?: ItineraryActivity[] }

export type DayRichTextSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface DayRichTextEditorHistoryState {
  canUndo: boolean
  canRedo: boolean
}

export interface DayRichTextEditorHistoryActions {
  undo: () => void
  redo: () => void
}

interface DayRichTextEditorProps {
  day: ItineraryDay
  locale: string
  photoThumbnailSize: PhotoThumbnailSize
  activityBench?: ItineraryActivity[]
  onActivityBench?: (activity: ItineraryActivity) => void
  onDaySave: (day: DaySavePayload) => Promise<void>
  onEditorActivate?: () => void
  onSaveStateChange?: (state: DayRichTextSaveState) => void
  onDocumentDraftChange?: (dayNumber: number, document: DayDocumentNode[]) => void
  onHistoryStateChange?: (state: DayRichTextEditorHistoryState) => void
  onHistoryActionsChange?: (actions: DayRichTextEditorHistoryActions | null) => void
}

type SlashMenuPath = 'root' | 'activity' | 'format' | 'bench'

type SlashCommandKind = 'group' | 'command'

type SlashCommand = {
  id: string
  label: string
  kind: SlashCommandKind
  searchTerms: string[]
  menuPath?: Exclude<SlashMenuPath, 'root'>
  parentPath?: Exclude<SlashMenuPath, 'root'>
  benchActivityId?: string
  run?: (range: Range) => void
}

type SlashMenuPosition = {
  left: number
  top: number
}

const AUTOSAVE_DELAY_MS = 7000
const TOP_DROP_ZONE_PX = 36
const SLASH_MENU_CURSOR_GAP_PX = 6
const SLASH_MENU_EDGE_GAP_PX = 6
// Hover-intent delay before a highlighted group auto-opens its submenu
// (also used by the back item to navigate one level up).
const SLASH_SUBMENU_HOVER_OPEN_DELAY_MS = 1000
const USE_MODAL_ACTIVITY_EDITOR = true

const SectionBreak = Node.create({
  name: 'sectionBreak',
  group: 'block',
  content: 'inline*',
  selectable: false,
  draggable: false,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="section-break"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: styles.sectionBreak,
        'data-type': 'section-break',
      }),
      0,
    ]
  },
})

function tokenizeSlashText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
}

function getSlashCommandMatchRank(command: SlashCommand, query: string): number | null {
  const primaryTokens = [command.label, command.id].flatMap(tokenizeSlashText)
  const aliasTokens = command.searchTerms.flatMap(tokenizeSlashText)

  if (primaryTokens.some((token) => token.startsWith(query))) {
    return 0
  }

  if (query.length > 1 && aliasTokens.some((token) => token.startsWith(query))) {
    return 1
  }

  return null
}

const BENCH_SLASH_TYPE_ORDER: ActivityType[] = [
  'tour',
  'poi',
  'food',
  'shopping',
  'accommodation',
  'flight',
  'transfer',
  'carRental',
  'custom',
  'note',
]

function buildBenchSlashCommands(
  activityBench: ItineraryActivity[],
  groupLabel: string,
  insertBenchActivity: (activity: ItineraryActivity, range?: Range) => void,
): SlashCommand[] {
  const benchItems = activityBench
    .filter((activity) => activity.type !== 'divider')
    .toSorted((first, second) => {
      const typeDelta = BENCH_SLASH_TYPE_ORDER.indexOf(first.type) - BENCH_SLASH_TYPE_ORDER.indexOf(second.type)
      return typeDelta !== 0 ? typeDelta : first.title.localeCompare(second.title)
    })

  if (benchItems.length === 0) {
    return []
  }

  return [
    {
      id: 'bench-group',
      label: groupLabel,
      kind: 'group',
      menuPath: 'bench',
      searchTerms: ['bench', 'unscheduled', 'extra'],
    },
    ...benchItems.map(
      (activity): SlashCommand => ({
        id: `bench-${activity.id}`,
        label: activity.title,
        kind: 'command',
        parentPath: 'bench',
        benchActivityId: activity.id,
        searchTerms: ['bench', activity.type],
        run: (range) => {
          insertBenchActivity(activity, range)
        },
      }),
    ),
  ]
}

function cloneDocument(nodes: DayDocumentNode[]): DayDocumentNode[] {
  return JSON.parse(JSON.stringify(nodes)) as DayDocumentNode[]
}

function toEditorContent(document: DayDocumentNode[]): JSONContent {
  return {
    type: 'doc',
    content: document.length > 0 ? (cloneDocument(document) as JSONContent[]) : [{ type: 'paragraph' }],
  }
}

function fromEditorContent(content: JSONContent): DayDocumentNode[] {
  return ((content.content ?? []) as DayDocumentNode[]).filter((node) => node.type !== 'doc')
}

function createClientActivityId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `activity-${crypto.randomUUID()}`
  }

  return `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toNewActivity(type: Exclude<ActivityType, 'divider'>, title: string): ItineraryActivity {
  const activity: ItineraryActivity = {
    id: createClientActivityId(),
    type,
    title,
    anchorDate: null,
    references: [],
    locations: [],
  }

  if (type === 'accommodation') {
    activity.details = { nights: 1 }
  }

  return activity
}

export function DayRichTextEditor({
  day,
  locale,
  photoThumbnailSize,
  activityBench,
  onActivityBench,
  onDaySave,
  onEditorActivate,
  onSaveStateChange,
  onDocumentDraftChange,
  onHistoryStateChange,
  onHistoryActionsChange,
}: DayRichTextEditorProps): ReactElement {
  const { t } = useTranslation('common')
  const [documentNodes, setDocumentNodes] = useState<DayDocumentNode[]>(() => cloneDocument(day.document ?? []))
  const [saveState, setSaveState] = useState<DayRichTextSaveState>('idle')
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashMenuPosition, setSlashMenuPosition] = useState<SlashMenuPosition | null>(null)
  const [slashMenuItems, setSlashMenuItems] = useState<SlashCommand[]>([])
  const [slashMenuPath, setSlashMenuPath] = useState<SlashMenuPath>('root')
  const [slashQuery, setSlashQuery] = useState('')
  // -1 means no item is highlighted; only arrow keys or pointer hover set one.
  const [slashActiveIndex, setSlashActiveIndex] = useState(-1)
  const [editVersion, setEditVersion] = useState(0)
  const activityTileLabels = useMemo<ActivityTileLabels>(
    () => ({
      locale,
      activityEditorLabel: t('itineraryView.richEditor.activityEditorLabel'),
      deleteActivity: t('itineraryView.richEditor.deleteActivity'),
      deleteDialog: {
        title: t('itineraryView.richEditor.deleteDialog.title'),
        message: t('itineraryView.richEditor.deleteDialog.message'),
        bench: t('itineraryView.richEditor.deleteDialog.bench'),
        delete: t('itineraryView.richEditor.deleteDialog.delete'),
        benchBlockedAnchored: t('itineraryView.richEditor.deleteDialog.benchBlockedAnchored'),
      },
      cancelEdit: t('cancel'),
      confirmEdit: t('save'),
      titleFallback: t('itineraryView.richEditor.titleFallback'),
      fields: {
        title: t('itineraryView.richEditor.fields.title'),
        time: t('itineraryView.richEditor.fields.time'),
        notes: t('itineraryView.richEditor.fields.notes'),
      },
      display: {
        anchored: t('itineraryView.anchored'),
        nights: (count) => t('itineraryView.nights', { count }),
        guidanceGuided: t('itineraryView.guidanceGuided'),
        guidanceSelfGuided: t('itineraryView.guidanceSelfGuided'),
        cuisineLabel: (cuisine) => t('itineraryView.cuisineLabel', { cuisine }),
        transferRouteFrom: t('itineraryView.transferRouteFrom'),
        transferRouteTo: t('itineraryView.transferRouteTo'),
        transferMotLabel: t('itineraryView.transferMotLabel'),
        transferMotOptions: {
          walk: t('itineraryView.transferMot.walk'),
          bike: t('itineraryView.transferMot.bike'),
          motorcycle: t('itineraryView.transferMot.motorcycle'),
          car: t('itineraryView.transferMot.car'),
          bus: t('itineraryView.transferMot.bus'),
          train: t('itineraryView.transferMot.train'),
          plane: t('itineraryView.transferMot.plane'),
        },
        transferEstimateLabel: t('itineraryView.transferEstimateLabel'),
        transferEstimateUnavailable: t('itineraryView.transferEstimateUnavailable'),
        accommodationSummaryNights: t('itineraryView.accommodationSummaryNights'),
        accommodationSummaryCheckIn: t('itineraryView.accommodationSummaryCheckIn'),
        accommodationSummaryCheckOut: t('itineraryView.accommodationSummaryCheckOut'),
        accommodationSummaryEmpty: t('itineraryView.accommodationSummaryEmpty'),
        accommodationFieldGuests: t('itineraryView.accommodationFieldGuests'),
        accommodationFieldPlatform: t('itineraryView.accommodationFieldPlatform'),
        accommodationFieldContactPhone: t('itineraryView.accommodationFieldContactPhone'),
        accommodationFieldContactEmail: t('itineraryView.accommodationFieldContactEmail'),
        accommodationFieldBookingRef: t('itineraryView.accommodationFieldBookingRef'),
        platformOptions: {
          booking: t('itineraryView.platformOptions.booking'),
          airbnb: t('itineraryView.platformOptions.airbnb'),
          agoda: t('itineraryView.platformOptions.agoda'),
          direct: t('itineraryView.platformOptions.direct'),
          other: t('itineraryView.platformOptions.other'),
        },
        locationFallback: t('itineraryView.locationFallback'),
        openReferenceAria: (label) => t('itineraryView.openReferenceAria', { label }),
        openMapAria: (label) => t('itineraryView.openMapAria', { label }),
      },
    }),
    [locale, t],
  )
  const documentNodesRef = useRef(documentNodes)
  const activityBenchRef = useRef(activityBench)
  const onActivityBenchRef = useRef(onActivityBench)
  // Set once the delete dialog benches an activity in this editor; from then on
  // day saves include the (page-owned, optimistically updated) bench so the
  // addition persists atomically with the tile removal.
  const benchTouchedRef = useRef(false)
  const editVersionRef = useRef(editVersion)
  const lastSavedEditVersionRef = useRef(0)
  const labelsRef = useRef<ActivityTileLabels>(activityTileLabels)
  const saveSequenceRef = useRef(0)
  const slashCommandsRef = useRef<SlashCommand[]>([])
  const slashMenuItemsRef = useRef<SlashCommand[]>([])
  const slashMenuPathRef = useRef<SlashMenuPath>('root')
  const slashQueryRef = useRef('')
  const slashActiveIndexRef = useRef(-1)
  const slashClientRectRef = useRef<(() => DOMRect | null) | null>(null)
  const slashCommandRunnerRef = useRef<((command: SlashCommand) => void) | null>(null)
  const slashItemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const slashMenuRef = useRef<HTMLDivElement | null>(null)
  const saveStateChangeRef = useRef(onSaveStateChange)
  const documentDraftChangeRef = useRef(onDocumentDraftChange)
  const historyStateChangeRef = useRef(onHistoryStateChange)
  const historyActionsChangeRef = useRef(onHistoryActionsChange)
  const photoThumbnailSizeRef = useRef(photoThumbnailSize)

  useEffect(() => {
    documentNodesRef.current = documentNodes
  }, [documentNodes])

  useEffect(() => {
    activityBenchRef.current = activityBench
  }, [activityBench])

  useEffect(() => {
    onActivityBenchRef.current = onActivityBench
  }, [onActivityBench])

  useEffect(() => {
    editVersionRef.current = editVersion
  }, [editVersion])

  useEffect(() => {
    labelsRef.current = activityTileLabels

    window.dispatchEvent(new Event(ACTIVITY_TILE_LABELS_CHANGED_EVENT))
  }, [activityTileLabels])

  useEffect(() => {
    saveStateChangeRef.current = onSaveStateChange
  }, [onSaveStateChange])

  useEffect(() => {
    documentDraftChangeRef.current = onDocumentDraftChange
  }, [onDocumentDraftChange])

  useEffect(() => {
    historyStateChangeRef.current = onHistoryStateChange
  }, [onHistoryStateChange])

  useEffect(() => {
    historyActionsChangeRef.current = onHistoryActionsChange
  }, [onHistoryActionsChange])

  useEffect(() => {
    photoThumbnailSizeRef.current = photoThumbnailSize
  }, [photoThumbnailSize])

  useEffect(() => {
    saveStateChangeRef.current?.(saveState)
  }, [saveState])

  useEffect(() => {
    documentDraftChangeRef.current?.(day.dayNumber, cloneDocument(documentNodes))
  }, [day.dayNumber, documentNodes])

  useEffect(() => {
    slashMenuItemsRef.current = slashMenuItems
  }, [slashMenuItems])

  useEffect(() => {
    slashMenuPathRef.current = slashMenuPath
  }, [slashMenuPath])

  useEffect(() => {
    slashActiveIndexRef.current = slashActiveIndex
  }, [slashActiveIndex])

  const markDirty = useCallback((): void => {
    setSaveState('dirty')
    setEditVersion((previousValue) => previousValue + 1)
  }, [])

  const slashHoverSubmenuTimerRef = useRef<number | null>(null)

  const clearSlashHoverSubmenuTimer = useCallback((): void => {
    if (slashHoverSubmenuTimerRef.current !== null) {
      window.clearTimeout(slashHoverSubmenuTimerRef.current)
      slashHoverSubmenuTimerRef.current = null
    }
  }, [])

  useEffect(() => clearSlashHoverSubmenuTimer, [clearSlashHoverSubmenuTimer])

  const closeSlashMenu = useCallback((): void => {
    clearSlashHoverSubmenuTimer()
    setSlashMenuOpen(false)
    setSlashMenuPosition(null)
    setSlashMenuItems([])
    setSlashMenuPath('root')
    setSlashQuery('')
    setSlashActiveIndex(-1)
    slashActiveIndexRef.current = -1
    slashMenuPathRef.current = 'root'
    slashQueryRef.current = ''
    slashClientRectRef.current = null
    slashCommandRunnerRef.current = null
  }, [clearSlashHoverSubmenuTimer])

  const setSlashActiveCommandIndex = useCallback((index: number): void => {
    slashActiveIndexRef.current = index
    setSlashActiveIndex(index)
  }, [])

  const getDocumentActivityIds = useCallback((): Set<string> => {
    return new Set(toDayActivities({ document: documentNodesRef.current }).map((activity) => activity.id))
  }, [])

  // Bench commands for activities already inserted in this document are hidden;
  // when none remain, the bench group disappears from the root menu too.
  const getAvailableSlashCommands = useCallback((): SlashCommand[] => {
    const commands = slashCommandsRef.current
    if (!commands.some((command) => command.benchActivityId)) {
      return commands.filter((command) => command.menuPath !== 'bench')
    }

    const documentActivityIds = getDocumentActivityIds()
    const available = commands.filter(
      (command) => !command.benchActivityId || !documentActivityIds.has(command.benchActivityId),
    )
    if (available.some((command) => command.benchActivityId)) {
      return available
    }

    return available.filter((command) => command.menuPath !== 'bench')
  }, [getDocumentActivityIds])

  const resolveSlashMenuItems = useCallback((query: string): SlashCommand[] => {
    const normalizedQuery = query.trim().toLowerCase()
    const commands = getAvailableSlashCommands()

    if (normalizedQuery.length > 0) {
      return commands
        .flatMap((command) => {
          if (command.kind !== 'command') {
            return []
          }

          const rank = getSlashCommandMatchRank(command, normalizedQuery)
          return rank === null ? [] : [{ command, rank }]
        })
        .sort((first, second) => first.rank - second.rank || first.command.label.localeCompare(second.command.label))
        .map((match) => match.command)
    }

    if (slashMenuPathRef.current === 'root') {
      return commands.filter((command) => command.kind === 'group')
    }

    return commands.filter((command) => command.parentPath === slashMenuPathRef.current)
  }, [getAvailableSlashCommands])

  const updateSlashMenuPosition = useCallback((): void => {
    const menuElement = slashMenuRef.current
    const getClientRect = slashClientRectRef.current
    const referenceRect = getClientRect?.()

    if (!menuElement || !referenceRect) {
      return
    }

    const referenceElement = {
      getBoundingClientRect: () => referenceRect,
    }

    void computePosition(referenceElement, menuElement, {
      placement: 'bottom-start',
      strategy: 'fixed',
      middleware: [
        offset(SLASH_MENU_CURSOR_GAP_PX),
        flip({ padding: SLASH_MENU_EDGE_GAP_PX }),
        shift({ padding: SLASH_MENU_EDGE_GAP_PX }),
      ],
    }).then(({ x, y }) => {
      setSlashMenuPosition({ left: x, top: y })
    })
  }, [])

  const openSlashSubmenu = useCallback(
    (path: Exclude<SlashMenuPath, 'root'>): void => {
      clearSlashHoverSubmenuTimer()
      slashQueryRef.current = ''
      setSlashQuery('')
      const items = getAvailableSlashCommands().filter((command) => command.parentPath === path)
      slashMenuPathRef.current = path
      setSlashMenuPath(path)
      setSlashMenuItems(items)
      setSlashMenuOpen(items.length > 0)
      setSlashActiveCommandIndex(-1)
      window.requestAnimationFrame(updateSlashMenuPosition)
    },
    [clearSlashHoverSubmenuTimer, getAvailableSlashCommands, setSlashActiveCommandIndex, updateSlashMenuPosition],
  )

  const openSlashRootMenu = useCallback((): void => {
    clearSlashHoverSubmenuTimer()
    slashQueryRef.current = ''
    setSlashQuery('')
    const items = getAvailableSlashCommands().filter((command) => command.kind === 'group')
    slashMenuPathRef.current = 'root'
    setSlashMenuPath('root')
    setSlashMenuItems(items)
    setSlashMenuOpen(items.length > 0)
    setSlashActiveCommandIndex(-1)
    window.requestAnimationFrame(updateSlashMenuPosition)
  }, [clearSlashHoverSubmenuTimer, getAvailableSlashCommands, setSlashActiveCommandIndex, updateSlashMenuPosition])

  const saveStateLabel = useMemo(() => {
    if (saveState === 'saving') {
      return t('itineraryView.richEditor.saving')
    }

    if (saveState === 'saved') {
      return t('itineraryView.richEditor.saved')
    }

    if (saveState === 'error') {
      return t('itineraryView.richEditor.saveError')
    }

    if (saveState === 'dirty') {
      return t('itineraryView.richEditor.unsaved')
    }

    return t('itineraryView.richEditor.ready')
  }, [saveState, t])

  const buildSavePayload = useCallback((): DaySavePayload => {
    const payload: DaySavePayload = {
      dayNumber: day.dayNumber,
      document: cloneDocument(documentNodesRef.current),
    }

    // Bench activities inserted via /bench keep their id; once one appears in
    // the document, the same save removes it from the bench atomically. The
    // reverse direction (delete dialog's "bench" choice) updates the bench
    // optimistically at page level and marks this editor bench-touched so the
    // save persists it. Filtering against document ids keeps both directions
    // self-healing: an undone removal puts the activity back in the document,
    // which excludes it from the bench again.
    const benchItems = activityBenchRef.current ?? []
    const documentActivityIds = getDocumentActivityIds()
    const hasConsumedBenchItems = benchItems.some((item) => documentActivityIds.has(item.id))

    if (hasConsumedBenchItems || benchTouchedRef.current) {
      payload.activityBench = benchItems.filter((item) => !documentActivityIds.has(item.id))
    }

    return payload
  }, [day.dayNumber, getDocumentActivityIds])

  const saveNow = useCallback((): void => {
    const currentEditVersion = editVersionRef.current
    if (currentEditVersion === 0 || currentEditVersion === lastSavedEditVersionRef.current) {
      return
    }

    const sequence = saveSequenceRef.current + 1
    saveSequenceRef.current = sequence
    setSaveState('saving')

    void onDaySave(buildSavePayload())
      .then(() => {
        if (saveSequenceRef.current === sequence) {
          lastSavedEditVersionRef.current = Math.max(lastSavedEditVersionRef.current, currentEditVersion)
        }

        if (saveSequenceRef.current === sequence && currentEditVersion === editVersionRef.current) {
          setSaveState('saved')
        }
      })
      .catch(() => {
        if (saveSequenceRef.current === sequence) {
          setSaveState('error')
        }
      })
  }, [buildSavePayload, onDaySave])

  const saveNowRef = useRef(saveNow)

  useEffect(() => {
    saveNowRef.current = saveNow
  }, [saveNow])

  const hasUnsavedChanges = useCallback((): boolean => {
    return editVersionRef.current !== 0 && editVersionRef.current !== lastSavedEditVersionRef.current
  }, [])

  // Flush pending edits when the editor unmounts (e.g. SPA navigation) so the
  // 7s autosave delay cannot silently discard recent changes.
  useEffect(() => {
    return () => {
      saveNowRef.current()
    }
  }, [])

  // Closing or reloading the tab cannot reliably await the save request, so
  // start a best-effort save and ask the browser to warn about unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!hasUnsavedChanges()) {
        return
      }

      saveNowRef.current()
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [hasUnsavedChanges])

  useEffect(() => {
    const onActivityEditorConfirmed = (): void => {
      // Let TipTap flush attribute changes first, then persist immediately.
      window.setTimeout(() => {
        saveNow()
      }, 0)
    }

    window.addEventListener(ACTIVITY_EDITOR_CONFIRMED_EVENT, onActivityEditorConfirmed)

    return () => {
      window.removeEventListener(ACTIVITY_EDITOR_CONFIRMED_EVENT, onActivityEditorConfirmed)
    }
  }, [saveNow])

  const slashCommandExtension = useMemo(
    () =>
      // TipTap Suggestion callbacks run outside React render, so refs bridge
      // current command state into the ProseMirror plugin lifecycle.
      // eslint-disable-next-line react-hooks/refs
      Extension.create({
        name: 'slashCommand',

        addProseMirrorPlugins() {
          return [
            Suggestion<SlashCommand, SlashCommand>({
              editor: this.editor,
              char: '/',
              allowedPrefixes: null,
              items: ({ query }) => {
                const normalizedQuery = query.trim().toLowerCase()
                slashQueryRef.current = normalizedQuery
                return resolveSlashMenuItems(normalizedQuery)
              },
              command: ({ range, props }) => {
                if (props.kind === 'group' && props.menuPath) {
                  openSlashSubmenu(props.menuPath)
                  return
                }

                props.run?.(range)
              },
              render: () => ({
                onStart: (props) => {
                  slashClientRectRef.current = props.clientRect ?? null
                  slashCommandRunnerRef.current = props.command
                  const normalizedQuery = props.query.trim().toLowerCase()
                  slashQueryRef.current = normalizedQuery
                  setSlashQuery(normalizedQuery)
                  if (normalizedQuery.length === 0) {
                    slashMenuPathRef.current = 'root'
                    setSlashMenuPath('root')
                  }
                  setSlashMenuItems(props.items)
                  setSlashActiveCommandIndex(-1)
                  setSlashMenuOpen(props.items.length > 0)
                  window.requestAnimationFrame(updateSlashMenuPosition)
                },
                onUpdate: (props) => {
                  slashClientRectRef.current = props.clientRect ?? null
                  slashCommandRunnerRef.current = props.command
                  const normalizedQuery = props.query.trim().toLowerCase()
                  const previousQuery = slashQueryRef.current
                  slashQueryRef.current = normalizedQuery
                  setSlashQuery(normalizedQuery)
                  if (normalizedQuery.length > 0 && slashMenuPathRef.current !== 'root') {
                    slashMenuPathRef.current = 'root'
                    setSlashMenuPath('root')
                  }
                  setSlashMenuItems(props.items)
                  setSlashMenuOpen(props.items.length > 0)
                  setSlashActiveCommandIndex(
                    normalizedQuery !== previousQuery
                      ? -1
                      : Math.min(slashActiveIndexRef.current, props.items.length - 1),
                  )
                  window.requestAnimationFrame(updateSlashMenuPosition)
                },
                onKeyDown: ({ event }) => {
                  const items = slashMenuItemsRef.current

                  if (event.key === 'Escape') {
                    if (slashMenuPathRef.current !== 'root' && slashQueryRef.current.length === 0) {
                      openSlashRootMenu()
                    } else {
                      closeSlashMenu()
                    }
                    return true
                  }

                  if (items.length === 0) {
                    return false
                  }

                  if (event.key === 'ArrowDown') {
                    setSlashActiveCommandIndex((slashActiveIndexRef.current + 1) % items.length)
                    return true
                  }

                  if (event.key === 'ArrowUp') {
                    setSlashActiveCommandIndex(
                      slashActiveIndexRef.current < 0
                        ? items.length - 1
                        : (slashActiveIndexRef.current - 1 + items.length) % items.length,
                    )
                    return true
                  }

                  if (event.key === 'Home') {
                    setSlashActiveCommandIndex(0)
                    return true
                  }

                  if (event.key === 'End') {
                    setSlashActiveCommandIndex(items.length - 1)
                    return true
                  }

                  if (event.key === 'ArrowLeft' && slashMenuPathRef.current !== 'root' && slashQueryRef.current.length === 0) {
                    openSlashRootMenu()
                    return true
                  }

                  if (event.key === 'ArrowRight') {
                    const selectedCommand = items[slashActiveIndexRef.current]
                    if (selectedCommand?.kind === 'group' && selectedCommand.menuPath) {
                      openSlashSubmenu(selectedCommand.menuPath)
                      return true
                    }
                  }

                  if (event.key === 'Enter' || event.key === 'Tab') {
                    // With no highlighted item, Enter picks the top match.
                    const selectedCommand = items[slashActiveIndexRef.current] ?? items[0]
                    if (selectedCommand) {
                      slashCommandRunnerRef.current?.(selectedCommand)
                    }
                    return true
                  }

                  return false
                },
                onExit: () => {
                  closeSlashMenu()
                },
              }),
            }),
          ]
        },
      }),
    [
      closeSlashMenu,
      openSlashRootMenu,
      openSlashSubmenu,
      resolveSlashMenuItems,
      setSlashActiveCommandIndex,
      updateSlashMenuPosition,
    ],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading'
            ? t('itineraryView.richEditor.headingPlaceholder')
            : t('itineraryView.richEditor.placeholder'),
      }),
      SectionBreak,
      slashCommandExtension,
      // TipTap node views are not React descendants of this component, so refs bridge
      // current day state into the extension callbacks without recreating the editor.
      // eslint-disable-next-line react-hooks/refs
      ActivityTile.configure({
        dayNumber: day.dayNumber,
        useModalEditor: USE_MODAL_ACTIVITY_EDITOR,
        photoThumbnailSize,
        getPhotoThumbnailSize: () => photoThumbnailSizeRef.current,
        getActivityTypeLabel: (activity) => t(`itineraryView.activityType.${activity.type}`),
        getActivityMeta: (activity) => {
          const timeRange = formatLocalTimeRange(activity.time, activity.timeEnd, locale)
          return timeRange ? [timeRange] : []
        },
        getLabels: () => labelsRef.current,
        onActivityOpen: () => undefined,
        onActivityDelete: () => undefined,
        onActivityBench: (activity) => {
          benchTouchedRef.current = true
          onActivityBenchRef.current?.(activity)
          markDirty()
        },
      }),
    ],
    content: toEditorContent(day.document ?? []),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: styles.editorSurface,
        'aria-label': t('itineraryView.richEditor.editorAria', { dayNumber: day.dayNumber }),
      },
      handleDOMEvents: {
        pointerdown: () => {
          onEditorActivate?.()
          return false
        },
        dragover: (view, event) => {
          const editorElement = view.dom as HTMLElement
          const editorRect = editorElement.getBoundingClientRect()
          const isTopDropZone =
            event.clientY >= editorRect.top && event.clientY <= editorRect.top + TOP_DROP_ZONE_PX

          if (isTopDropZone && view.state.selection.from !== 1) {
            const transaction = view.state.tr.setSelection(
              // Bias near-top drags to the document start so the drop cursor remains
              // available before the first visible line.
              TextSelection.atStart(view.state.doc),
            )
            view.dispatch(transaction)
          }

          return false
        },
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape') {
          closeSlashMenu()
          return false
        }

        return false
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const editorDocument = fromEditorContent(activeEditor.getJSON())
      setDocumentNodes(editorDocument)
      markDirty()
    },
    onFocus: () => {
      onEditorActivate?.()
    },
  })

  const emitHistoryState = useCallback((activeEditor = editor): void => {
    if (!activeEditor) {
      historyStateChangeRef.current?.({ canUndo: false, canRedo: false })
      return
    }

    historyStateChangeRef.current?.({
      canUndo: activeEditor.can().undo(),
      canRedo: activeEditor.can().redo(),
    })
  }, [editor])

  useEffect(() => {
    if (!editor) {
      emitHistoryState(undefined)
      historyActionsChangeRef.current?.(null)
      return
    }

    const handleHistoryChange = (): void => {
      emitHistoryState(editor)
    }

    const historyActions: DayRichTextEditorHistoryActions = {
      undo: () => {
        onEditorActivate?.()
        editor.commands.undo()
        emitHistoryState(editor)
      },
      redo: () => {
        onEditorActivate?.()
        editor.commands.redo()
        emitHistoryState(editor)
      },
    }

    historyActionsChangeRef.current?.(historyActions)
    handleHistoryChange()
    editor.on('transaction', handleHistoryChange)

    return () => {
      editor.off('transaction', handleHistoryChange)
      historyActionsChangeRef.current?.(null)
    }
  }, [editor, emitHistoryState, onEditorActivate])

  useEffect(() => {
    if (editVersion === 0 || editVersion === lastSavedEditVersionRef.current) {
      return undefined
    }

    const handle = window.setTimeout(() => {
      saveNow()
    }, AUTOSAVE_DELAY_MS)

    return () => {
      window.clearTimeout(handle)
    }
  }, [editVersion, saveNow])

  const setLink = useCallback((range?: Range): void => {
    if (!editor) {
      return
    }

    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt(t('itineraryView.richEditor.linkPrompt'), previousUrl ?? 'https://')

    if (url === null) {
      return
    }

    const command = editor.chain().focus()
    if (range) {
      command.deleteRange(range)
    }

    if (url.trim().length === 0) {
      command.extendMarkRange('link').unsetLink().run()
      return
    }

    command.extendMarkRange('link').setLink({ href: url.trim() }).run()
  }, [editor, t])

  const insertActivity = useCallback(
    (type: Exclude<ActivityType, 'divider'>, range?: Range): void => {
      if (!editor) {
        return
      }

      const activity = toNewActivity(type, t(`itineraryView.richEditor.newActivityTitle.${type}`))
      const command = editor.chain().focus()

      if (range) {
        command.deleteRange(range)
      }

      command
        .insertContent([createActivityTileNode(activity), { type: 'paragraph' }])
        .run()

      setSlashMenuOpen(false)
      setSlashMenuPosition(null)
      setSlashActiveIndex(-1)
      markDirty()
    },
    [editor, markDirty, t],
  )

  const insertBenchActivity = useCallback(
    (activity: ItineraryActivity, range?: Range): void => {
      if (!editor) {
        return
      }

      const benchActivity: ItineraryActivity = { ...structuredClone(activity), anchorDate: null }
      const command = editor.chain().focus()

      if (range) {
        command.deleteRange(range)
      }

      command
        .insertContent([createActivityTileNode(benchActivity), { type: 'paragraph' }])
        .run()

      setSlashMenuOpen(false)
      setSlashMenuPosition(null)
      setSlashActiveIndex(-1)
      markDirty()
    },
    [editor, markDirty],
  )

  const runDocumentCommand = useCallback(
    (command: 'heading' | 'list', range?: Range): void => {
      if (!editor) {
        return
      }

      const chain = editor.chain().focus()

      if (range) {
        chain.deleteRange(range)
      }

      if (command === 'heading') {
        chain.toggleHeading({ level: 2 }).run()
      } else {
        chain.toggleBulletList().run()
      }

      closeSlashMenu()
    },
    [closeSlashMenu, editor],
  )

  const runFormatCommand = useCallback(
    (
      command:
        | 'normal'
        | 'headingOne'
        | 'headingTwo'
        | 'bold'
        | 'italic'
        | 'underline'
        | 'bulletList'
        | 'orderedList'
        | 'blockquote'
        | 'link',
      range: Range,
    ): void => {
      if (!editor) {
        return
      }

      if (command === 'link') {
        setLink(range)
        closeSlashMenu()
        return
      }

      const chain = editor.chain().focus().deleteRange(range)

      if (command === 'normal') {
        chain
          .unsetBold()
          .unsetItalic()
          .unsetUnderline()
          .unsetLink()
          .unsetAllMarks()
          .setParagraph()
          .command(({ tr }) => {
            tr.setStoredMarks([])
            return true
          })
          .run()
      } else if (command === 'headingOne') {
        chain.toggleHeading({ level: 1 }).run()
      } else if (command === 'headingTwo') {
        chain.toggleHeading({ level: 2 }).run()
      } else if (command === 'bold') {
        chain.toggleBold().run()
      } else if (command === 'italic') {
        chain.toggleItalic().run()
      } else if (command === 'underline') {
        chain.toggleUnderline().run()
      } else if (command === 'bulletList') {
        chain.toggleBulletList().run()
      } else if (command === 'orderedList') {
        chain.toggleOrderedList().run()
      } else {
        chain.toggleBlockquote().run()
      }

      closeSlashMenu()
    },
    [closeSlashMenu, editor, setLink],
  )

  const slashCommands = useMemo<SlashCommand[]>(
    () => [
      {
        id: 'activity-group',
        label: t('itineraryView.richEditor.slash.activityGroup'),
        kind: 'group',
        menuPath: 'activity',
        searchTerms: ['activities', 'aa'],
      },
      {
        id: 'format-group',
        label: t('itineraryView.richEditor.slash.formatGroup'),
        kind: 'group',
        menuPath: 'format',
        searchTerms: ['text', 'style'],
      },
      {
        id: 'accommodation',
        label: t('itineraryView.richEditor.slash.accommodation'),
        kind: 'command',
        parentPath: 'activity',
        searchTerms: ['hotel', 'stay'],
        run: (range) => {
          insertActivity('accommodation', range)
        },
      },
      {
        id: 'flight',
        label: t('itineraryView.richEditor.slash.flight'),
        kind: 'command',
        parentPath: 'activity',
        searchTerms: ['plane', 'airport'],
        run: (range) => {
          insertActivity('flight', range)
        },
      },
      {
        id: 'food',
        label: t('itineraryView.richEditor.slash.food'),
        kind: 'command',
        parentPath: 'activity',
        searchTerms: ['restaurant', 'meal'],
        run: (range) => {
          insertActivity('food', range)
        },
      },
      {
        id: 'note',
        label: t('itineraryView.richEditor.slash.note'),
        kind: 'command',
        parentPath: 'activity',
        searchTerms: ['text'],
        run: (range) => {
          insertActivity('note', range)
        },
      },
      {
        id: 'place',
        label: t('itineraryView.richEditor.slash.place'),
        kind: 'command',
        parentPath: 'activity',
        searchTerms: ['poi', 'location'],
        run: (range) => {
          insertActivity('poi', range)
        },
      },
      {
        id: 'transfer',
        label: t('itineraryView.richEditor.slash.transfer'),
        kind: 'command',
        parentPath: 'activity',
        searchTerms: ['transport', 'taxi', 'train'],
        run: (range) => {
          insertActivity('transfer', range)
        },
      },
      {
        id: 'normal',
        label: t('itineraryView.richEditor.normalText'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['paragraph', 'regular', 'text'],
        run: (range) => {
          runFormatCommand('normal', range)
        },
      },
      {
        id: 'heading-one',
        label: t('itineraryView.richEditor.headingOne'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['h1', 'title'],
        run: (range) => {
          runFormatCommand('headingOne', range)
        },
      },
      {
        id: 'heading',
        label: t('itineraryView.richEditor.slash.heading'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['title', 'h2'],
        run: (range) => {
          runDocumentCommand('heading', range)
        },
      },
      {
        id: 'list',
        label: t('itineraryView.richEditor.slash.list'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['bullet', 'bullets'],
        run: (range) => {
          runDocumentCommand('list', range)
        },
      },
      {
        id: 'numbered-list',
        label: t('itineraryView.richEditor.slash.numberedList'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['ordered', 'number', 'numbers'],
        run: (range) => {
          runFormatCommand('orderedList', range)
        },
      },
      {
        id: 'quote',
        label: t('itineraryView.richEditor.slash.quote'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['blockquote', 'citation'],
        run: (range) => {
          runFormatCommand('blockquote', range)
        },
      },
      {
        id: 'bold',
        label: t('itineraryView.richEditor.bold'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['strong'],
        run: (range) => {
          runFormatCommand('bold', range)
        },
      },
      {
        id: 'italic',
        label: t('itineraryView.richEditor.italic'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['italics', 'emphasis'],
        run: (range) => {
          runFormatCommand('italic', range)
        },
      },
      {
        id: 'underline',
        label: t('itineraryView.richEditor.underline'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['underlined'],
        run: (range) => {
          runFormatCommand('underline', range)
        },
      },
      {
        id: 'link',
        label: t('itineraryView.richEditor.link'),
        kind: 'command',
        parentPath: 'format',
        searchTerms: ['url', 'href'],
        run: (range) => {
          runFormatCommand('link', range)
        },
      },
      ...buildBenchSlashCommands(activityBench ?? [], t('itineraryView.richEditor.slash.benchGroup'), insertBenchActivity),
    ],
    [activityBench, insertActivity, insertBenchActivity, runDocumentCommand, runFormatCommand, t],
  )

  useEffect(() => {
    slashCommandsRef.current = slashCommands
  }, [slashCommands])

  useEffect(() => {
    if (!slashMenuOpen) {
      return
    }

    slashItemRefs.current[slashActiveIndex]?.scrollIntoView({ block: 'nearest' })
  }, [slashActiveIndex, slashMenuOpen])

  useEffect(() => {
    if (!slashMenuOpen) {
      return undefined
    }

    updateSlashMenuPosition()
    window.addEventListener('resize', updateSlashMenuPosition)
    window.addEventListener('scroll', updateSlashMenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateSlashMenuPosition)
      window.removeEventListener('scroll', updateSlashMenuPosition, true)
    }
  }, [slashMenuItems, slashMenuOpen, updateSlashMenuPosition])

  if (!editor) {
    return <p className={styles.statusText}>{t('loading')}</p>
  }

  return (
    <div className={styles.richEditor} data-day-rich-editor-root="true">
      <div className={styles.editorWrap}>
        <EditorContent editor={editor} />

        {slashMenuOpen ? (
          <div
            ref={slashMenuRef}
            className={styles.slashMenu}
            role="listbox"
            aria-label={t('itineraryView.richEditor.slashMenuAria')}
            aria-activedescendant={
              slashActiveIndex >= 0 && slashMenuItems[slashActiveIndex]
                ? `slash-command-${day.dayNumber}-${slashMenuItems[slashActiveIndex].id}`
                : undefined
            }
            onMouseLeave={() => {
              clearSlashHoverSubmenuTimer()
              setSlashActiveCommandIndex(-1)
            }}
            style={{
              left: slashMenuPosition?.left ?? SLASH_MENU_EDGE_GAP_PX,
              top: slashMenuPosition?.top ?? SLASH_MENU_EDGE_GAP_PX,
            }}
          >
            {slashQuery.length === 0 && slashMenuPath !== 'root' ? (
              <div className={styles.slashMenuHeader}>
                <button
                  type="button"
                  aria-label={t('itineraryView.richEditor.slash.back')}
                  onMouseEnter={() => {
                    clearSlashHoverSubmenuTimer()
                    slashHoverSubmenuTimerRef.current = window.setTimeout(() => {
                      slashHoverSubmenuTimerRef.current = null
                      openSlashRootMenu()
                    }, SLASH_SUBMENU_HOVER_OPEN_DELAY_MS)
                  }}
                  onMouseLeave={clearSlashHoverSubmenuTimer}
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                  onClick={openSlashRootMenu}
                >
                  ‹
                </button>
                <span>
                  {slashMenuPath === 'activity'
                    ? t('itineraryView.richEditor.slash.activityGroup')
                    : slashMenuPath === 'bench'
                      ? t('itineraryView.richEditor.slash.benchGroup')
                      : t('itineraryView.richEditor.slash.formatGroup')}
                </span>
              </div>
            ) : null}
            {slashMenuItems.map((command, index) => (
              <button
                key={command.id}
                id={`slash-command-${day.dayNumber}-${command.id}`}
                ref={(element) => {
                  slashItemRefs.current[index] = element
                }}
                type="button"
                role="option"
                aria-selected={slashActiveIndex === index}
                onMouseEnter={() => {
                  setSlashActiveCommandIndex(index)
                  clearSlashHoverSubmenuTimer()
                  const submenuPath = command.menuPath
                  if (command.kind === 'group' && submenuPath) {
                    slashHoverSubmenuTimerRef.current = window.setTimeout(() => {
                      slashHoverSubmenuTimerRef.current = null
                      openSlashSubmenu(submenuPath)
                    }, SLASH_SUBMENU_HOVER_OPEN_DELAY_MS)
                  }
                }}
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
                onClick={() => {
                  slashCommandRunnerRef.current?.(command)
                }}
              >
                <span>{command.label}</span>
                {command.kind === 'group' ? <span aria-hidden="true">›</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className={styles.statusText} role="status">
        {saveStateLabel}
      </p>
    </div>
  )
}
