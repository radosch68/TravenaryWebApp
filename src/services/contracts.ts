export interface ErrorDetail {
  field?: string
  message: string
}

export interface ErrorResponse {
  code: string
  message: string
  details?: ErrorDetail[]
}

export type SupportedLanguage = 'en' | 'cs-CZ'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

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

export interface WebReference {
  url: string
  caption?: string
  type?: 'photo' | 'video' | 'webpage'
}

export type ActivityType = 'note' | 'flight' | 'accommodation' | 'transfer' | 'poi' | 'carRental' | 'custom' | 'food' | 'divider'

export interface ItineraryActivity {
  id: string
  type: ActivityType
  subType?: 'start' | 'end'
  title: string
  text?: string
  time?: string
  timeEnd?: string
  bookingRef?: string
  serviceCode?: string
  vendor?: string
  airport?: string
  activityGroupId?: string
  pairedActivityId?: string
  isAnchored: boolean
}

export type ItineraryActivityInput = Omit<ItineraryActivity, 'isAnchored'> & {
  isAnchored?: boolean
}

export interface ItineraryDay {
  dayNumber: number
  date?: string
  summary?: string
  activities: ItineraryActivity[]
}

export interface ItineraryDayInput {
  dayNumber: number
  summary?: string
  activities: ItineraryActivityInput[]
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
  hasShareLink: boolean
  days: ItineraryDay[]
  createdAt: string
  updatedAt: string
}

export type SharedItineraryDetail = Omit<ItineraryDetail, 'userId' | 'hasShareLink'>

export interface ShareTokenResponse {
  shareToken: string
  shareUrl: string
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
  sortBy?: 'plannedStartDate'
  sortOrder?: 'asc'
}

export interface UpdateItineraryRequest {
  title?: string
  description?: string
  tags?: string[]
  visibility?: 'private' | 'shared' | 'public'
  coverPhoto?: WebReference | null
  startDate?: string | null
  days?: ItineraryDayInput[]
}

export type LanguageMode = 'auto' | 'curated' | 'other'
export type CuratedLanguageCode = 'en' | 'cs-CZ' | 'de' | 'fr' | 'es' | 'it' | 'pt-BR'
export type TimingValue = 'thisWeekend' | 'nextWeek' | 'nextMonth' | 'summerHoliday' | 'winterHoliday' | 'customDates' | 'flexible' | 'other'
export type TravelerProfileValue = 'solo' | 'couple' | 'familyWithKids' | 'friendsGroup' | 'business' | 'other'
export type BudgetProfileValue = 'budget' | 'midRange' | 'premium' | 'luxury' | 'other'

export interface GenerationContextOptions {
  languageMode?: LanguageMode
  languageCode?: CuratedLanguageCode
  languageOther?: string
  departureFrom?: string
  timing?: TimingValue
  timingOther?: string
  travelerProfile?: TravelerProfileValue
  travelerProfileOther?: string
  budgetProfile?: BudgetProfileValue
  budgetProfileOther?: string
}
