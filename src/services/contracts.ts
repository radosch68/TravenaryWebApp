export interface ErrorDetail {
  field?: string
  message: string
}

export interface ErrorResponse {
  code: string
  message: string
  details?: ErrorDetail[]
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type SupportedLanguage = 'en' | 'cs-CZ'

export interface LastOpenedItinerary {
  itineraryId: string
  itineraryTitle?: string
  openedAt: string
}

export interface UserProfile {
  id: string
  email: string
  displayName?: string
  avatarUrl?: string
  preferredLanguage: SupportedLanguage
  authProviders: Array<'password' | 'google' | 'apple' | 'github'>
  lastOpenedItinerary?: LastOpenedItinerary
  createdAt: string
  updatedAt: string
}

export interface WebReference {
  url: string
  caption?: string
  type?: 'photo' | 'video' | 'webpage'
  source?: 'unsplash'
  authorName?: string
  authorUrl?: string
  sourceUrl?: string
  downloadLocation?: string
}

export interface PhotoSearchResult extends WebReference {
  source: 'unsplash'
  thumbnailUrl?: string
}

export type ActivityType =
  | 'note'
  | 'flight'
  | 'accommodation'
  | 'transfer'
  | 'poi'
  | 'carRental'
  | 'custom'
  | 'food'
  | 'shopping'
  | 'tour'

export type AccommodationPlatform = 'booking' | 'airbnb' | 'agoda' | 'direct' | 'other'
export type TransferMot = 'walk' | 'bike' | 'motorcycle' | 'car' | 'bus' | 'train' | 'plane'

export interface TransferLocation {
  caption?: string
  showOnMap?: boolean
  coordinates?: number[]
  address?: string
}

export interface TransferEstimate {
  value: string
  source?: 'google' | 'manual' | 'fallback'
  updatedAt?: string
}

export interface ActivityDetails {
  cuisine?: string
  guidanceMode?: 'selfGuided' | 'guided'
  from?: TransferLocation
  to?: TransferLocation
  mot?: TransferMot
  estimate?: TransferEstimate
  nights?: number
  guests?: number
  checkInFrom?: string
  checkInUntil?: string
  checkOutUntil?: string
  platform?: AccommodationPlatform
  contactPhone?: string
  contactEmail?: string
  bookingRef?: string
}

export interface ActivityLocation {
  caption?: string
  showOnMap?: boolean
  coordinates?: number[]
  address?: string
}

export interface ItineraryActivity {
  id: string
  type: ActivityType
  title: string
  text?: string
  time?: string
  timeEnd?: string
  anchorDate?: string | null
  details?: ActivityDetails
  references?: WebReference[]
  locations?: ActivityLocation[]
}

export interface DayDocumentNode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<Record<string, unknown>>
  content?: DayDocumentNode[]
}

export interface ItineraryDay {
  dayNumber: number
  date?: string
  summary?: string
  document: DayDocumentNode[]
}

export interface ItineraryDetail {
  id: string
  userId: string
  templateId?: string
  title: string
  description?: string
  tags: string[]
  visibility: 'private' | 'shared' | 'public'
  coverPhoto?: WebReference
  startDate?: string
  endDate?: string
  schemaVer: number
  hasShareLink: boolean
  days: ItineraryDay[]
  activityBench: ItineraryActivity[]
  createdAt: string
  updatedAt: string
}

export type SharedItineraryDetail = Omit<ItineraryDetail, 'userId' | 'hasShareLink'>

export interface ShareTokenResponse {
  shareToken: string
  shareUrl: string
}

export interface ItinerarySummary {
  id: string
  title: string
  coverPhoto?: WebReference
  tags: string[]
  visibility: 'private' | 'shared' | 'public'
  startDate?: string
  endDate?: string
  dayCount: number
  activityCount: number
  createdAt: string
  updatedAt: string
}

export interface ItineraryListResponse {
  items: ItinerarySummary[]
  page: number
  limit: number
  total: number
}

export interface ItineraryListParams {
  page?: number
  limit?: number
  sortBy?: 'plannedStartDate' | 'createdAt' | 'dayCount' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  includePast?: boolean
}

export type OutputDepth = 'fast' | 'balanced' | 'detailed'
export type RefinementMode = 'balanced' | 'strict'

export type GenerationRequestStatus = 'pending' | 'completed' | 'failed'

export interface DraftActivityObject {
  title: string
  type: 'note' | 'poi' | 'food' | 'custom' | 'accommodation' | 'transfer' | 'flight' | 'carRental'
  time?: string | null
  timeEnd?: string | null
  description?: string | null
}

export type DraftBlockActivity = string | DraftActivityObject

export interface DraftBlock {
  label: string
  activities: DraftBlockActivity[]
}

export interface DraftDay {
  date: string
  blocks: DraftBlock[]
  notesForDay?: string | null
}

export interface AiCoverPhotoOption {
  url: string
  caption?: string | null
  source?: 'unsplash'
  authorName?: string
  authorUrl?: string
  sourceUrl?: string
  downloadLocation?: string
  thumbnailUrl?: string
}

export interface AiDraftItinerary {
  _id: string
  title: string
  startDate: string
  endDate: string
  activities: string[]
  activityBench?: DraftBlockActivity[]
  tags: string[]
  destinationKeywords?: string
  coverPhotoOptions?: AiCoverPhotoOption[]
  description?: string | null
  language: string
  days?: DraftDay[] | null
}

export interface AiGenerationContext {
  languageMode: 'auto' | 'curated' | 'other' | null
  languageCode: 'en' | 'cs-CZ' | 'de' | 'fr' | 'es' | 'it' | 'pt-BR' | null
  languageOther: string | null
  departureFrom: string | null
  timing:
    | 'thisWeekend'
    | 'nextWeek'
    | 'nextMonth'
    | 'summerHoliday'
    | 'winterHoliday'
    | 'customDates'
    | 'flexible'
    | 'other'
    | null
  timingOther: string | null
  travelerProfile: 'solo' | 'couple' | 'familyWithKids' | 'friendsGroup' | 'business' | 'other' | null
  travelerProfileOther: string | null
  budgetProfile: 'budget' | 'midRange' | 'premium' | 'luxury' | 'other' | null
  budgetProfileOther: string | null
}

export interface AiGenerationHistoryItem {
  id: string
  prompt: string
  status: GenerationRequestStatus
  selectedModel: string
  requestedDraftCount: number
  generatedDraftCount: number
  outputDepth: OutputDepth
  dayCount: number
  ancestorCount: number
  refinementMode: RefinementMode | null
  createdAt: string
  updatedAt: string
  generationStartedAt?: string
  generationCompletedAt?: string
}

export interface AiGenerationHistoryListResponse {
  items: AiGenerationHistoryItem[]
  page: number
  limit: number
  total: number
  retentionDays: number
}

export interface AiGenerationHistoryDetail {
  id: string
  prompt: string
  status: GenerationRequestStatus
  selectedModel: string
  requestedDraftCount: number
  generatedDraftCount: number
  outputDepth: OutputDepth
  sourceRequestId: string | null
  sourceDraftId: string | null
  refinementMode: RefinementMode | null
  ancestorCount: number
  context: AiGenerationContext
  dayCount: number
  errorMessage?: string
  aiModel?: string
  aiResponseTimeMs?: number
  generationStartedAt?: string
  generationCompletedAt?: string
  createdAt: string
  updatedAt: string
  lineage: AiGenerationHistoryItem[]
  drafts: AiDraftItinerary[]
}

export interface AiGenerationHistoryListParams {
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'generationCompletedAt' | 'draftCount'
  sortOrder?: 'asc' | 'desc'
  status?: GenerationRequestStatus
}

export class ApiError extends Error {
  status: number
  code: string
  details?: ErrorDetail[]

  constructor(status: number, payload: Partial<ErrorResponse>) {
    super(payload.message ?? 'Request failed')
    this.name = 'ApiError'
    this.status = status
    this.code = payload.code ?? 'UNKNOWN_ERROR'
    this.details = payload.details
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  protected?: boolean
  isRetrying?: boolean
  timeoutMs?: number
  skipAuthRefreshOn401?: boolean
  signal?: AbortSignal
}
