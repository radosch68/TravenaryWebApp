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

export interface UserProfile {
  id: string
  email: string
  displayName?: string
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
}

export interface WebReference {
  url: string
  caption?: string
  type?: 'photo' | 'video' | 'webpage'
}

export interface ItineraryActivity {
  id: string
  type: 'note' | 'flight' | 'accommodation' | 'transfer' | 'poi' | 'carRental' | 'custom'
  subType?: 'start' | 'end'
  title: string
  text?: string
  time?: string
  timeEnd?: string
}

export interface ItineraryDay {
  dayNumber: number
  date?: string
  summary?: string
  activities: ItineraryActivity[]
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
  days: ItineraryDay[]
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
  sortBy?: 'plannedStartDate'
  sortOrder?: 'asc'
}
