import { RefreshCw, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { ItineraryDaysGrid, type PhotoThumbnailSize } from '@/components/itinerary/ItineraryDaysGrid'
import { DayShortcutsRow } from '@/components/itinerary/DayShortcutsRow'
import { ItineraryMapLauncher } from '@/components/itinerary/ItineraryMapLauncher'
import { ShareButton } from '@/components/itinerary/ShareButton'
import { buildLocationMapPinsFromDays } from '@/components/itinerary/location-map-pins'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { ApiError, type DayDocumentNode, type ItineraryActivity, type ItineraryDay, type ItineraryDetail } from '@/services/contracts'
import { updateLastOpenedItinerary } from '@/services/profile-service'
import { deleteItinerary, getItinerary, updateItinerary, updateItineraryDay } from '@/services/itinerary-service'
import { useProfileStore } from '@/store/profile-store'
import { formatLocalDate, parseIsoDate } from '@/utils/date-format'

import styles from './ItineraryViewPage.module.css'

type LoadState = 'loading' | 'ready' | 'error' | 'not-found'

type DaySavePayload = Omit<ItineraryDay, 'date'>

const PHOTO_THUMBNAIL_SIZE_STORAGE_KEY = 'travenary_photo_thumbnail_size'
const PHOTO_THUMBNAIL_SIZE_CHANGED_EVENT = 'travenary:photo-thumbnail-size-changed'

const PHOTO_THUMBNAIL_SIZE_OPTIONS: ReadonlyArray<{ value: PhotoThumbnailSize; labelKey: string }> = [
  { value: 'sm', labelKey: 'itineraryView.photoThumbnailSizeSmall' },
  { value: 'md', labelKey: 'itineraryView.photoThumbnailSizeMedium' },
  { value: 'lg', labelKey: 'itineraryView.photoThumbnailSizeLarge' },
]

function normalizePhotoThumbnailSize(value: string | null): PhotoThumbnailSize {
  if (value === 'sm' || value === 'md' || value === 'lg') {
    return value
  }

  return 'md'
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseIsoDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const parsedDate = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function shiftIsoDate(value: string, dayDelta: number): string {
  const parsedDate = parseIsoDateInput(value)
  if (!parsedDate) {
    return value
  }

  parsedDate.setDate(parsedDate.getDate() + dayDelta)
  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function toActivitySavePayload(activity: ItineraryActivity): ItineraryActivity {
  if (activity.type === 'accommodation' && !activity.details) {
    return {
      ...activity,
      details: {
        nights: 1,
      },
    }
  }

  if (activity.type === 'tour' && !activity.details?.guidanceMode) {
    return {
      ...activity,
      details: {
        ...activity.details,
        guidanceMode: 'selfGuided',
      },
    }
  }

  return activity
}

function toDocumentSavePayload(nodes: DayDocumentNode[]): DayDocumentNode[] {
  return nodes.map((node) => {
    const nextNode: DayDocumentNode = {
      ...node,
      attrs: node.attrs ? { ...node.attrs } : undefined,
      content: node.content ? toDocumentSavePayload(node.content) : undefined,
    }

    if (nextNode.type === 'activityTile' && nextNode.attrs?.activity) {
      const activity = nextNode.attrs.activity as ItineraryActivity
      nextNode.attrs.activity = toActivitySavePayload(activity)
    }

    return nextNode
  })
}

function mergeSavedDayIntoLatestItinerary(
  latestItinerary: ItineraryDetail,
  savedItinerary: ItineraryDetail,
  dayNumber: number,
): ItineraryDetail {
  const savedDay = savedItinerary.days.find((day) => day.dayNumber === dayNumber)
  if (!savedDay) {
    return latestItinerary
  }

  let replaced = false
  const mergedDays = latestItinerary.days.map((day) => {
    if (day.dayNumber !== dayNumber) {
      return day
    }

    replaced = true
    return savedDay
  })

  if (!replaced) {
    return latestItinerary
  }

  return {
    ...latestItinerary,
    schemaVer: savedItinerary.schemaVer,
    updatedAt: savedItinerary.updatedAt,
    days: mergedDays,
  }
}

function getUpcomingDaysLeft(startDate: string | undefined, todayIsoDate: string): number | null {
  if (!startDate || startDate <= todayIsoDate) {
    return null
  }

  const [todayYear, todayMonth, todayDay] = todayIsoDate.split('-').map(Number)
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay)
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay)
  const millisecondsPerDay = 24 * 60 * 60 * 1000

  const difference = Math.floor((startUtc - todayUtc) / millisecondsPerDay)
  return difference > 0 ? difference : null
}

type OngoingProgress = {
  totalHours: number
  hoursLeft: number
  elapsedPercent: number
}

function getOngoingProgress(
  startDate: string | undefined,
  endDate: string | undefined,
  dayCount: number,
  nowDate: Date,
): OngoingProgress | null {
  if (!startDate || !endDate || dayCount <= 0) {
    return null
  }

  const start = parseIsoDate(startDate)
  const endExclusive = parseIsoDate(endDate)
  start.setHours(0, 0, 0, 0)
  endExclusive.setHours(0, 0, 0, 0)
  endExclusive.setDate(endExclusive.getDate() + 1)

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    return null
  }

  if (nowDate < start || nowDate >= endExclusive) {
    return null
  }

  const totalHours = dayCount * 24
  const millisecondsPerHour = 60 * 60 * 1000
  const rawHoursLeft = (endExclusive.getTime() - nowDate.getTime()) / millisecondsPerHour
  const hoursLeft = Math.max(0, Math.min(totalHours, Math.ceil(rawHoursLeft)))
  const elapsedHours = Math.max(0, totalHours - hoursLeft)
  const elapsedPercent = totalHours > 0 ? (elapsedHours / totalHours) * 100 : 0

  return {
    totalHours,
    hoursLeft,
    elapsedPercent,
  }
}

export function ItineraryViewPage(): ReactElement {
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['common', 'errors'])
  const profileLastOpenedItineraryId = useProfileStore((state) => state.lastOpenedItinerary?.itineraryId ?? null)
  const setProfileStore = useProfileStore((state) => state.setProfile)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [dayCollapseCommandToken, setDayCollapseCommandToken] = useState(0)
  const [dayCollapseCommandMode, setDayCollapseCommandMode] = useState<'collapse-all' | 'expand-all' | undefined>(undefined)
  const [dayCollapseState, setDayCollapseState] = useState({ allCollapsed: false, allExpanded: true })
  const [isTitleEditing, setIsTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [isTitleSaving, setIsTitleSaving] = useState(false)
  const [titleSaveError, setTitleSaveError] = useState(false)
  const [isDescriptionEditing, setIsDescriptionEditing] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [isDescriptionSaving, setIsDescriptionSaving] = useState(false)
  const [descriptionSaveError, setDescriptionSaveError] = useState(false)
  const [isDateRangeEditing, setIsDateRangeEditing] = useState(false)
  const [dateFromDraft, setDateFromDraft] = useState('')
  const [dateToDraft, setDateToDraft] = useState('')
  const [isDateRangeSaving, setIsDateRangeSaving] = useState(false)
  const [dateRangeSaveError, setDateRangeSaveError] = useState(false)
  const [dateRangeValidationError, setDateRangeValidationError] = useState(false)
  const [isTagsEditing, setIsTagsEditing] = useState(false)
  const [tagsDraft, setTagsDraft] = useState('')
  const [isTagsSaving, setIsTagsSaving] = useState(false)
  const [tagsSaveError, setTagsSaveError] = useState(false)
  const [isCoverPhotoEditing, setIsCoverPhotoEditing] = useState(false)
  const [coverPhotoUrlDraft, setCoverPhotoUrlDraft] = useState('')
  const [coverPhotoCaptionDraft, setCoverPhotoCaptionDraft] = useState('')
  const [isCoverPhotoSaving, setIsCoverPhotoSaving] = useState(false)
  const [coverPhotoSaveError, setCoverPhotoSaveError] = useState(false)
  const [photoThumbnailSize, setPhotoThumbnailSize] = useState<PhotoThumbnailSize>(() => {
    if (typeof window === 'undefined') {
      return 'md'
    }

    return normalizePhotoThumbnailSize(window.localStorage.getItem(PHOTO_THUMBNAIL_SIZE_STORAGE_KEY))
  })
  const loadRequestSequenceRef = useRef(0)
  const itineraryRef = useRef<ItineraryDetail | null>(null)
  const skipTitleBlurSaveRef = useRef(false)
  const skipDescriptionBlurSaveRef = useRef(false)
  const skipDateRangeBlurSaveRef = useRef(false)
  const skipTagsBlurSaveRef = useRef(false)
  const skipCoverPhotoBlurSaveRef = useRef(false)
  const daySaveSequenceByDayRef = useRef<Record<number, number>>({})
  const daySaveQueueByDayRef = useRef<Record<number, Promise<void>>>({})
  const todayIsoDate = useMemo(() => getTodayIsoDate(), [])
  const nowDate = useMemo(() => new Date(), [])

  useEffect(() => {
    itineraryRef.current = itinerary
  }, [itinerary])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(PHOTO_THUMBNAIL_SIZE_STORAGE_KEY, photoThumbnailSize)
    window.dispatchEvent(
      new CustomEvent<{ size: PhotoThumbnailSize }>(PHOTO_THUMBNAIL_SIZE_CHANGED_EVENT, {
        detail: { size: photoThumbnailSize },
      }),
    )
  }, [photoThumbnailSize])

  const loadItinerary = useCallback(async (): Promise<void> => {
    const requestSequence = loadRequestSequenceRef.current + 1
    loadRequestSequenceRef.current = requestSequence

    if (!itineraryId) {
      if (loadRequestSequenceRef.current !== requestSequence) {
        return
      }

      setItinerary(null)
      setLoadState('not-found')
      return
    }

    setItinerary(null)
    setLoadState('loading')

    try {
      const payload = await getItinerary(itineraryId)

      if (loadRequestSequenceRef.current !== requestSequence) {
        return
      }

      setItinerary(payload)
      setLoadState('ready')
    } catch (error) {
      if (loadRequestSequenceRef.current !== requestSequence) {
        return
      }

      if (error instanceof ApiError && error.status === 404) {
        setLoadState('not-found')
        return
      }

      setLoadState('error')
    }
  }, [itineraryId])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadItinerary()
    }, 0)

    return () => {
      window.clearTimeout(handle)
    }
  }, [loadItinerary])

  useEffect(() => {
    if (!itinerary?.id) {
      return
    }

    if (profileLastOpenedItineraryId === itinerary.id) {
      return
    }

    void updateLastOpenedItinerary(itinerary.id)
      .then((updatedProfile) => {
        setProfileStore(
          updatedProfile.displayName ?? null,
          updatedProfile.email,
          updatedProfile.lastOpenedItinerary ?? null,
        )
      })
      .catch(() => {
        // Non-fatal: profile refresh will eventually re-sync persisted resume target.
      })
  }, [itinerary?.id, profileLastOpenedItineraryId, setProfileStore])

  const dateRangeLabel = useMemo(() => {
    if (!itinerary) {
      return ''
    }

    if (itinerary.startDate && itinerary.endDate) {
      return `${formatLocalDate(itinerary.startDate, i18n.language)} - ${formatLocalDate(itinerary.endDate, i18n.language)}`
    }

    if (itinerary.startDate) {
      return formatLocalDate(itinerary.startDate, i18n.language)
    }

    if (itinerary.endDate) {
      return formatLocalDate(itinerary.endDate, i18n.language)
    }

    return t('itineraryView.noDate')
  }, [i18n.language, itinerary, t])

  const itineraryMapPins = useMemo(() => {
    if (!itinerary) {
      return []
    }

    return buildLocationMapPinsFromDays(itinerary.days)
  }, [itinerary])

  const upcomingDaysLeft = useMemo(
    () => getUpcomingDaysLeft(itinerary?.startDate, todayIsoDate),
    [itinerary?.startDate, todayIsoDate],
  )

  const ongoingProgress = useMemo(
    () => getOngoingProgress(itinerary?.startDate, itinerary?.endDate, itinerary?.days.length ?? 0, nowDate),
    [itinerary?.days.length, itinerary?.endDate, itinerary?.startDate, nowDate],
  )

  const itineraryMapRoute = itinerary ? `/itineraries/${itinerary.id}/map` : null

  const handleCollapseAllDays = useCallback((): void => {
    setDayCollapseCommandMode('collapse-all')
    setDayCollapseCommandToken((previousValue) => previousValue + 1)
  }, [])

  const handleExpandAllDays = useCallback((): void => {
    setDayCollapseCommandMode('expand-all')
    setDayCollapseCommandToken((previousValue) => previousValue + 1)
  }, [])

  const handleDaySave = useCallback(async (updatedDay: DaySavePayload): Promise<void> => {
    const dayNumber = updatedDay.dayNumber
    const previousQueue = daySaveQueueByDayRef.current[dayNumber] ?? Promise.resolve()

    const queuedSave = previousQueue
      .catch(() => undefined)
      .then(async () => {
        const currentItinerary = itineraryRef.current
        if (!currentItinerary) {
          return
        }

        const saveSequence = (daySaveSequenceByDayRef.current[dayNumber] ?? 0) + 1
        daySaveSequenceByDayRef.current[dayNumber] = saveSequence
        const nextDays = currentItinerary.days.map((day) =>
          day.dayNumber === dayNumber
            ? {
                ...day,
                ...updatedDay,
              }
            : day,
        )
        const optimisticItinerary = {
          ...currentItinerary,
          days: nextDays,
        }

        itineraryRef.current = optimisticItinerary
        setItinerary(optimisticItinerary)

        const savedItinerary = await updateItineraryDay(currentItinerary.id, dayNumber, {
          summary: updatedDay.summary,
          document: toDocumentSavePayload(updatedDay.document ?? []),
        })

        if (daySaveSequenceByDayRef.current[dayNumber] !== saveSequence) {
          return
        }

        const latestItinerary = itineraryRef.current
        if (!latestItinerary) {
          return
        }

        const reconciledItinerary = mergeSavedDayIntoLatestItinerary(
          latestItinerary,
          savedItinerary,
          dayNumber,
        )

        itineraryRef.current = reconciledItinerary
        setItinerary(reconciledItinerary)
      })

    daySaveQueueByDayRef.current[dayNumber] = queuedSave

    try {
      await queuedSave
    } finally {
      if (daySaveQueueByDayRef.current[dayNumber] === queuedSave) {
        delete daySaveQueueByDayRef.current[dayNumber]
      }
    }
  }, [])

  const startTitleEdit = useCallback((): void => {
    if (!itineraryRef.current || isTitleSaving) {
      return
    }

    setTitleSaveError(false)
    setTitleDraft(itineraryRef.current.title)
    setIsTitleEditing(true)
  }, [isTitleSaving])

  const cancelTitleEdit = useCallback((): void => {
    if (isTitleSaving) {
      return
    }

    skipTitleBlurSaveRef.current = false
    setIsTitleEditing(false)
    setTitleDraft('')
    setTitleSaveError(false)
  }, [isTitleSaving])

  const saveTitleEdit = useCallback(async (): Promise<void> => {
    const currentItinerary = itineraryRef.current
    if (!currentItinerary || isTitleSaving) {
      return
    }

    const nextTitle = titleDraft.trim()
    if (nextTitle.length === 0 || nextTitle === currentItinerary.title) {
      cancelTitleEdit()
      return
    }

    setIsTitleSaving(true)
    setTitleSaveError(false)

    try {
      const saved = await updateItinerary(currentItinerary.id, { title: nextTitle })
      itineraryRef.current = saved
      setItinerary(saved)
    } catch {
      setTitleSaveError(true)
    } finally {
      setIsTitleSaving(false)
      setIsTitleEditing(false)
      setTitleDraft('')
    }
  }, [cancelTitleEdit, isTitleSaving, titleDraft])

  const startDescriptionEdit = useCallback((): void => {
    if (!itineraryRef.current || isDescriptionSaving) {
      return
    }

    setDescriptionSaveError(false)
    setDescriptionDraft(itineraryRef.current.description ?? '')
    setIsDescriptionEditing(true)
  }, [isDescriptionSaving])

  const cancelDescriptionEdit = useCallback((): void => {
    if (isDescriptionSaving) {
      return
    }

    skipDescriptionBlurSaveRef.current = false
    setIsDescriptionEditing(false)
    setDescriptionDraft('')
    setDescriptionSaveError(false)
  }, [isDescriptionSaving])

  const saveDescriptionEdit = useCallback(async (): Promise<void> => {
    const currentItinerary = itineraryRef.current
    if (!currentItinerary || isDescriptionSaving) {
      return
    }

    const trimmedDraft = descriptionDraft.trim()
    const nextDescription = trimmedDraft.length > 0 ? trimmedDraft : undefined
    const currentDescription = currentItinerary.description?.trim() ? currentItinerary.description.trim() : undefined

    if (nextDescription === currentDescription) {
      cancelDescriptionEdit()
      return
    }

    setIsDescriptionSaving(true)
    setDescriptionSaveError(false)

    try {
      const saved = await updateItinerary(currentItinerary.id, { description: nextDescription })
      itineraryRef.current = saved
      setItinerary(saved)
    } catch {
      setDescriptionSaveError(true)
    } finally {
      setIsDescriptionSaving(false)
      setIsDescriptionEditing(false)
      setDescriptionDraft('')
    }
  }, [cancelDescriptionEdit, descriptionDraft, isDescriptionSaving])

  const startDateRangeEdit = useCallback((): void => {
    const currentItinerary = itineraryRef.current
    if (!currentItinerary || isDateRangeSaving) {
      return
    }

    setDateRangeSaveError(false)
    setDateRangeValidationError(false)
    setDateFromDraft(currentItinerary.startDate ?? '')
    setDateToDraft(currentItinerary.endDate ?? '')
    setIsDateRangeEditing(true)
  }, [isDateRangeSaving])

  const cancelDateRangeEdit = useCallback((): void => {
    if (isDateRangeSaving) {
      return
    }

    skipDateRangeBlurSaveRef.current = false
    setIsDateRangeEditing(false)
    setDateFromDraft('')
    setDateToDraft('')
    setDateRangeSaveError(false)
    setDateRangeValidationError(false)
  }, [isDateRangeSaving])

  const saveDateRangeEdit = useCallback(async (): Promise<void> => {
    const currentItinerary = itineraryRef.current
    if (!currentItinerary || isDateRangeSaving) {
      return
    }

    const nextFrom = dateFromDraft.trim()
    const nextTo = dateToDraft.trim()

    if (nextFrom.length === 0 && nextTo.length === 0) {
      if (!currentItinerary.startDate) {
        cancelDateRangeEdit()
        return
      }

      setIsDateRangeSaving(true)
      setDateRangeSaveError(false)
      setDateRangeValidationError(false)

      try {
        const saved = await updateItinerary(currentItinerary.id, { startDate: null })
        itineraryRef.current = saved
        setItinerary(saved)
      } catch {
        setDateRangeSaveError(true)
      } finally {
        setIsDateRangeSaving(false)
        setIsDateRangeEditing(false)
        setDateFromDraft('')
        setDateToDraft('')
      }
      return
    }

    const parsedFrom = parseIsoDateInput(nextFrom)
    const parsedTo = parseIsoDateInput(nextTo)
    if (!parsedFrom || !parsedTo || parsedTo < parsedFrom) {
      setDateRangeValidationError(true)
      return
    }

    if (nextFrom === currentItinerary.startDate) {
      cancelDateRangeEdit()
      return
    }

    setIsDateRangeSaving(true)
    setDateRangeSaveError(false)
    setDateRangeValidationError(false)

    try {
      const saved = await updateItinerary(currentItinerary.id, { startDate: nextFrom })
      itineraryRef.current = saved
      setItinerary(saved)
    } catch {
      setDateRangeSaveError(true)
    } finally {
      setIsDateRangeSaving(false)
      setIsDateRangeEditing(false)
      setDateFromDraft('')
      setDateToDraft('')
    }
  }, [cancelDateRangeEdit, dateFromDraft, dateToDraft, isDateRangeSaving])

  const startTagsEdit = useCallback((): void => {
    const currentItinerary = itineraryRef.current
    if (!currentItinerary || isTagsSaving) {
      return
    }

    setTagsSaveError(false)
    setTagsDraft(currentItinerary.tags.join(', '))
    setIsTagsEditing(true)
  }, [isTagsSaving])

  const cancelTagsEdit = useCallback((): void => {
    if (isTagsSaving) {
      return
    }

    skipTagsBlurSaveRef.current = false
    setIsTagsEditing(false)
    setTagsDraft('')
    setTagsSaveError(false)
  }, [isTagsSaving])

  const saveTagsEdit = useCallback(async (): Promise<void> => {
    const currentItinerary = itineraryRef.current
    if (!currentItinerary || isTagsSaving) {
      return
    }

    const parsedTags = Array.from(
      new Set(
        tagsDraft
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    )

    if (areStringArraysEqual(parsedTags, currentItinerary.tags)) {
      cancelTagsEdit()
      return
    }

    setIsTagsSaving(true)
    setTagsSaveError(false)

    try {
      const saved = await updateItinerary(currentItinerary.id, { tags: parsedTags })
      itineraryRef.current = saved
      setItinerary(saved)
    } catch {
      setTagsSaveError(true)
    } finally {
      setIsTagsSaving(false)
      setIsTagsEditing(false)
      setTagsDraft('')
    }
  }, [cancelTagsEdit, isTagsSaving, tagsDraft])

  const startCoverPhotoEdit = useCallback((): void => {
    const currentItinerary = itineraryRef.current
    if (!currentItinerary || isCoverPhotoSaving) {
      return
    }

    setCoverPhotoSaveError(false)
    setCoverPhotoUrlDraft(currentItinerary.coverPhoto?.url ?? '')
    setCoverPhotoCaptionDraft(currentItinerary.coverPhoto?.caption ?? '')
    setIsCoverPhotoEditing(true)
  }, [isCoverPhotoSaving])

  const cancelCoverPhotoEdit = useCallback((): void => {
    if (isCoverPhotoSaving) {
      return
    }

    skipCoverPhotoBlurSaveRef.current = false
    setIsCoverPhotoEditing(false)
    setCoverPhotoUrlDraft('')
    setCoverPhotoCaptionDraft('')
    setCoverPhotoSaveError(false)
  }, [isCoverPhotoSaving])

  const saveCoverPhotoEdit = useCallback(async (): Promise<void> => {
    const currentItinerary = itineraryRef.current
    if (!currentItinerary || isCoverPhotoSaving) {
      return
    }

    const nextUrl = coverPhotoUrlDraft.trim()
    const nextCaption = coverPhotoCaptionDraft.trim()
    const nextCaptionValue = nextCaption.length > 0 ? nextCaption : undefined
    const currentUrl = currentItinerary.coverPhoto?.url?.trim() ?? ''
    const currentCaption = currentItinerary.coverPhoto?.caption?.trim() || undefined

    if (nextUrl.length === 0) {
      if (!currentItinerary.coverPhoto?.url) {
        cancelCoverPhotoEdit()
        return
      }

      setIsCoverPhotoSaving(true)
      setCoverPhotoSaveError(false)

      try {
        const saved = await updateItinerary(currentItinerary.id, { coverPhoto: null })
        itineraryRef.current = saved
        setItinerary(saved)
      } catch {
        setCoverPhotoSaveError(true)
      } finally {
        setIsCoverPhotoSaving(false)
        setIsCoverPhotoEditing(false)
        setCoverPhotoUrlDraft('')
        setCoverPhotoCaptionDraft('')
      }
      return
    }

    if (nextUrl === currentUrl && nextCaptionValue === currentCaption) {
      cancelCoverPhotoEdit()
      return
    }

    setIsCoverPhotoSaving(true)
    setCoverPhotoSaveError(false)

    try {
      const existingCoverPhoto = currentItinerary.coverPhoto
      const preserveExistingAttribution =
        existingCoverPhoto && nextUrl === currentUrl
          ? {
              source: existingCoverPhoto.source,
              authorName: existingCoverPhoto.authorName,
              authorUrl: existingCoverPhoto.authorUrl,
              sourceUrl: existingCoverPhoto.sourceUrl,
              downloadLocation: existingCoverPhoto.downloadLocation,
            }
          : {}

      const saved = await updateItinerary(currentItinerary.id, {
        coverPhoto: {
          ...preserveExistingAttribution,
          url: nextUrl,
          caption: nextCaptionValue,
          type: existingCoverPhoto?.type ?? 'photo',
        },
      })
      itineraryRef.current = saved
      setItinerary(saved)
    } catch {
      setCoverPhotoSaveError(true)
    } finally {
      setIsCoverPhotoSaving(false)
      setIsCoverPhotoEditing(false)
      setCoverPhotoUrlDraft('')
      setCoverPhotoCaptionDraft('')
    }
  }, [cancelCoverPhotoEdit, coverPhotoCaptionDraft, coverPhotoUrlDraft, isCoverPhotoSaving])

  async function onDelete(): Promise<void> {
    if (!itinerary || isDeleting) {
      return
    }

    setIsDeleting(true)
    setDeleteError(false)

    try {
      await deleteItinerary(itinerary.id)
      navigate('/itineraries')
    } catch {
      setDeleteError(true)
    } finally {
      setIsDeleting(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <AppShell>
        <section className={styles.stateCard}>
          <p>{t('common:loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (loadState === 'error') {
    return (
      <AppShell>
        <section className={styles.stateCard}>
          <p className={styles.errorText}>{t('errors:server')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadItinerary()
            }}
          >
            <RefreshCw aria-hidden="true" />
            {t('itineraryView.retry')}
          </Button>
        </section>
      </AppShell>
    )
  }

  if (loadState === 'not-found' || !itinerary) {
    return (
      <AppShell>
        <section className={styles.stateCard}>
          <p>{t('itineraryView.notFound')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/itineraries')}>
            {t('itineraryView.backToListing')}
          </Button>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.headerCard}>
          <div className={styles.headerMain}>
            <div className={styles.kickerRow}>
              <p className={styles.kicker}>{t('itineraryView.ownerKicker')}</p>

              <div className={styles.headerTopActions}>
                <ShareButton
                  itineraryId={itinerary.id}
                  hasShareLink={itinerary.hasShareLink}
                  onShareChange={(hasShareLink) => {
                    setItinerary((previousValue) =>
                      previousValue ? { ...previousValue, hasShareLink } : previousValue,
                    )
                  }}
                />
              </div>
            </div>
            {isTitleEditing ? (
              <form
                className={styles.titleEditForm}
                onBlurCapture={(event) => {
                  const nextTarget = event.relatedTarget
                  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                    return
                  }

                  if (skipTitleBlurSaveRef.current) {
                    skipTitleBlurSaveRef.current = false
                    return
                  }

                  void saveTitleEdit()
                }}
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveTitleEdit()
                }}
              >
                <input
                  type="text"
                  className={styles.titleInput}
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  disabled={isTitleSaving}
                  aria-label={t('itineraryView.edit')}
                  autoFocus
                />
                <div className={styles.titleEditActions}>
                  <button
                    type="button"
                    className={styles.titleCancelButton}
                    onPointerDown={() => {
                      skipTitleBlurSaveRef.current = true
                    }}
                    onClick={cancelTitleEdit}
                    disabled={isTitleSaving}
                    aria-label={t('itineraryView.cancel')}
                  >
                    ✕
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className={styles.titleDisplayButton}
                onClick={startTitleEdit}
                aria-label={t('itineraryView.editTitleAria')}
              >
                <h1 className={styles.title}>{itinerary.title}</h1>
              </button>
            )}
            {titleSaveError ? <p className={styles.errorText}>{t('itineraryView.retry')}</p> : null}

            {isDescriptionEditing ? (
              <form
                className={styles.descriptionEditForm}
                onBlurCapture={(event) => {
                  const nextTarget = event.relatedTarget
                  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                    return
                  }

                  if (skipDescriptionBlurSaveRef.current) {
                    skipDescriptionBlurSaveRef.current = false
                    return
                  }

                  void saveDescriptionEdit()
                }}
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveDescriptionEdit()
                }}
              >
                <textarea
                  className={styles.descriptionTextarea}
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  disabled={isDescriptionSaving}
                  placeholder={t('itineraryView.descriptionPlaceholder')}
                  aria-label={t('itineraryView.editDescriptionAria')}
                  rows={3}
                  autoFocus
                />
                <div className={styles.descriptionEditActions}>
                  <button
                    type="button"
                    className={styles.descriptionCancelButton}
                    onPointerDown={() => {
                      skipDescriptionBlurSaveRef.current = true
                    }}
                    onClick={cancelDescriptionEdit}
                    disabled={isDescriptionSaving}
                    aria-label={t('itineraryView.cancel')}
                  >
                    ✕
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className={styles.descriptionDisplayButton}
                onClick={startDescriptionEdit}
                aria-label={t('itineraryView.editDescriptionAria')}
              >
                <p className={styles.description}>
                  {itinerary.description?.trim().length
                    ? itinerary.description
                    : t('itineraryView.descriptionPlaceholder')}
                </p>
              </button>
            )}
            {descriptionSaveError ? <p className={styles.errorText}>{t('itineraryView.retry')}</p> : null}

            <div className={styles.metaRow}>
              {isDateRangeEditing ? (
                <form
                  className={styles.metaEditForm}
                  onBlurCapture={(event) => {
                    const nextTarget = event.relatedTarget
                    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                      return
                    }

                    if (skipDateRangeBlurSaveRef.current) {
                      skipDateRangeBlurSaveRef.current = false
                      return
                    }

                    void saveDateRangeEdit()
                  }}
                  onSubmit={(event) => {
                    event.preventDefault()
                    void saveDateRangeEdit()
                  }}
                >
                  <input
                    type="date"
                    className={styles.metaDateInput}
                    value={dateFromDraft}
                    onChange={(event) => {
                      const nextFrom = event.target.value
                      setDateFromDraft(nextFrom)
                      if (nextFrom) {
                        const dayDelta = Math.max(0, itinerary.days.length - 1)
                        setDateToDraft(shiftIsoDate(nextFrom, dayDelta))
                      }
                      setDateRangeValidationError(false)
                    }}
                    disabled={isDateRangeSaving}
                    aria-label={t('dashboardManualStart.dateFromLabel')}
                    autoFocus
                  />
                  <span className={styles.metaDateSeparator}>-</span>
                  <input
                    type="date"
                    className={styles.metaDateInput}
                    value={dateToDraft}
                    onChange={(event) => {
                      const nextTo = event.target.value
                      setDateToDraft(nextTo)
                      if (nextTo) {
                        const dayDelta = Math.max(0, itinerary.days.length - 1)
                        setDateFromDraft(shiftIsoDate(nextTo, -dayDelta))
                      }
                      setDateRangeValidationError(false)
                    }}
                    disabled={isDateRangeSaving}
                    aria-label={t('dashboardManualStart.dateToLabel')}
                  />
                  <button
                    type="button"
                    className={styles.metaCancelButton}
                    onPointerDown={() => {
                      skipDateRangeBlurSaveRef.current = true
                    }}
                    onClick={cancelDateRangeEdit}
                    disabled={isDateRangeSaving}
                    aria-label={t('itineraryView.cancel')}
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className={styles.metaPillButton}
                  onClick={startDateRangeEdit}
                  aria-label={t('itineraryView.editDateRangeAria')}
                >
                  <span className={styles.metaPill}>{dateRangeLabel}</span>
                </button>
              )}
              <span className={styles.metaPill}>
                {t('itineraryView.dayCount', { count: itinerary.days.length })}
              </span>
              {upcomingDaysLeft ? (
                <span className={`${styles.metaPill} ${styles.metaPillUpcoming}`}>
                  {t('dashboard.daysLeft', { count: upcomingDaysLeft })}
                </span>
              ) : null}
            </div>

            {ongoingProgress ? (
              <div className={styles.ongoingProgressHeader}>
                <div className={styles.ongoingProgressMeta}>
                  <span className={styles.ongoingProgressLabel}>{t('dashboard.ongoingProgress')}</span>
                </div>
                <div
                  className={styles.ongoingProgressTrack}
                  role="progressbar"
                  aria-label={t('dashboard.ongoingProgress')}
                  aria-valuemin={0}
                  aria-valuemax={ongoingProgress.totalHours}
                  aria-valuenow={ongoingProgress.hoursLeft}
                  aria-valuetext={t('dashboard.hoursLeft', { count: ongoingProgress.hoursLeft })}
                >
                  <div
                    className={styles.ongoingProgressFill}
                    style={{ width: `${ongoingProgress.elapsedPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
            {dateRangeValidationError ? <p className={styles.errorText}>{t('dashboardManualStart.dateRangeError')}</p> : null}
            {dateRangeSaveError ? <p className={styles.errorText}>{t('itineraryView.retry')}</p> : null}

            {isTagsEditing ? (
              <form
                className={styles.tagsEditForm}
                onBlurCapture={(event) => {
                  const nextTarget = event.relatedTarget
                  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                    return
                  }

                  if (skipTagsBlurSaveRef.current) {
                    skipTagsBlurSaveRef.current = false
                    return
                  }

                  void saveTagsEdit()
                }}
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveTagsEdit()
                }}
              >
                <input
                  type="text"
                  className={styles.tagsInput}
                  value={tagsDraft}
                  onChange={(event) => setTagsDraft(event.target.value)}
                  disabled={isTagsSaving}
                  placeholder={t('itineraryView.tagsPlaceholder')}
                  aria-label={t('itineraryView.editTagsAria')}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.tagsCancelButton}
                  onPointerDown={() => {
                    skipTagsBlurSaveRef.current = true
                  }}
                  onClick={cancelTagsEdit}
                  disabled={isTagsSaving}
                  aria-label={t('itineraryView.cancel')}
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                className={styles.tagsDisplayButton}
                onClick={startTagsEdit}
                aria-label={t('itineraryView.editTagsAria')}
              >
                <div className={styles.tagsRow}>
                  {itinerary.tags.length > 0 ? (
                    itinerary.tags.map((tag) => (
                      <span key={tag} className={styles.tagChip}>
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className={styles.tagsPlaceholderText}>{t('itineraryView.tagsPlaceholder')}</span>
                  )}
                </div>
              </button>
            )}
            {tagsSaveError ? <p className={styles.errorText}>{t('itineraryView.retry')}</p> : null}

          </div>

          {isCoverPhotoEditing ? (
            <form
              className={styles.coverPhotoEditForm}
              onBlurCapture={(event) => {
                const nextTarget = event.relatedTarget
                if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                  return
                }

                if (skipCoverPhotoBlurSaveRef.current) {
                  skipCoverPhotoBlurSaveRef.current = false
                  return
                }

                void saveCoverPhotoEdit()
              }}
              onSubmit={(event) => {
                event.preventDefault()
                void saveCoverPhotoEdit()
              }}
            >
              <input
                type="url"
                className={styles.coverPhotoUrlInput}
                value={coverPhotoUrlDraft}
                onChange={(event) => setCoverPhotoUrlDraft(event.target.value)}
                placeholder={t('itineraryView.coverPhotoUrlPlaceholder')}
                aria-label={t('itineraryView.coverPhotoUrlPlaceholder')}
                disabled={isCoverPhotoSaving}
                autoFocus
              />
              <input
                type="text"
                className={styles.coverPhotoCaptionInput}
                value={coverPhotoCaptionDraft}
                onChange={(event) => setCoverPhotoCaptionDraft(event.target.value)}
                placeholder={t('itineraryView.coverPhotoCaptionPlaceholder')}
                aria-label={t('itineraryView.coverPhotoCaptionPlaceholder')}
                disabled={isCoverPhotoSaving}
              />
              <button
                type="button"
                className={styles.coverPhotoCancelButton}
                onPointerDown={() => {
                  skipCoverPhotoBlurSaveRef.current = true
                }}
                onClick={cancelCoverPhotoEdit}
                disabled={isCoverPhotoSaving}
                aria-label={t('itineraryView.cancel')}
              >
                ✕
              </button>
            </form>
          ) : itinerary.coverPhoto?.url ? (
            <button
              type="button"
              className={styles.coverPhotoDisplayButton}
              onClick={startCoverPhotoEdit}
              aria-label={t('itineraryView.editCoverPhotoAria')}
            >
              <img
                className={styles.coverPhoto}
                src={itinerary.coverPhoto.url}
                alt={itinerary.coverPhoto.caption ?? itinerary.title}
                title={itinerary.coverPhoto.caption ?? itinerary.title}
                loading="lazy"
              />
            </button>
          ) : (
            <button
              type="button"
              className={styles.coverPhotoPlaceholderButton}
              onClick={startCoverPhotoEdit}
              aria-label={t('itineraryView.editCoverPhotoAria')}
            >
              {t('itineraryView.coverPhotoPlaceholder')}
            </button>
          )}
          {coverPhotoSaveError ? <p className={styles.errorText}>{t('itineraryView.retry')}</p> : null}

          <ItineraryMapLauncher
            className={styles.headerMap}
            pins={itineraryMapPins}
            title={t('itineraryView.itineraryMapTitle')}
            emptyLabel={t('itineraryView.mapNoMarkedLocations')}
            openLabel={t('itineraryView.openFullMap')}
            to={itineraryMapRoute}
          />

          <DayShortcutsRow days={itinerary.days} locale={i18n.language} />

          {!dayCollapseState.allExpanded || !dayCollapseState.allCollapsed ? (
            <div className={styles.headerDayControls}>
              <div className={styles.photoThumbSizeControls} role="group" aria-label={t('itineraryView.photoThumbnailSizeLabel')}>
                <span className={styles.photoThumbSizeLabel}>{t('itineraryView.photoThumbnailSizeLabel')}</span>
                {PHOTO_THUMBNAIL_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPhotoThumbnailSize(option.value)}
                    aria-pressed={photoThumbnailSize === option.value}
                    aria-label={t(option.labelKey)}
                    title={t(option.labelKey)}
                    className={`${styles.photoThumbSizeButton}${photoThumbnailSize === option.value ? ` ${styles.photoThumbSizeButtonActive}` : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className={styles.photoThumbSizeIcon}
                      data-size={option.value}
                    />
                  </button>
                ))}
              </div>

              {!dayCollapseState.allExpanded ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExpandAllDays}
                >
                  {t('itineraryView.expandAllDays')}
                </Button>
              ) : null}

              {!dayCollapseState.allCollapsed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCollapseAllDays}
                >
                  {t('itineraryView.collapseAllDays')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        <ItineraryDaysGrid
          days={itinerary.days}
          locale={i18n.language}
          draftCacheIdentity={itinerary.id}
          photoThumbnailSize={photoThumbnailSize}
          editable
          fullBleedOnMobile
          buildDayMapRoute={(dayNumber) => `/itineraries/${itinerary.id}/map?dayNumber=${dayNumber}`}
          collapseCommandToken={dayCollapseCommandToken}
          collapseCommandMode={dayCollapseCommandMode}
          onCollapseStateChange={setDayCollapseState}
          onDaySave={handleDaySave}
        />

        <section className={styles.dangerZone}>
          <Button
            type="button"
            variant="destructive"
            className={styles.dangerButton}
            disabled={isDeleting}
            onClick={() => {
              const confirmed = window.confirm(t('itineraryView.deleteZoneText'))

              if (!confirmed) {
                return
              }

              void onDelete()
            }}
          >
            <Trash2 aria-hidden="true" />
            {isDeleting ? t('itineraryView.deletingItinerary') : t('itineraryView.deleteItinerary')}
          </Button>

          {deleteError ? <p className={styles.errorText}>{t('itineraryView.deleteError')}</p> : null}
        </section>
      </div>
    </AppShell>
  )
}
