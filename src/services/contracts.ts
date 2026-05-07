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
