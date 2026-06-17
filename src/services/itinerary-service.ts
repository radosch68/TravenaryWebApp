import { apiRequest } from '@/services/api-client'
import type {
  DayDocumentNode,
  ItineraryActivity,
  FlightAirport,
  ItineraryDetail,
  ItineraryDay,
  ItineraryListParams,
  ItineraryListResponse,
  PhotoSearchResult,
  ShareTokenResponse,
  SharedItineraryDetail,
  WebReference,
} from '@/services/contracts'

function normalizeDay(day: ItineraryDay): ItineraryDay {
  return {
    ...day,
    document: day.document ?? [],
  }
}

function toQuery(params: ItineraryListParams = {}): string {
  const query = new URLSearchParams()

  if (params.page) {
    query.set('page', String(params.page))
  }

  if (params.limit) {
    query.set('limit', String(params.limit))
  }

  if (params.sortBy) {
    query.set('sortBy', params.sortBy)
  }

  if (params.sortOrder) {
    query.set('sortOrder', params.sortOrder)
  }

  if (typeof params.includePast === 'boolean') {
    query.set('includePast', String(params.includePast))
  }

  const encoded = query.toString()
  return encoded.length > 0 ? `?${encoded}` : ''
}

export async function listItineraries(
  params: ItineraryListParams = {
    sortBy: 'plannedStartDate',
    sortOrder: 'asc',
    includePast: false,
  },
): Promise<ItineraryListResponse> {
  return apiRequest<ItineraryListResponse>(`/itineraries${toQuery(params)}`, {
    method: 'GET',
    protected: true,
  })
}

export async function createItineraryFromTemplate(): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/itineraries', {
    method: 'POST',
    body: {},
    protected: true,
  })
}

export interface CreateManualItineraryRequest {
  title: string
  startDate?: string
  days?: Array<{
    dayNumber: number
    document: DayDocumentNode[]
  }>
}

export interface UpdateItineraryRequest {
  title?: string
  description?: string
  tags?: string[]
  visibility?: 'private' | 'shared' | 'public'
  coverPhoto?: WebReference | null
  templateId?: string
  startDate?: string | null
  days?: Array<{
    dayNumber: number
    summary?: string
    document: DayDocumentNode[]
  }>
  activityBench?: ItineraryActivity[]
}

export interface UpdateItineraryDayRequest {
  summary?: string
  document: DayDocumentNode[]
  activityBench?: ItineraryActivity[]
}

export interface InsertItineraryDayRequest {
  dayNumber: number
  summary?: string
}

export type DeleteItineraryDayMode = 'delete' | 'move' | 'bench'

export interface DeleteItineraryDayRequest {
  dayNumber: number
  mode: DeleteItineraryDayMode
  targetDayNumber?: number
}

export async function createManualItinerary(
  payload: CreateManualItineraryRequest,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/itineraries', {
    method: 'POST',
    body: payload,
    protected: true,
  })
}

export async function getItinerary(itineraryId: string): Promise<ItineraryDetail> {
  const itinerary = await apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}`, {
    method: 'GET',
    protected: true,
  })

  return {
    ...itinerary,
    days: itinerary.days.map((day: ItineraryDay) => normalizeDay(day)),
  }
}

export async function getSharedItinerary(shareToken: string): Promise<SharedItineraryDetail> {
  const itinerary = await apiRequest<SharedItineraryDetail>(`/shared/${shareToken}`, {
    method: 'GET',
    protected: false,
  })

  return {
    ...itinerary,
    days: itinerary.days.map((day: ItineraryDay) => normalizeDay(day)),
  }
}

export async function updateItinerary(
  itineraryId: string,
  payload: UpdateItineraryRequest,
): Promise<ItineraryDetail> {
  const itinerary = await apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}`, {
    method: 'PATCH',
    body: payload,
    protected: true,
  })

  return {
    ...itinerary,
    days: itinerary.days.map((day: ItineraryDay) => normalizeDay(day)),
  }
}

export async function updateItineraryDay(
  itineraryId: string,
  dayNumber: number,
  payload: UpdateItineraryDayRequest,
): Promise<ItineraryDetail> {
  const itinerary = await apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}/days/${dayNumber}`, {
    method: 'PATCH',
    body: payload,
    protected: true,
  })

  return {
    ...itinerary,
    days: itinerary.days.map((day: ItineraryDay) => normalizeDay(day)),
  }
}

export async function insertItineraryDay(
  itineraryId: string,
  payload: InsertItineraryDayRequest,
): Promise<ItineraryDetail> {
  const itinerary = await apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}/days/insert`, {
    method: 'POST',
    body: payload,
    protected: true,
  })

  return {
    ...itinerary,
    days: itinerary.days.map((day: ItineraryDay) => normalizeDay(day)),
  }
}

export async function deleteItineraryDay(
  itineraryId: string,
  payload: DeleteItineraryDayRequest,
): Promise<ItineraryDetail> {
  const itinerary = await apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}/days/delete`, {
    method: 'POST',
    body: payload,
    protected: true,
  })

  return {
    ...itinerary,
    days: itinerary.days.map((day: ItineraryDay) => normalizeDay(day)),
  }
}

export async function createShareLink(itineraryId: string): Promise<ShareTokenResponse> {
  return apiRequest<ShareTokenResponse>(`/itineraries/${itineraryId}/share`, {
    method: 'POST',
    protected: true,
  })
}

export async function getShareLink(itineraryId: string): Promise<ShareTokenResponse> {
  return apiRequest<ShareTokenResponse>(`/itineraries/${itineraryId}/share`, {
    method: 'GET',
    protected: true,
  })
}

export async function revokeShareLink(itineraryId: string): Promise<void> {
  await apiRequest<void>(`/itineraries/${itineraryId}/share`, {
    method: 'DELETE',
    protected: true,
  })
}

export async function deleteItinerary(itineraryId: string): Promise<void> {
  await apiRequest<void>(`/itineraries/${itineraryId}`, {
    method: 'DELETE',
    protected: true,
    skipAuthRefreshOn401: true,
  })
}

export async function searchPhotos(keywords: string, limit = 3): Promise<PhotoSearchResult[]> {
  const response = await apiRequest<{ items: PhotoSearchResult[] }>('/itineraries/photos/search', {
    method: 'POST',
    body: {
      keywords,
      limit,
    },
    protected: true,
  })

  return response.items ?? []
}

export async function geocodeAddress(
  query: string,
): Promise<{ configured: boolean; coordinates: [number, number] | null }> {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return { configured: true, coordinates: null }
  }

  return apiRequest<{ configured: boolean; coordinates: [number, number] | null }>(
    `/geocode?q=${encodeURIComponent(trimmed)}`,
    { protected: true },
  )
}

export async function searchAirports(query: string, signal?: AbortSignal): Promise<FlightAirport[]> {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return []
  }

  const response = await apiRequest<{ airports: FlightAirport[] }>(
    `/airports?q=${encodeURIComponent(trimmed)}`,
    { protected: true, signal },
  )

  return response.airports ?? []
}
