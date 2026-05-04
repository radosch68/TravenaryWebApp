import type { ReactElement } from 'react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnchorSimple, ArrowRight, ArrowSquareOut, CaretDoubleUp, CaretDown, CaretRight, MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react'

import { DialogShell } from '@/components/DialogShell'
import type { PhotoSearchResult, ActivityType, AccommodationPlatform, ActivityLocation, ErrorDetail, ItineraryActivity, WebReference } from '@/services/contracts'
import { searchPhotos } from '@/services/itinerary-service'
import { generateClientId } from '@/utils/client-id'
import { formatLocalDate, formatLocalTime, getLocalizedTimeInputPlaceholder } from '@/utils/date-format'
import { toGoogleMapsUrl } from '@/utils/location-links'
import { ACTIVITY_TYPE_COLOR, ACTIVITY_TYPE_ICON } from './activity-presentation'
import formStyles from './ActivityFormPanel.module.css'

const FULL_EDIT_TYPES: ReadonlySet<ActivityType> = new Set(['note', 'poi', 'custom', 'carRental', 'food', 'shopping', 'tour', 'accommodation'])
const LIMITED_EDIT_FIELDS = ['title', 'text', 'time', 'timeEnd'] as const
const EDITABLE_ACTIVITY_TYPES: readonly Exclude<ActivityType, 'divider'>[] = [
  'flight',
  'transfer',
  'carRental',
  'accommodation',
  'poi',
  'food',
  'shopping',
  'tour',
  'note',
  'custom',
]

const ANCHOR_ELIGIBLE_TYPES: ReadonlySet<ActivityType> = new Set([
  'note', 'flight', 'accommodation', 'transfer', 'poi', 'carRental', 'custom', 'food', 'shopping', 'tour'
])

const ACTIVITY_TYPE_LABEL_KEY: Record<ActivityType, string> = {
  note: 'note',
  poi: 'poi',
  custom: 'custom',
  carRental: 'carRental',
  food: 'food',
  shopping: 'shopping',
  tour: 'tour',
  accommodation: 'accommodation',
  flight: 'flight',
  transfer: 'transfer',
  divider: 'divider',
}

const MAX_REFERENCE_ROWS = 10
const MAX_LOCATION_ROWS = 10
const AUTO_EXPAND_SECTION_ITEM_LIMIT = 4

type ReferenceType = NonNullable<WebReference['type']>

type LocationReference = ActivityLocation

interface ReferenceDraftRow {
  id: string
  url: string
  caption: string
  type: ReferenceType | ''
  source?: 'unsplash'
  authorName?: string
  authorUrl?: string
  sourceUrl?: string
  downloadLocation?: string
}

interface LocationDraftRow {
  id: string
  caption: string
  address: string
  showOnMap: boolean
  longitude: string
  latitude: string
  initialAddress: string
  initialLongitude: string
  initialLatitude: string
  coordinatesManualOverride: boolean
}

type ReferenceAddDialogMode = 'manual' | 'photo'
type LocationErrorTarget = 'address' | 'row'

const PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'svg', 'avif', 'heic', 'heif', 'jfif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'webm', 'm4v', 'mkv', 'mpeg', 'mpg', '3gp', 'ogv'])
const WEBPAGE_EXTENSIONS = new Set(['html', 'htm', 'php', 'asp', 'aspx', 'jsp'])

function inferReferenceTypeFromUrl(rawUrl: string): ReferenceType | '' {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return ''
  }

  let candidate = trimmed
  if (isValidAbsoluteUrl(trimmed)) {
    candidate = new URL(trimmed).pathname
  } else {
    candidate = candidate.split('#')[0]?.split('?')[0] ?? candidate
  }

  const normalized = candidate.toLowerCase()
  const match = normalized.match(/\.([a-z0-9]+)$/)
  if (!match) {
    return ''
  }

  const extension = match[1]
  if (PHOTO_EXTENSIONS.has(extension)) {
    return 'photo'
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video'
  }
  if (WEBPAGE_EXTENSIONS.has(extension)) {
    return 'webpage'
  }

  return ''
}

function normalizeTimeValue(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const twentyFourHour = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (twentyFourHour) {
    return `${twentyFourHour[1].padStart(2, '0')}:${twentyFourHour[2]}`
  }

  const twelveHour = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (!twelveHour) return undefined

  let hours = Number(twelveHour[1])
  const minutes = twelveHour[2]
  const meridiem = twelveHour[3].toUpperCase()

  if (hours < 1 || hours > 12) return undefined
  if (meridiem === 'AM') {
    hours = hours === 12 ? 0 : hours
  } else {
    hours = hours === 12 ? 12 : hours + 12
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`
}

function toReferenceDraftRows(references?: WebReference[]): ReferenceDraftRow[] {
  if (!references || references.length === 0) {
    return []
  }

  return references.map((reference) => ({
    id: generateClientId(),
    url: reference.url ?? '',
    caption: reference.caption ?? '',
    type: reference.type ?? '',
    source: reference.source,
    authorName: reference.authorName,
    authorUrl: reference.authorUrl,
    sourceUrl: reference.sourceUrl,
    downloadLocation: reference.downloadLocation,
  }))
}

function toLocationDraftRows(locations?: LocationReference[]): LocationDraftRow[] {
  if (!locations || locations.length === 0) {
    return []
  }

  return locations.map((location) => ({
    id: generateClientId(),
    caption: location.caption ?? '',
    address: location.address ?? '',
    showOnMap: location.showOnMap === true,
    longitude: typeof location.coordinates?.[0] === 'number' ? String(location.coordinates[0]) : '',
    latitude: typeof location.coordinates?.[1] === 'number' ? String(location.coordinates[1]) : '',
    initialAddress: location.address ?? '',
    initialLongitude: typeof location.coordinates?.[0] === 'number' ? String(location.coordinates[0]) : '',
    initialLatitude: typeof location.coordinates?.[1] === 'number' ? String(location.coordinates[1]) : '',
    coordinatesManualOverride: false,
  }))
}

function createEmptyReferenceRow(): ReferenceDraftRow {
  return {
    id: generateClientId(),
    url: '',
    caption: '',
    type: '',
  }
}

function createEmptyLocationRow(): LocationDraftRow {
  return {
    id: generateClientId(),
    caption: '',
    address: '',
    showOnMap: false,
    longitude: '',
    latitude: '',
    initialAddress: '',
    initialLongitude: '',
    initialLatitude: '',
    coordinatesManualOverride: false,
  }
}

function toRowOpenState(rows: Array<{ id: string }>): Record<string, boolean> {
  return rows.reduce<Record<string, boolean>>((acc, row) => {
    acc[row.id] = false
    return acc
  }, {})
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function toLocationDraftGoogleMapsUrl(row: LocationDraftRow): string | null {
  const longitudeRaw = row.longitude.trim()
  const latitudeRaw = row.latitude.trim()
  const hasLongitude = longitudeRaw.length > 0
  const hasLatitude = latitudeRaw.length > 0

  if (hasLongitude && hasLatitude) {
    const longitude = Number(longitudeRaw)
    const latitude = Number(latitudeRaw)
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return toGoogleMapsUrl({ coordinates: [longitude, latitude] })
    }
  }

  return toGoogleMapsUrl({ address: row.address })
}

function readErrorCauseDetails(error: unknown): ErrorDetail[] | undefined {
  if (!(error instanceof Error) || !('cause' in error)) {
    return undefined
  }

  return Array.isArray(error.cause) ? error.cause as ErrorDetail[] : undefined
}

function mapLocationSaveErrors(
  details: ErrorDetail[] | undefined,
  rows: LocationDraftRow[],
): { errors: Record<string, string>; targets: Record<string, LocationErrorTarget> } {
  const errors: Record<string, string> = {}
  const targets: Record<string, LocationErrorTarget> = {}

  if (!details) {
    return { errors, targets }
  }

  details.forEach((detail) => {
    const match = detail.field?.match(/\.locations\.(\d+)\./)
    if (!match) {
      return
    }

    const rowIndex = Number(match[1])
    const rowId = rows[rowIndex]?.id
    if (!rowId || errors[rowId]) {
      return
    }

    errors[rowId] = detail.message
    targets[rowId] = 'address'
  })

  return { errors, targets }
}

function clearCoordinatesForRowsWithErrors(
  rows: LocationDraftRow[],
  errors: Record<string, string>,
): LocationDraftRow[] {
  if (Object.keys(errors).length === 0) {
    return rows
  }

  return rows.map((row) => (
    errors[row.id]
      ? {
          ...row,
          longitude: '',
          latitude: '',
          initialLongitude: '',
          initialLatitude: '',
          coordinatesManualOverride: false,
        }
      : row
  ))
}

interface ActivityFormPanelProps {
  activity?: ItineraryActivity
  activityType: ActivityType
  owningDayDate?: string
  createOwnBlock?: boolean
  blockDividerTitle?: string
  onSave: (payload: ActivityFormSavePayload) => Promise<void> | void
  onCancel: () => void
  disabled?: boolean
}

export interface ActivityFormSavePayload {
  activity: ItineraryActivity
  createOwnBlock: boolean
  dividerTitle: string
}

export function ActivityFormPanel({
  activity,
  activityType,
  owningDayDate,
  createOwnBlock = false,
  blockDividerTitle = '',
  onSave,
  onCancel,
  disabled,
}: ActivityFormPanelProps): ReactElement {
  const { t, i18n } = useTranslation(['common'])
  const isCreate = !activity
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType>(activityType)
  const isFullEdit = isCreate || FULL_EDIT_TYPES.has(selectedActivityType)
  const timePlaceholder = getLocalizedTimeInputPlaceholder(i18n.language)
  const useNativeTimeInput = typeof window !== 'undefined'
    && window.matchMedia('(hover: none), (pointer: coarse)').matches
  const timeInputMode: 'text' | 'numeric' = useNativeTimeInput
    ? 'numeric'
    : i18n.language.startsWith('en') ? 'text' : 'numeric'
  const timeInputType = useNativeTimeInput ? 'time' : 'text'

  const [title, setTitle] = useState(activity?.title ?? '')
  const [text, setText] = useState(activity?.text ?? '')
  const [time, setTime] = useState(() => useNativeTimeInput ? (activity?.time ?? '') : formatLocalTime(activity?.time, i18n.language))
  const [timeEnd, setTimeEnd] = useState(() => useNativeTimeInput ? (activity?.timeEnd ?? '') : formatLocalTime(activity?.timeEnd, i18n.language))
  const [cuisine, setCuisine] = useState(activity?.details?.cuisine ?? '')
  const [guidanceMode, setGuidanceMode] = useState<'selfGuided' | 'guided'>(activity?.details?.guidanceMode ?? 'selfGuided')
  const [anchorToDay, setAnchorToDay] = useState(() => {
    if (isCreate) return false
    return typeof activity?.anchorDate === 'string' && activity.anchorDate.length > 0
  })
  const [nightsInput, setNightsInput] = useState(() => (activity?.details?.nights ?? 1).toString())
  const [guestsInput, setGuestsInput] = useState(() => activity?.details?.guests?.toString() ?? '')
  const [checkInFrom, setCheckInFrom] = useState(() => useNativeTimeInput ? (activity?.details?.checkInFrom ?? '') : formatLocalTime(activity?.details?.checkInFrom, i18n.language))
  const [checkInUntil, setCheckInUntil] = useState(() => useNativeTimeInput ? (activity?.details?.checkInUntil ?? '') : formatLocalTime(activity?.details?.checkInUntil, i18n.language))
  const [checkOutUntil, setCheckOutUntil] = useState(() => useNativeTimeInput ? (activity?.details?.checkOutUntil ?? '') : formatLocalTime(activity?.details?.checkOutUntil, i18n.language))
  const [platform, setPlatform] = useState<AccommodationPlatform | ''>(activity?.details?.platform ?? '')
  const [contactPhone, setContactPhone] = useState(activity?.details?.contactPhone ?? '')
  const [contactEmail, setContactEmail] = useState(activity?.details?.contactEmail ?? '')
  const [bookingRef, setBookingRef] = useState(activity?.details?.bookingRef ?? '')
  const initialReferenceRows = toReferenceDraftRows(activity?.references)
  const initialLocationRows = toLocationDraftRows(activity?.locations)
  const [referenceRows, setReferenceRows] = useState<ReferenceDraftRow[]>(initialReferenceRows)
  const [locationRows, setLocationRows] = useState<LocationDraftRow[]>(initialLocationRows)
  const [commonSectionOpen, setCommonSectionOpen] = useState(true)
  const [activityDetailsSectionOpen, setActivityDetailsSectionOpen] = useState(false)
  const [referenceSectionOpen, setReferenceSectionOpen] = useState(initialReferenceRows.length <= AUTO_EXPAND_SECTION_ITEM_LIMIT)
  const [locationSectionOpen, setLocationSectionOpen] = useState(initialLocationRows.length <= AUTO_EXPAND_SECTION_ITEM_LIMIT)
  const [referenceRowOpen, setReferenceRowOpen] = useState<Record<string, boolean>>(() => toRowOpenState(initialReferenceRows))
  const [locationRowOpen, setLocationRowOpen] = useState<Record<string, boolean>>(() => toRowOpenState(initialLocationRows))
  const [referenceErrors, setReferenceErrors] = useState<Record<string, string>>({})
  const [locationErrors, setLocationErrors] = useState<Record<string, string>>({})
  const [locationErrorTargets, setLocationErrorTargets] = useState<Record<string, LocationErrorTarget>>({})
  const [referenceAddDialogMode, setReferenceAddDialogMode] = useState<ReferenceAddDialogMode | null>(null)
  const [locationAddDialogOpen, setLocationAddDialogOpen] = useState(false)
  const [referenceAddRow, setReferenceAddRow] = useState<ReferenceDraftRow>(() => createEmptyReferenceRow())
  const [locationAddRow, setLocationAddRow] = useState<LocationDraftRow>(() => createEmptyLocationRow())
  const [referenceAddError, setReferenceAddError] = useState<string | null>(null)
  const [locationAddError, setLocationAddError] = useState<string | null>(null)
  const [photoSearchKeywords, setPhotoSearchKeywords] = useState(() => activity?.title ?? '')
  const [photoSearchBusy, setPhotoSearchBusy] = useState(false)
  const [photoSearchError, setPhotoSearchError] = useState<string | null>(null)
  const [photoSearchResults, setPhotoSearchResults] = useState<PhotoSearchResult[]>([])
  const [photoSearchSelected, setPhotoSearchSelected] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const timeInputRef = useRef<HTMLInputElement | null>(null)
  const timeEndInputRef = useRef<HTMLInputElement | null>(null)
  const isFormDisabled = disabled || isSubmitting

  const resetTypeSpecificFields = (nextType: ActivityType): void => {
    setActivityDetailsSectionOpen(nextType === 'food' || nextType === 'tour' || nextType === 'accommodation')
    setCuisine('')
    setGuidanceMode('selfGuided')
    setNightsInput('1')
    setGuestsInput('')
    setCheckInFrom('')
    setCheckInUntil('')
    setCheckOutUntil('')
    setPlatform('')
    setContactPhone('')
    setContactEmail('')
    setBookingRef('')
  }

  const handleSelectedActivityTypeChange = (nextType: ActivityType): void => {
    if (nextType === selectedActivityType || !EDITABLE_ACTIVITY_TYPES.includes(nextType as Exclude<ActivityType, 'divider'>)) {
      return
    }

    setSelectedActivityType(nextType)
    resetTypeSpecificFields(nextType)
  }

  const handleTimeInput = (value: string): void => {
    setTime(value)
  }

  const handleTimeEndInput = (value: string): void => {
    setTimeEnd(value)
  }

  const updateReferenceRow = (rowId: string, patch: Partial<Omit<ReferenceDraftRow, 'id'>>): void => {
    setReferenceRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
    setReferenceErrors((prev) => {
      if (!(rowId in prev)) {
        return prev
      }

      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }

  const updateLocationRow = (
    rowId: string,
    patch: Partial<Pick<LocationDraftRow, 'caption' | 'address' | 'showOnMap' | 'longitude' | 'latitude' | 'coordinatesManualOverride'>>,
  ): void => {
    setLocationRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
    setLocationErrors((prev) => {
      if (!(rowId in prev)) {
        return prev
      }

      const next = { ...prev }
      delete next[rowId]
      return next
    })
    setLocationErrorTargets((prev) => {
      if (!(rowId in prev)) {
        return prev
      }

      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }

  const updateLocationCoordinates = (rowId: string, field: 'longitude' | 'latitude', value: string): void => {
    updateLocationRow(rowId, {
      [field]: value,
      coordinatesManualOverride: true,
    })
  }

  const closeReferenceAddDialog = (): void => {
    setReferenceAddDialogMode(null)
    setReferenceAddError(null)
    setPhotoSearchError(null)
    setPhotoSearchResults([])
    setPhotoSearchSelected({})
  }

  const closeLocationAddDialog = (): void => {
    setLocationAddDialogOpen(false)
    setLocationAddError(null)
  }

  const openReferenceAddDialog = (mode: ReferenceAddDialogMode): void => {
    if (referenceRows.length >= MAX_REFERENCE_ROWS) {
      return
    }

    if (mode === 'manual') {
      const nextIndex = referenceRows.length + 1
      const nextRow = createEmptyReferenceRow()
      nextRow.caption = t('common:itinerary.dayEditor.referenceDefaultTitle', { index: nextIndex })
      setReferenceAddRow(nextRow)
    }
    setReferenceAddError(null)
    setPhotoSearchError(null)
    if (mode === 'photo' && !photoSearchKeywords.trim()) {
      setPhotoSearchKeywords(title.trim())
    }
    setReferenceAddDialogMode(mode)
    setReferenceSectionOpen(true)
  }

  const openLocationAddDialog = (): void => {
    if (locationRows.length >= MAX_LOCATION_ROWS) {
      return
    }

    const nextIndex = locationRows.length + 1
    const nextRow = createEmptyLocationRow()
    nextRow.caption = t('common:itinerary.dayEditor.locationDefaultTitle', { index: nextIndex })
    setLocationAddRow(nextRow)
    setLocationAddError(null)
    setLocationAddDialogOpen(true)
    setLocationSectionOpen(true)
  }

  const addReferenceRowFromDialog = (): void => {
    const url = referenceAddRow.url.trim()
    if (!url) {
      setReferenceAddError(t('common:itinerary.dayEditor.referenceUrlRequired'))
      return
    }
    if (!isValidAbsoluteUrl(url)) {
      setReferenceAddError(t('common:itinerary.dayEditor.referenceUrlInvalid'))
      return
    }

    setReferenceRows((prev) => [...prev, { ...referenceAddRow, url }])
    setReferenceRowOpen((prev) => ({ ...prev, [referenceAddRow.id]: false }))
    closeReferenceAddDialog()
  }

  const addLocationRowFromDialog = (): void => {
    const caption = locationAddRow.caption.trim()
    const address = locationAddRow.address.trim()
    const longitudeRaw = locationAddRow.longitude.trim()
    const latitudeRaw = locationAddRow.latitude.trim()
    const hasLongitude = longitudeRaw.length > 0
    const hasLatitude = latitudeRaw.length > 0
    const hasAddress = address.length > 0

    if (hasLongitude !== hasLatitude) {
      setLocationAddError(t('common:itinerary.dayEditor.locationCoordinatesPair'))
      return
    }

    if (hasLongitude && hasLatitude) {
      const longitude = Number(longitudeRaw)
      const latitude = Number(latitudeRaw)
      const outOfRange = !Number.isFinite(longitude)
        || !Number.isFinite(latitude)
        || longitude < -180
        || longitude > 180
        || latitude < -90
        || latitude > 90

      if (outOfRange) {
        setLocationAddError(t('common:itinerary.dayEditor.locationCoordinatesRange'))
        return
      }
    }

    if (!hasAddress && !(hasLongitude && hasLatitude)) {
      setLocationAddError(t('common:itinerary.dayEditor.locationRequired'))
      return
    }

    setLocationRows((prev) => [
      ...prev,
      {
        ...locationAddRow,
        caption,
        address,
        longitude: longitudeRaw,
        latitude: latitudeRaw,
        initialAddress: address,
        initialLongitude: longitudeRaw,
        initialLatitude: latitudeRaw,
        coordinatesManualOverride: hasLongitude && hasLatitude,
      },
    ])
    setLocationRowOpen((prev) => ({ ...prev, [locationAddRow.id]: false }))
    closeLocationAddDialog()
  }

  const removeReferenceRow = (rowId: string): void => {
    setReferenceRows((prev) => prev.filter((row) => row.id !== rowId))
    setReferenceRowOpen((prev) => {
      if (!(rowId in prev)) {
        return prev
      }

      const next = { ...prev }
      delete next[rowId]
      return next
    })
    setReferenceErrors((prev) => {
      if (!(rowId in prev)) {
        return prev
      }

      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }

  const removeLocationRow = (rowId: string): void => {
    setLocationRows((prev) => prev.filter((row) => row.id !== rowId))
    setLocationRowOpen((prev) => {
      if (!(rowId in prev)) {
        return prev
      }

      const next = { ...prev }
      delete next[rowId]
      return next
    })
    setLocationErrors((prev) => {
      if (!(rowId in prev)) {
        return prev
      }

      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }

  const toggleReferenceRowOpen = (rowId: string): void => {
    setReferenceRowOpen((prev) => ({ ...prev, [rowId]: !prev[rowId] }))
  }

  const toggleLocationRowOpen = (rowId: string): void => {
    setLocationRowOpen((prev) => ({ ...prev, [rowId]: !prev[rowId] }))
  }

  const moveReferenceRowToTop = (rowId: string): void => {
    setReferenceRows((prev) => {
      const rowIndex = prev.findIndex((row) => row.id === rowId)
      if (rowIndex <= 0) {
        return prev
      }

      const next = [...prev]
      const [target] = next.splice(rowIndex, 1)
      next.unshift(target)
      return next
    })
  }

  const moveLocationRowToTop = (rowId: string): void => {
    setLocationRows((prev) => {
      const rowIndex = prev.findIndex((row) => row.id === rowId)
      if (rowIndex <= 0) {
        return prev
      }

      const next = [...prev]
      const [target] = next.splice(rowIndex, 1)
      next.unshift(target)
      return next
    })
  }

  const addPhotoResultsAsReferences = (results: PhotoSearchResult[], keywordsCaption: string): number => {
    if (results.length === 0) {
      return 0
    }

    const availableSlots = Math.max(0, MAX_REFERENCE_ROWS - referenceRows.length)
    if (availableSlots === 0) {
      return 0
    }

    const existingUrls = new Set(referenceRows.map((row) => row.url.trim()).filter((url) => url.length > 0))
    const uniqueResults: PhotoSearchResult[] = []
    for (const item of results) {
      const normalizedUrl = item.url.trim()
      if (!normalizedUrl || existingUrls.has(normalizedUrl)) {
        continue
      }

      uniqueResults.push({ ...item, url: normalizedUrl })
      existingUrls.add(normalizedUrl)
    }

    const selected = uniqueResults.slice(0, availableSlots)
    if (selected.length === 0) {
      return 0
    }

    const newRows: ReferenceDraftRow[] = selected.map((item) => ({
      id: generateClientId(),
      url: item.url,
      caption: keywordsCaption,
      type: 'photo',
      source: item.source,
      authorName: item.authorName,
      authorUrl: item.authorUrl,
      sourceUrl: item.sourceUrl,
      downloadLocation: item.downloadLocation,
    }))

    setReferenceRows((prev) => [...prev, ...newRows])
    setReferenceRowOpen((prev) => {
      const next = { ...prev }
      for (const row of newRows) {
        next[row.id] = false
      }
      return next
    })

    return newRows.length
  }

  const handleSearchPhotos = async (): Promise<void> => {
    const keywords = photoSearchKeywords.trim()
    if (!keywords) {
      setPhotoSearchError(t('common:itinerary.dayEditor.photoSearchKeywordsRequired'))
      return
    }

    setPhotoSearchBusy(true)
    setPhotoSearchError(null)
    try {
      const results = await searchPhotos(keywords, 3)
      setPhotoSearchResults(results)
      setPhotoSearchSelected({})
      if (results.length === 0) {
        setPhotoSearchError(t('common:itinerary.dayEditor.photoSearchNoResults'))
        return
      }
    } catch {
      setPhotoSearchResults([])
      setPhotoSearchSelected({})
      setPhotoSearchError(t('common:itinerary.dayEditor.photoSearchFailed'))
    } finally {
      setPhotoSearchBusy(false)
    }
  }

  const togglePhotoSearchSelection = (url: string): void => {
    setPhotoSearchSelected((prev) => ({ ...prev, [url]: !prev[url] }))
    setPhotoSearchError(null)
  }

  const handleAddSelectedPhotos = (): void => {
    const keywordsCaption = photoSearchKeywords.trim()
    if (!keywordsCaption) {
      setPhotoSearchError(t('common:itinerary.dayEditor.photoSearchKeywordsRequired'))
      return
    }

    const selectedResults = photoSearchResults.filter((item) => photoSearchSelected[item.url])
    if (selectedResults.length === 0) {
      setPhotoSearchError(t('common:itinerary.dayEditor.photoSearchSelectionRequired'))
      return
    }

    const addedCount = addPhotoResultsAsReferences(selectedResults, keywordsCaption)
    if (addedCount === 0) {
      setPhotoSearchError(t('common:itinerary.dayEditor.photoSearchAddNone'))
      return
    }

    setPhotoSearchError(null)
    setReferenceSectionOpen(true)
    closeReferenceAddDialog()
  }

  const handleSubmit = async (): Promise<void> => {
    if (!title.trim()) return
    setSubmitError(null)

    const liveTime = normalizeTimeValue(timeInputRef.current?.value ?? time)
    const liveTimeEnd = normalizeTimeValue(timeEndInputRef.current?.value ?? timeEnd)

    const nextReferenceErrors: Record<string, string> = {}
    const normalizedReferences: WebReference[] = []

    for (const row of referenceRows) {
      const url = row.url.trim()
      const caption = row.caption.trim()
      const type = row.type || undefined
      const isEmpty = !url && !caption && !type

      if (isEmpty) {
        continue
      }

      if (!url) {
        nextReferenceErrors[row.id] = t('common:itinerary.dayEditor.referenceUrlRequired')
        continue
      }

      if (!isValidAbsoluteUrl(url)) {
        nextReferenceErrors[row.id] = t('common:itinerary.dayEditor.referenceUrlInvalid')
        continue
      }

      normalizedReferences.push({
        url,
        ...(caption ? { caption } : {}),
        ...(type ? { type } : {}),
        ...(row.source ? { source: row.source } : {}),
        ...(row.authorName ? { authorName: row.authorName } : {}),
        ...(row.authorUrl ? { authorUrl: row.authorUrl } : {}),
        ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
        ...(row.downloadLocation ? { downloadLocation: row.downloadLocation } : {}),
      })
    }

    const nextLocationErrors: Record<string, string> = {}
    const normalizedLocations: LocationReference[] = []

    for (const row of locationRows) {
      const caption = row.caption.trim()
      const address = row.address.trim()
      const showOnMap = row.showOnMap === true
      const longitudeRaw = row.longitude.trim()
      const latitudeRaw = row.latitude.trim()
      const hasLongitude = longitudeRaw.length > 0
      const hasLatitude = latitudeRaw.length > 0
      const hasAddress = address.length > 0
      const isEmpty = !caption && !hasAddress && !hasLongitude && !hasLatitude

      if (isEmpty) {
        continue
      }

      if (hasLongitude !== hasLatitude) {
        nextLocationErrors[row.id] = t('common:itinerary.dayEditor.locationCoordinatesPair')
        continue
      }

      let coordinates: number[] | undefined
      if (hasLongitude && hasLatitude) {
        const longitude = Number(longitudeRaw)
        const latitude = Number(latitudeRaw)

        const outOfRange = !Number.isFinite(longitude)
          || !Number.isFinite(latitude)
          || longitude < -180
          || longitude > 180
          || latitude < -90
          || latitude > 90

        if (outOfRange) {
          nextLocationErrors[row.id] = t('common:itinerary.dayEditor.locationCoordinatesRange')
          continue
        }

        coordinates = [longitude, latitude]
      }

      if (!hasAddress && !coordinates) {
        nextLocationErrors[row.id] = t('common:itinerary.dayEditor.locationRequired')
        continue
      }

      if (
        showOnMap
        && hasAddress
        && coordinates
        && !row.coordinatesManualOverride
        && address !== row.initialAddress.trim()
        && longitudeRaw === row.initialLongitude.trim()
        && latitudeRaw === row.initialLatitude.trim()
      ) {
        coordinates = undefined
      }

      normalizedLocations.push({
        ...(caption ? { caption } : {}),
        showOnMap,
        ...(hasAddress ? { address } : {}),
        ...(coordinates ? { coordinates } : {}),
      })
    }

    setReferenceErrors(nextReferenceErrors)
    setLocationErrors(nextLocationErrors)
    setLocationErrorTargets({})

    if (Object.keys(nextReferenceErrors).length > 0 || Object.keys(nextLocationErrors).length > 0) {
      return
    }

    // Preserve existing anchor state when this form cannot safely edit anchoring.
    const isAnchorEligible = ANCHOR_ELIGIBLE_TYPES.has(selectedActivityType)
    const canEditAnchoring = isAnchorEligible && Boolean(owningDayDate)
    let resolvedAnchorDate: string | null = activity?.anchorDate ?? null
    if (canEditAnchoring) {
      resolvedAnchorDate = anchorToDay ? owningDayDate ?? null : null
    }

    const result: ItineraryActivity = {
      id: activity?.id ?? generateClientId(),
      type: selectedActivityType,
      title: title.trim(),
      anchorDate: resolvedAnchorDate,
      ...(text.trim() ? { text: text.trim() } : {}),
      ...(liveTime ? { time: liveTime } : {}),
      ...(liveTimeEnd ? { timeEnd: liveTimeEnd } : {}),
      ...(normalizedReferences.length > 0 ? { references: normalizedReferences } : {}),
      ...(normalizedLocations.length > 0 ? { locations: normalizedLocations } : {}),
    }

    // Build type-specific details
    if (selectedActivityType === 'food') {
      result.details = cuisine.trim() ? { cuisine: cuisine.trim() } : {}
    } else if (selectedActivityType === 'tour') {
      result.details = { guidanceMode }
    } else if (selectedActivityType === 'accommodation') {
      const parsedNights = parseInt(nightsInput, 10)
      const normalizedNights = Number.isFinite(parsedNights) && parsedNights >= 1 ? parsedNights : 1
      const accDetails: ItineraryActivity['details'] = { nights: normalizedNights }
      const parsedGuests = parseInt(guestsInput, 10)
      if (!isNaN(parsedGuests) && parsedGuests >= 1) accDetails!.guests = parsedGuests
      const normCheckInFrom = normalizeTimeValue(checkInFrom)
      if (normCheckInFrom) accDetails!.checkInFrom = normCheckInFrom
      const normCheckInUntil = normalizeTimeValue(checkInUntil)
      if (normCheckInUntil) accDetails!.checkInUntil = normCheckInUntil
      const normCheckOutUntil = normalizeTimeValue(checkOutUntil)
      if (normCheckOutUntil) accDetails!.checkOutUntil = normCheckOutUntil
      if (platform) accDetails!.platform = platform as AccommodationPlatform
      if (contactPhone.trim()) accDetails!.contactPhone = contactPhone.trim()
      if (contactEmail.trim()) accDetails!.contactEmail = contactEmail.trim()
      if (bookingRef.trim()) accDetails!.bookingRef = bookingRef.trim()
      result.details = accDetails
    }

    setIsSubmitting(true)
    try {
      await onSave({
        activity: result,
        createOwnBlock: isCreate ? createOwnBlock : false,
        dividerTitle: isCreate ? blockDividerTitle : '',
      })
    } catch (error) {
      const mappedLocationErrors = mapLocationSaveErrors(readErrorCauseDetails(error), locationRows)
      if (Object.keys(mappedLocationErrors.errors).length > 0) {
        setLocationRows((prev) => clearCoordinatesForRowsWithErrors(prev, mappedLocationErrors.errors))
        setLocationErrors(mappedLocationErrors.errors)
        setLocationErrorTargets(mappedLocationErrors.targets)
        setLocationSectionOpen(true)
        setSubmitError(null)
      } else {
        setSubmitError(error instanceof Error ? error.message : t('common:itinerary.dayEditor.saveFailed'))
      }

      setIsSubmitting(false)
    }
  }

  const typeColor = ACTIVITY_TYPE_COLOR[selectedActivityType]
  const hasActivitySpecificFields = selectedActivityType === 'food' || selectedActivityType === 'tour' || selectedActivityType === 'accommodation'
  const activitySpecificSectionTitle = t(`common:itinerary.dayEditor.activityTypeOptions.${ACTIVITY_TYPE_LABEL_KEY[selectedActivityType]}`)
  const getReferenceRowSummary = (row: ReferenceDraftRow, rowIndex: number): string => {
    const fallback = t('common:itinerary.dayEditor.referenceDefaultTitle', { index: rowIndex + 1 })
    return row.caption.trim() || row.url.trim() || fallback
  }
  const getLocationRowSummary = (row: LocationDraftRow, rowIndex: number): string => {
    const fallback = t('common:itinerary.dayEditor.locationDefaultTitle', { index: rowIndex + 1 })
    return row.caption.trim() || row.address.trim() || fallback
  }
  const getPhotoResultSummary = (result: PhotoSearchResult, rowIndex: number): string => {
    return result.caption?.trim()
      || result.authorName?.trim()
      || t('common:itinerary.dayEditor.photoSearchResultFallback', { index: rowIndex + 1 })
  }
  const referenceAddDialogOpen = referenceAddDialogMode !== null
  const isReferenceManualDialog = referenceAddDialogMode === 'manual'
  const isReferencePhotoDialog = referenceAddDialogMode === 'photo'
  const referenceAddUrl = referenceAddRow.url.trim()
  const referenceAddLinkLabel = referenceAddRow.caption.trim()
    || referenceAddUrl
    || t('common:itinerary.dayEditor.referencesAdd')
  const locationAddMapsUrl = toLocationDraftGoogleMapsUrl(locationAddRow)
  const isReferenceLimitReached = referenceRows.length >= MAX_REFERENCE_ROWS
  const isLocationLimitReached = locationRows.length >= MAX_LOCATION_ROWS
  const handleDialogClose = (): void => {
    if (isSubmitting) {
      return
    }

    if (referenceAddDialogOpen) {
      closeReferenceAddDialog()
      return
    }
    if (locationAddDialogOpen) {
      closeLocationAddDialog()
      return
    }
    onCancel()
  }

  const typeBadge = (
    <span
      className={formStyles.typeBadge}
      style={{ background: typeColor.bg, color: typeColor.icon, borderColor: `${typeColor.icon}26` }}
    >
      <span className={formStyles.typeBadgeIcon}>{ACTIVITY_TYPE_ICON[selectedActivityType]}</span>
      <span>{t(`common:itinerary.dayEditor.activityTypeOptions.${ACTIVITY_TYPE_LABEL_KEY[selectedActivityType]}`)}</span>
    </span>
  )

  return (
    <>
    <DialogShell
      title={typeBadge}
      onClose={handleDialogClose}
      className={formStyles.modal}
      footer={
        <button
          type="button"
          className="button-primary"
          onClick={() => void handleSubmit()}
          disabled={isFormDisabled || !title.trim()}
        >
          {isSubmitting ? t('common:itinerary.edit.saving') : t('common:save')}
        </button>
      }
    >
    <div className="activity-form-panel">
      {submitError ? <p className="activity-form-panel__submit-error" role="alert">{submitError}</p> : null}

      <section className="activity-form-panel__section" aria-label={t('common:itinerary.dayEditor.commonTitle')}>
        <div className="activity-form-panel__section-header">
          <button
            type="button"
            className="activity-form-panel__section-collapse activity-form-panel__section-collapse--full"
            onClick={() => setCommonSectionOpen((prev) => !prev)}
            aria-expanded={commonSectionOpen}
            aria-controls="activity-common-section-content"
            disabled={isFormDisabled}
          >
            {commonSectionOpen ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
            <span className="activity-form-panel__section-title">{t('common:itinerary.dayEditor.commonTitle')}</span>
          </button>
        </div>

        {commonSectionOpen ? (
          <div id="activity-common-section-content" className="activity-form-panel__section-content">
            {!isCreate ? (
              <div className="activity-form-panel__field">
                <label htmlFor="activity-type">{t('common:itinerary.dayEditor.activityType')}</label>
                <select
                  id="activity-type"
                  value={selectedActivityType}
                  onChange={(e) => handleSelectedActivityTypeChange(e.target.value as ActivityType)}
                  disabled={isFormDisabled}
                >
                  {EDITABLE_ACTIVITY_TYPES.map((optionType) => (
                    <option key={optionType} value={optionType}>
                      {t(`common:itinerary.dayEditor.activityTypeOptions.${ACTIVITY_TYPE_LABEL_KEY[optionType]}`)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="activity-form-panel__field">
              <label htmlFor="activity-title">{t('common:itinerary.dayEditor.fieldTitle')}</label>
              <input
                id="activity-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isFormDisabled}
              />
            </div>

            {(isFullEdit || LIMITED_EDIT_FIELDS.includes('text' as never)) && (
              <div className="activity-form-panel__field">
                <label htmlFor="activity-text">{t('common:itinerary.dayEditor.fieldText')}</label>
                <textarea
                  id="activity-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={isFormDisabled}
                  rows={5}
                />
              </div>
            )}

            {selectedActivityType !== 'accommodation' && (
              <div className="activity-form-panel__field-row activity-form-panel__field-row--time">
                <div className="activity-form-panel__field">
                  <label htmlFor="activity-time">{t('common:itinerary.dayEditor.fieldTime')}</label>
                  <input
                    id="activity-time"
                    ref={timeInputRef}
                    type={timeInputType}
                    value={time}
                    onChange={(e) => handleTimeInput(e.target.value)}
                    inputMode={timeInputMode}
                    placeholder={useNativeTimeInput ? undefined : timePlaceholder}
                    autoComplete="off"
                    disabled={isFormDisabled}
                    step={useNativeTimeInput ? 60 : undefined}
                  />
                </div>
                <div className="activity-form-panel__field">
                  <label htmlFor="activity-time-end">{t('common:itinerary.dayEditor.fieldTimeEnd')}</label>
                  <input
                    id="activity-time-end"
                    ref={timeEndInputRef}
                    type={timeInputType}
                    value={timeEnd}
                    onChange={(e) => handleTimeEndInput(e.target.value)}
                    inputMode={timeInputMode}
                    placeholder={useNativeTimeInput ? undefined : timePlaceholder}
                    autoComplete="off"
                    disabled={isFormDisabled}
                    step={useNativeTimeInput ? 60 : undefined}
                  />
                </div>
              </div>
            )}

            {ANCHOR_ELIGIBLE_TYPES.has(selectedActivityType) && owningDayDate ? (
              <div className="activity-form-panel__block-option activity-form-panel__anchor-option">
                <label className="activity-form-panel__checkbox" htmlFor="activity-anchor-to-day">
                  <input
                    id="activity-anchor-to-day"
                    type="checkbox"
                    checked={anchorToDay}
                    onChange={(e) => setAnchorToDay(e.target.checked)}
                    disabled={isFormDisabled}
                  />
                  <span className="activity-form-panel__checkbox-indicator" aria-hidden="true">
                    <span className="activity-form-panel__checkbox-indicator-mark">✓</span>
                  </span>
                  <span className="activity-form-panel__anchor-label">
                    <AnchorSimple size={14} weight="bold" className="activity-form-panel__anchor-icon" />
                    <span>{t('common:itinerary.dayEditor.anchorToDay', { date: formatLocalDate(owningDayDate, i18n.language) })}</span>
                  </span>
                </label>
                <p className="activity-form-panel__help-text">{t('common:itinerary.dayEditor.anchorHelp')}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {hasActivitySpecificFields ? (
        <section className="activity-form-panel__section" aria-label={activitySpecificSectionTitle}>
          <div className="activity-form-panel__section-header">
            <button
              type="button"
              className="activity-form-panel__section-collapse activity-form-panel__section-collapse--full"
              onClick={() => setActivityDetailsSectionOpen((prev) => !prev)}
              aria-expanded={activityDetailsSectionOpen}
              aria-controls="activity-details-section-content"
              disabled={isFormDisabled}
            >
              {activityDetailsSectionOpen ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
              <span className="activity-form-panel__section-title">{activitySpecificSectionTitle}</span>
            </button>
          </div>

          {activityDetailsSectionOpen ? (
            <div id="activity-details-section-content" className="activity-form-panel__section-content">
              {selectedActivityType === 'food' ? (
                <div className="activity-form-panel__field">
                  <label htmlFor="activity-cuisine">{t('common:itinerary.dayEditor.fieldCuisine')}</label>
                  <input
                    id="activity-cuisine"
                    type="text"
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              ) : null}

              {selectedActivityType === 'tour' ? (
                <div className="activity-form-panel__field">
                  <label htmlFor="activity-guidance-mode">{t('common:itinerary.dayEditor.fieldGuidanceMode')}</label>
                  <select
                    id="activity-guidance-mode"
                    value={guidanceMode}
                    onChange={(e) => setGuidanceMode(e.target.value as 'selfGuided' | 'guided')}
                    disabled={isFormDisabled}
                  >
                    <option value="selfGuided">{t('common:itinerary.dayEditor.guidanceModeSelfGuided')}</option>
                    <option value="guided">{t('common:itinerary.dayEditor.guidanceModeGuided')}</option>
                  </select>
                </div>
              ) : null}

              {selectedActivityType === 'accommodation' ? (
                <>
                  <div className="activity-form-panel__field-row activity-form-panel__field-row--time">
                    <div className="activity-form-panel__field">
                      <label htmlFor="activity-nights">{t('common:itinerary.dayEditor.fieldNights')}</label>
                      <input
                        id="activity-nights"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={nightsInput}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (/^\d*$/.test(raw)) {
                            setNightsInput(raw)
                          }
                        }}
                        onBlur={() => {
                          const parsed = parseInt(nightsInput, 10)
                          if (!Number.isFinite(parsed) || parsed < 1) {
                            setNightsInput('1')
                            return
                          }

                          setNightsInput(String(parsed))
                        }}
                        disabled={isFormDisabled}
                      />
                    </div>
                    <div className="activity-form-panel__field">
                      <label htmlFor="activity-guests">{t('common:itinerary.dayEditor.fieldGuests')}</label>
                      <input
                        id="activity-guests"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={guestsInput}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (/^\d*$/.test(raw)) setGuestsInput(raw)
                        }}
                        onBlur={() => {
                          const parsed = parseInt(guestsInput, 10)
                          if (!Number.isFinite(parsed) || parsed < 1) {
                            setGuestsInput('')
                            return
                          }
                          setGuestsInput(String(parsed))
                        }}
                        disabled={isFormDisabled}
                      />
                    </div>
                  </div>

                  <div className="activity-form-panel__field-row activity-form-panel__field-row--time">
                    <div className="activity-form-panel__field">
                      <label htmlFor="activity-checkin-from">{t('common:itinerary.dayEditor.fieldCheckInFrom')}</label>
                      <input
                        id="activity-checkin-from"
                        type={timeInputType}
                        value={checkInFrom}
                        onChange={(e) => setCheckInFrom(e.target.value)}
                        inputMode={timeInputMode}
                        placeholder={useNativeTimeInput ? undefined : timePlaceholder}
                        autoComplete="off"
                        disabled={isFormDisabled}
                        step={useNativeTimeInput ? 60 : undefined}
                      />
                    </div>
                    <div className="activity-form-panel__field">
                      <label htmlFor="activity-checkin-until">{t('common:itinerary.dayEditor.fieldCheckInUntil')}</label>
                      <input
                        id="activity-checkin-until"
                        type={timeInputType}
                        value={checkInUntil}
                        onChange={(e) => setCheckInUntil(e.target.value)}
                        inputMode={timeInputMode}
                        placeholder={useNativeTimeInput ? undefined : timePlaceholder}
                        autoComplete="off"
                        disabled={isFormDisabled}
                        step={useNativeTimeInput ? 60 : undefined}
                      />
                    </div>
                  </div>

                  <div className="activity-form-panel__field">
                    <label htmlFor="activity-checkout-until">{t('common:itinerary.dayEditor.fieldCheckOutUntil')}</label>
                    <input
                      id="activity-checkout-until"
                      type={timeInputType}
                      value={checkOutUntil}
                      onChange={(e) => setCheckOutUntil(e.target.value)}
                      inputMode={timeInputMode}
                      placeholder={useNativeTimeInput ? undefined : timePlaceholder}
                      autoComplete="off"
                      disabled={isFormDisabled}
                      step={useNativeTimeInput ? 60 : undefined}
                    />
                  </div>

                  <div className="activity-form-panel__field">
                    <label htmlFor="activity-platform">{t('common:itinerary.dayEditor.fieldPlatform')}</label>
                    <select
                      id="activity-platform"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value as AccommodationPlatform | '')}
                      disabled={isFormDisabled}
                    >
                      <option value="">—</option>
                      <option value="booking">{t('common:itinerary.dayEditor.platformOptions.booking')}</option>
                      <option value="airbnb">{t('common:itinerary.dayEditor.platformOptions.airbnb')}</option>
                      <option value="agoda">{t('common:itinerary.dayEditor.platformOptions.agoda')}</option>
                      <option value="direct">{t('common:itinerary.dayEditor.platformOptions.direct')}</option>
                      <option value="other">{t('common:itinerary.dayEditor.platformOptions.other')}</option>
                    </select>
                  </div>

                  <div className="activity-form-panel__field">
                    <label htmlFor="activity-contact-phone">{t('common:itinerary.dayEditor.fieldContactPhone')}</label>
                    <input
                      id="activity-contact-phone"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      disabled={isFormDisabled}
                    />
                  </div>

                  <div className="activity-form-panel__field">
                    <label htmlFor="activity-contact-email">{t('common:itinerary.dayEditor.fieldContactEmail')}</label>
                    <input
                      id="activity-contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      disabled={isFormDisabled}
                    />
                  </div>

                  <div className="activity-form-panel__field">
                    <label htmlFor="activity-booking-ref">{t('common:itinerary.dayEditor.fieldBookingRef')}</label>
                    <input
                      id="activity-booking-ref"
                      type="text"
                      value={bookingRef}
                      onChange={(e) => setBookingRef(e.target.value)}
                      disabled={isFormDisabled}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="activity-form-panel__section" aria-label={t('common:itinerary.dayEditor.referencesTitle')}>
        <div className="activity-form-panel__section-header">
          <button
            type="button"
            className="activity-form-panel__section-collapse activity-form-panel__section-collapse--full"
            onClick={() => setReferenceSectionOpen((prev) => !prev)}
            aria-expanded={referenceSectionOpen}
            aria-controls="activity-reference-section-content"
            disabled={isFormDisabled}
          >
            {referenceSectionOpen ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
            <span className="activity-form-panel__section-title">{t('common:itinerary.dayEditor.referencesTitle')}</span>
            <span className="activity-form-panel__section-count">{referenceRows.length}</span>
          </button>
        </div>

        {referenceSectionOpen ? (
          <div id="activity-reference-section-content" className="activity-form-panel__section-content">
            {referenceRows.length === 0 ? (
              <p className="activity-form-panel__help-text">{t('common:itinerary.dayEditor.referencesEmpty')}</p>
            ) : null}

            {referenceRows.map((row, rowIndex) => {
              const isRowOpen = referenceRowOpen[row.id] ?? true
              const referenceLinkLabel = getReferenceRowSummary(row, rowIndex)

              return (
                <div key={row.id} className="activity-form-panel__repeatable-row">
                  <div className="activity-form-panel__repeatable-header">
                    <button
                      type="button"
                      className="activity-form-panel__repeatable-collapse"
                      onClick={() => toggleReferenceRowOpen(row.id)}
                      aria-expanded={isRowOpen}
                      aria-controls={`activity-reference-row-content-${row.id}`}
                    >
                      {isRowOpen ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
                      <span className="activity-form-panel__repeatable-title">{getReferenceRowSummary(row, rowIndex)}</span>
                    </button>
                    <div className="activity-form-panel__repeatable-actions">
                      <button
                        type="button"
                        className="activity-form-panel__repeatable-move-top-icon"
                        onClick={() => moveReferenceRowToTop(row.id)}
                        disabled={isFormDisabled || rowIndex === 0}
                        aria-label={t('common:itinerary.dayEditor.moveRowToTop', { index: rowIndex + 1 })}
                        title={t('common:itinerary.dayEditor.moveRowToTop', { index: rowIndex + 1 })}
                      >
                        <CaretDoubleUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="activity-form-panel__repeatable-remove-icon"
                        onClick={() => removeReferenceRow(row.id)}
                        disabled={isFormDisabled}
                        aria-label={t('common:itinerary.dayEditor.removeRow', { index: rowIndex + 1 })}
                        title={t('common:itinerary.dayEditor.removeRow', { index: rowIndex + 1 })}
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>

                  {isRowOpen ? (
                    <div id={`activity-reference-row-content-${row.id}`}>
                      <div className="activity-form-panel__field-row">
                        <div className="activity-form-panel__field">
                          <label htmlFor={`activity-reference-caption-${row.id}`}>{t('common:itinerary.dayEditor.fieldReferenceCaption')}</label>
                          <input
                            id={`activity-reference-caption-${row.id}`}
                            type="text"
                            value={row.caption}
                            onChange={(e) => updateReferenceRow(row.id, { caption: e.target.value })}
                            disabled={isFormDisabled}
                          />
                        </div>
                        <div className="activity-form-panel__field">
                          <label htmlFor={`activity-reference-type-${row.id}`}>{t('common:itinerary.dayEditor.fieldReferenceType')}</label>
                          <select
                            id={`activity-reference-type-${row.id}`}
                            value={row.type}
                            onChange={(e) => updateReferenceRow(row.id, { type: e.target.value as ReferenceType | '' })}
                            disabled={isFormDisabled}
                          >
                            <option value="">{t('common:itinerary.dayEditor.referenceTypeOptions.none')}</option>
                            <option value="webpage">{t('common:itinerary.dayEditor.referenceTypeOptions.webpage')}</option>
                            <option value="photo">{t('common:itinerary.dayEditor.referenceTypeOptions.photo')}</option>
                            <option value="video">{t('common:itinerary.dayEditor.referenceTypeOptions.video')}</option>
                          </select>
                        </div>
                      </div>

                      <div className="activity-form-panel__field activity-form-panel__reference-url-field">
                        <div className="activity-form-panel__field-label-row">
                          <label htmlFor={`activity-reference-url-${row.id}`}>{t('common:itinerary.dayEditor.fieldReferenceUrl')}</label>
                          {row.type === 'photo' && isValidAbsoluteUrl(row.url.trim()) ? (
                            <a
                              href={row.url.trim()}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="activity-form-panel__field-link-icon"
                              aria-label={t('common:itinerary.activityMeta.openReference', { label: referenceLinkLabel })}
                              title={t('common:itinerary.activityMeta.openReference', { label: referenceLinkLabel })}
                            >
                              <ArrowSquareOut size={15} weight="bold" />
                            </a>
                          ) : null}
                        </div>
                        <input
                          id={`activity-reference-url-${row.id}`}
                          type="url"
                          value={row.url}
                          onChange={(e) => updateReferenceRow(row.id, { url: e.target.value })}
                          disabled={isFormDisabled}
                          placeholder="https://"
                        />
                      </div>
                    </div>
                  ) : null}

                  {referenceErrors[row.id] ? (
                    <p className="activity-form-panel__field-error" role="alert">{referenceErrors[row.id]}</p>
                  ) : null}
                </div>
              )
            })}

            <div className="activity-form-panel__section-footer">
              <button
                type="button"
                className="activity-form-panel__section-icon-action"
                onClick={() => openReferenceAddDialog('manual')}
                disabled={isFormDisabled || isReferenceLimitReached}
                aria-label={t('common:itinerary.dayEditor.referencesAdd')}
                title={t('common:itinerary.dayEditor.referencesAdd')}
              >
                <Plus size={16} weight="bold" />
              </button>
              <button
                type="button"
                className="activity-form-panel__section-find-action"
                onClick={() => openReferenceAddDialog('photo')}
                disabled={isFormDisabled || isReferenceLimitReached}
                aria-label={t('common:itinerary.dayEditor.searchPhotos')}
                title={t('common:itinerary.dayEditor.searchPhotos')}
              >
                <MagnifyingGlass size={16} weight="bold" />
                <span>{t('common:itinerary.dayEditor.searchPhotos')}</span>
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="activity-form-panel__section" aria-label={t('common:itinerary.dayEditor.locationsTitle')}>
        <div className="activity-form-panel__section-header">
          <button
            type="button"
            className="activity-form-panel__section-collapse activity-form-panel__section-collapse--full"
            onClick={() => setLocationSectionOpen((prev) => !prev)}
            aria-expanded={locationSectionOpen}
            aria-controls="activity-location-section-content"
            disabled={isFormDisabled}
          >
            {locationSectionOpen ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
            <span className="activity-form-panel__section-title">{t('common:itinerary.dayEditor.locationsTitle')}</span>
            <span className="activity-form-panel__section-count">{locationRows.length}</span>
          </button>
        </div>

        {locationSectionOpen ? (
          <div id="activity-location-section-content" className="activity-form-panel__section-content">
            {locationRows.length === 0 ? (
              <p className="activity-form-panel__help-text">{t('common:itinerary.dayEditor.locationsEmpty')}</p>
            ) : null}

            {locationRows.map((row, rowIndex) => {
              const isRowOpen = locationRowOpen[row.id] ?? true
              const locationMapsUrl = toLocationDraftGoogleMapsUrl(row)
              const locationLinkLabel = getLocationRowSummary(row, rowIndex)
              const locationError = locationErrors[row.id]
              const locationErrorTarget = locationErrorTargets[row.id] ?? 'row'

              return (
                <div key={row.id} className={`activity-form-panel__repeatable-row${locationError ? ' activity-form-panel__repeatable-row--error' : ''}`}>
                  <div className="activity-form-panel__repeatable-header">
                    <button
                      type="button"
                      className="activity-form-panel__repeatable-collapse"
                      onClick={() => toggleLocationRowOpen(row.id)}
                      aria-expanded={isRowOpen}
                      aria-controls={`activity-location-row-content-${row.id}`}
                    >
                      {isRowOpen ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
                      {locationError ? (
                        <span
                          className="activity-form-panel__repeatable-error-indicator"
                          aria-label={locationError}
                          title={locationError}
                        >
                          !
                        </span>
                      ) : null}
                      <span className="activity-form-panel__repeatable-title">{getLocationRowSummary(row, rowIndex)}</span>
                    </button>
                    <div className="activity-form-panel__repeatable-actions">
                      <button
                        type="button"
                        className="activity-form-panel__repeatable-move-top-icon"
                        onClick={() => moveLocationRowToTop(row.id)}
                        disabled={isFormDisabled || rowIndex === 0}
                        aria-label={t('common:itinerary.dayEditor.moveRowToTop', { index: rowIndex + 1 })}
                        title={t('common:itinerary.dayEditor.moveRowToTop', { index: rowIndex + 1 })}
                      >
                        <CaretDoubleUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="activity-form-panel__repeatable-remove-icon"
                        onClick={() => removeLocationRow(row.id)}
                        disabled={isFormDisabled}
                        aria-label={t('common:itinerary.dayEditor.removeRow', { index: rowIndex + 1 })}
                        title={t('common:itinerary.dayEditor.removeRow', { index: rowIndex + 1 })}
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>

                  {isRowOpen ? (
                    <div id={`activity-location-row-content-${row.id}`}>
                      <div className="activity-form-panel__field-row activity-form-panel__field-row--location-top">
                        <div className="activity-form-panel__field">
                          <label htmlFor={`activity-location-caption-${row.id}`}>{t('common:itinerary.dayEditor.fieldLocationCaption')}</label>
                          <input
                            id={`activity-location-caption-${row.id}`}
                            type="text"
                            value={row.caption}
                            onChange={(e) => updateLocationRow(row.id, { caption: e.target.value })}
                            disabled={isFormDisabled}
                          />
                        </div>
                        <div className="activity-form-panel__field">
                          <label htmlFor={`activity-location-longitude-${row.id}`}>{t('common:itinerary.dayEditor.fieldLongitude')}</label>
                          <input
                            id={`activity-location-longitude-${row.id}`}
                            type="text"
                            value={row.longitude}
                            onChange={(e) => updateLocationCoordinates(row.id, 'longitude', e.target.value)}
                            disabled={isFormDisabled}
                          />
                        </div>
                        <div className="activity-form-panel__field">
                          <label htmlFor={`activity-location-latitude-${row.id}`}>{t('common:itinerary.dayEditor.fieldLatitude')}</label>
                          <input
                            id={`activity-location-latitude-${row.id}`}
                            type="text"
                            value={row.latitude}
                            onChange={(e) => updateLocationCoordinates(row.id, 'latitude', e.target.value)}
                            disabled={isFormDisabled}
                          />
                        </div>
                      </div>

                      <div className="activity-form-panel__field activity-form-panel__location-address-field">
                        <div className="activity-form-panel__field-label-row">
                          <label htmlFor={`activity-location-address-${row.id}`}>{t('common:itinerary.dayEditor.fieldLocationAddress')}</label>
                          {locationMapsUrl ? (
                            <a
                              href={locationMapsUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="activity-form-panel__field-link-icon"
                              aria-label={t('common:itinerary.activityMeta.openMap', { label: locationLinkLabel })}
                              title={t('common:itinerary.activityMeta.openMap', { label: locationLinkLabel })}
                            >
                              <ArrowSquareOut size={15} weight="bold" />
                            </a>
                          ) : null}
                        </div>
                        <input
                          id={`activity-location-address-${row.id}`}
                          type="text"
                          value={row.address}
                          onChange={(e) => updateLocationRow(row.id, { address: e.target.value })}
                          disabled={isFormDisabled}
                        />
                        {locationError && locationErrorTarget === 'address' ? (
                          <p className="activity-form-panel__field-error" role="alert">{locationError}</p>
                        ) : null}
                      </div>
                      <div className="activity-form-panel__block-option activity-form-panel__block-option--map-toggle">
                        <label className="activity-form-panel__checkbox" htmlFor={`activity-location-show-on-map-${row.id}`}>
                          <input
                            id={`activity-location-show-on-map-${row.id}`}
                            type="checkbox"
                            checked={row.showOnMap}
                            onChange={(event) => updateLocationRow(row.id, { showOnMap: event.target.checked })}
                            disabled={isFormDisabled}
                          />
                          <span className="activity-form-panel__checkbox-indicator" aria-hidden="true">
                            <span className="activity-form-panel__checkbox-indicator-mark">✓</span>
                          </span>
                          <span>{t('common:itinerary.dayEditor.fieldShowOnMap')}</span>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {locationError && locationErrorTarget !== 'address' ? (
                    <p className="activity-form-panel__field-error" role="alert">{locationError}</p>
                  ) : null}
                </div>
              )
            })}

            <div className="activity-form-panel__section-footer">
              <button
                type="button"
                className="activity-form-panel__section-icon-action"
                onClick={openLocationAddDialog}
                disabled={isFormDisabled || isLocationLimitReached}
                aria-label={t('common:itinerary.dayEditor.locationsAdd')}
                title={t('common:itinerary.dayEditor.locationsAdd')}
              >
                <Plus size={16} weight="bold" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

    </div>
    </DialogShell>
    {referenceAddDialogOpen ? (
      <DialogShell
        title={isReferencePhotoDialog ? t('common:itinerary.dayEditor.searchPhotos') : t('common:itinerary.dayEditor.referencesAdd')}
        onClose={closeReferenceAddDialog}
        className={`${formStyles.modal} ${formStyles.nestedModal}`}
        footer={(
          <button
            type="button"
            className="button-primary"
            onClick={isReferencePhotoDialog ? handleAddSelectedPhotos : addReferenceRowFromDialog}
            disabled={isFormDisabled || (isReferencePhotoDialog && photoSearchBusy)}
          >
            {t('common:save')}
          </button>
        )}
      >
        <div className="activity-form-panel">
          {isReferenceManualDialog ? (
            <>
              <div className="activity-form-panel__field-row">
                <div className="activity-form-panel__field">
                  <label htmlFor={`activity-reference-caption-add-${referenceAddRow.id}`}>{t('common:itinerary.dayEditor.fieldReferenceCaption')}</label>
                  <input
                    id={`activity-reference-caption-add-${referenceAddRow.id}`}
                    type="text"
                    value={referenceAddRow.caption}
                    onChange={(e) => {
                      setReferenceAddRow((prev) => ({ ...prev, caption: e.target.value }))
                      setReferenceAddError(null)
                    }}
                    disabled={isFormDisabled}
                  />
                </div>
                <div className="activity-form-panel__field">
                  <label htmlFor={`activity-reference-type-add-${referenceAddRow.id}`}>{t('common:itinerary.dayEditor.fieldReferenceType')}</label>
                  <select
                    id={`activity-reference-type-add-${referenceAddRow.id}`}
                    value={referenceAddRow.type}
                    onChange={(e) => {
                      setReferenceAddRow((prev) => ({ ...prev, type: e.target.value as ReferenceType | '' }))
                      setReferenceAddError(null)
                    }}
                    disabled={isFormDisabled}
                  >
                    <option value="">{t('common:itinerary.dayEditor.referenceTypeOptions.none')}</option>
                    <option value="webpage">{t('common:itinerary.dayEditor.referenceTypeOptions.webpage')}</option>
                    <option value="photo">{t('common:itinerary.dayEditor.referenceTypeOptions.photo')}</option>
                    <option value="video">{t('common:itinerary.dayEditor.referenceTypeOptions.video')}</option>
                  </select>
                </div>
              </div>
              <div className="activity-form-panel__field activity-form-panel__reference-url-field">
                <div className="activity-form-panel__field-label-row">
                  <label htmlFor={`activity-reference-url-add-${referenceAddRow.id}`}>{t('common:itinerary.dayEditor.fieldReferenceUrl')}</label>
                  {isValidAbsoluteUrl(referenceAddUrl) ? (
                    <a
                      href={referenceAddUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="activity-form-panel__field-link-icon"
                      aria-label={t('common:itinerary.activityMeta.openReference', { label: referenceAddLinkLabel })}
                      title={t('common:itinerary.activityMeta.openReference', { label: referenceAddLinkLabel })}
                    >
                      <ArrowSquareOut size={15} weight="bold" />
                    </a>
                  ) : null}
                </div>
                <input
                  id={`activity-reference-url-add-${referenceAddRow.id}`}
                  type="url"
                  value={referenceAddRow.url}
                  onChange={(e) => {
                    setReferenceAddRow((prev) => {
                      const nextUrl = e.target.value
                      const previousInferredType = inferReferenceTypeFromUrl(prev.url)
                      const nextInferredType = inferReferenceTypeFromUrl(nextUrl)
                      const canAutoPresetType = prev.type === '' || (previousInferredType !== '' && prev.type === previousInferredType)
                      return {
                        ...prev,
                        url: nextUrl,
                        ...(canAutoPresetType ? { type: nextInferredType } : {}),
                      }
                    })
                    setReferenceAddError(null)
                  }}
                  disabled={isFormDisabled}
                  placeholder="https://"
                />
              </div>
              {referenceAddError ? <p className="activity-form-panel__field-error" role="alert">{referenceAddError}</p> : null}
            </>
          ) : null}

          {isReferencePhotoDialog ? (
            <div className="activity-form-panel__photo-search">
              {photoSearchResults.length > 0 ? (
                <div className="activity-form-panel__photo-search-results">
                  {photoSearchResults.map((result, resultIndex) => {
                    const resultId = `activity-photo-search-result-${resultIndex}`
                    const resultTitle = getPhotoResultSummary(result, resultIndex)
                    const resultImage = result.thumbnailUrl ?? result.url

                    return (
                      <div key={`${result.url}-${resultIndex}`} className="activity-form-panel__photo-result">
                        <input
                          id={resultId}
                          type="checkbox"
                          checked={Boolean(photoSearchSelected[result.url])}
                          onChange={() => togglePhotoSearchSelection(result.url)}
                          disabled={isFormDisabled || photoSearchBusy}
                          aria-label={t('common:itinerary.dayEditor.photoSearchSelectPhoto', { index: resultIndex + 1 })}
                        />
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="activity-form-panel__photo-result-link"
                          aria-label={t('common:itinerary.dayEditor.photoSearchOpenFull', { index: resultIndex + 1 })}
                          title={t('common:itinerary.dayEditor.photoSearchOpenFull', { index: resultIndex + 1 })}
                        >
                          <img src={resultImage} alt={resultTitle} loading="lazy" />
                        </a>
                        <span className="activity-form-panel__photo-result-title">{resultTitle}</span>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              <div className="activity-form-panel__field">
                <label htmlFor="activity-photo-search-keywords">{t('common:itinerary.dayEditor.photoSearchKeywords')}</label>
                <div className="activity-form-panel__photo-search-row">
                  <input
                    id="activity-photo-search-keywords"
                    type="text"
                    value={photoSearchKeywords}
                    onChange={(e) => setPhotoSearchKeywords(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      if (disabled || photoSearchBusy || isReferenceLimitReached) return
                      e.preventDefault()
                      void handleSearchPhotos()
                    }}
                    disabled={isFormDisabled || photoSearchBusy}
                    placeholder={t('common:itinerary.dayEditor.photoSearchKeywordsPlaceholder')}
                  />
                  <button
                    type="button"
                    className="activity-form-panel__photo-search-go"
                    onClick={() => void handleSearchPhotos()}
                    disabled={isFormDisabled || photoSearchBusy || isReferenceLimitReached}
                    aria-label={t('common:itinerary.dayEditor.photoSearchGo')}
                    title={t('common:itinerary.dayEditor.photoSearchGo')}
                  >
                    <ArrowRight size={16} weight="bold" />
                  </button>
                </div>
                <p className="activity-form-panel__help-text">
                  {t('common:itinerary.dayEditor.photoSearchKeywordsHintLine1')}
                  <br />
                  {t('common:itinerary.dayEditor.photoSearchKeywordsHintLine2')}
                </p>
              </div>
              {photoSearchError ? <p className="activity-form-panel__field-error" role="alert">{photoSearchError}</p> : null}
            </div>
          ) : null}
        </div>
      </DialogShell>
    ) : null}
    {locationAddDialogOpen ? (
      <DialogShell
        title={t('common:itinerary.dayEditor.locationsAdd')}
        onClose={closeLocationAddDialog}
        className={`${formStyles.modal} ${formStyles.nestedModal}`}
        footer={(
          <button type="button" className="button-primary" onClick={addLocationRowFromDialog} disabled={isFormDisabled}>{t('common:save')}</button>
        )}
      >
        <div className="activity-form-panel">
          <div className="activity-form-panel__field-row activity-form-panel__field-row--location-top">
            <div className="activity-form-panel__field">
              <label htmlFor={`activity-location-caption-add-${locationAddRow.id}`}>{t('common:itinerary.dayEditor.fieldLocationCaption')}</label>
              <input
                id={`activity-location-caption-add-${locationAddRow.id}`}
                type="text"
                value={locationAddRow.caption}
                onChange={(e) => {
                  setLocationAddRow((prev) => ({ ...prev, caption: e.target.value }))
                  setLocationAddError(null)
                }}
                disabled={isFormDisabled}
              />
            </div>
            <div className="activity-form-panel__field">
              <label htmlFor={`activity-location-longitude-add-${locationAddRow.id}`}>{t('common:itinerary.dayEditor.fieldLongitude')}</label>
              <input
                id={`activity-location-longitude-add-${locationAddRow.id}`}
                type="text"
                value={locationAddRow.longitude}
                onChange={(e) => {
                  setLocationAddRow((prev) => ({ ...prev, longitude: e.target.value, coordinatesManualOverride: true }))
                  setLocationAddError(null)
                }}
                disabled={isFormDisabled}
              />
            </div>
            <div className="activity-form-panel__field">
              <label htmlFor={`activity-location-latitude-add-${locationAddRow.id}`}>{t('common:itinerary.dayEditor.fieldLatitude')}</label>
              <input
                id={`activity-location-latitude-add-${locationAddRow.id}`}
                type="text"
                value={locationAddRow.latitude}
                onChange={(e) => {
                  setLocationAddRow((prev) => ({ ...prev, latitude: e.target.value, coordinatesManualOverride: true }))
                  setLocationAddError(null)
                }}
                disabled={isFormDisabled}
              />
            </div>
          </div>
          <div className="activity-form-panel__field activity-form-panel__location-address-field">
            <div className="activity-form-panel__field-label-row">
              <label htmlFor={`activity-location-address-add-${locationAddRow.id}`}>{t('common:itinerary.dayEditor.fieldLocationAddress')}</label>
              {locationAddMapsUrl ? (
                <a
                  href={locationAddMapsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="activity-form-panel__field-link-icon"
                  aria-label={t('common:itinerary.activityMeta.openMap', { label: locationAddRow.caption || locationAddRow.address })}
                  title={t('common:itinerary.activityMeta.openMap', { label: locationAddRow.caption || locationAddRow.address })}
                >
                  <ArrowSquareOut size={15} weight="bold" />
                </a>
              ) : null}
            </div>
            <input
              id={`activity-location-address-add-${locationAddRow.id}`}
              type="text"
              value={locationAddRow.address}
              onChange={(e) => {
                setLocationAddRow((prev) => ({ ...prev, address: e.target.value }))
                setLocationAddError(null)
              }}
              disabled={isFormDisabled}
            />
          </div>
          <div className="activity-form-panel__block-option">
            <label className="activity-form-panel__checkbox" htmlFor={`activity-location-show-on-map-add-${locationAddRow.id}`}>
              <input
                id={`activity-location-show-on-map-add-${locationAddRow.id}`}
                type="checkbox"
                checked={locationAddRow.showOnMap}
                onChange={(event) => {
                  setLocationAddRow((prev) => ({ ...prev, showOnMap: event.target.checked }))
                  setLocationAddError(null)
                }}
                disabled={isFormDisabled}
              />
              <span className="activity-form-panel__checkbox-indicator" aria-hidden="true">
                <span className="activity-form-panel__checkbox-indicator-mark">✓</span>
              </span>
              <span>{t('common:itinerary.dayEditor.fieldShowOnMap')}</span>
            </label>
          </div>
          {locationAddError ? <p className="activity-form-panel__field-error" role="alert">{locationAddError}</p> : null}
        </div>
      </DialogShell>
    ) : null}
    </>
  )
}
