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

export interface UserProfile {
  id: string
  email: string
  displayName?: string
  avatarUrl?: string
  preferredLanguage: SupportedLanguage
  authProviders: Array<'password' | 'google' | 'apple' | 'github'>
  createdAt: string
  updatedAt: string
}

export interface WebReference {
  url: string
  caption?: string
  type?: 'photo' | 'video' | 'webpage'
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
  | 'divider'
  | 'shopping'
  | 'tour'

export type AccommodationPlatform = 'booking' | 'airbnb' | 'agoda' | 'direct' | 'other'

export interface ActivityDetails {
  cuisine?: string
  guidanceMode?: 'selfGuided' | 'guided'
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

export interface ItineraryDay {
  dayNumber: number
  date?: string
  summary?: string
  activities: ItineraryActivity[]
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
