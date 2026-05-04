import { apiRequest } from '@/services/api-client'
import type {
  PhotoSearchResult,
  DeleteItineraryDayRequest,
  InsertItineraryDayRequest,
  ItineraryDayInput,
  ItineraryDetail,
  ItineraryListParams,
  ItineraryListResponse,
  ShareTokenResponse,
  SharedItineraryDetail,
  UpdateItineraryRequest,
} from '@/services/contracts'

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

  const encoded = query.toString()
  return encoded.length > 0 ? `?${encoded}` : ''
}

export async function listItineraries(
  params: ItineraryListParams = {
    sortBy: 'plannedStartDate',
    sortOrder: 'asc',
  },
): Promise<ItineraryListResponse> {
  return apiRequest<ItineraryListResponse>(`/itineraries${toQuery(params)}`, {
    method: 'GET',
    protected: true,
  })
}

export async function createItineraryFromTemplate(): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>('/itineraries', {
    method: 'POST',
    body: {},
    protected: true,
  })
}

export interface CreateManualItineraryRequest {
  title: string
  startDate?: string
  days?: ItineraryDayInput[]
}

export async function createManualItinerary(payload: CreateManualItineraryRequest): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>('/itineraries', {
    method: 'POST',
    body: payload,
    protected: true,
  })
}

export async function getItinerary(itineraryId: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}`, {
    method: 'GET',
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

export async function updateItinerary(
  itineraryId: string,
  data: UpdateItineraryRequest,
): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}`, {
    method: 'PATCH',
    body: data,
    protected: true,
  })
}

export async function insertItineraryDay(
  itineraryId: string,
  data: InsertItineraryDayRequest,
): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}/days/insert`, {
    method: 'POST',
    body: data,
    protected: true,
  })
}

export async function deleteItineraryDay(
  itineraryId: string,
  data: DeleteItineraryDayRequest,
): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}/days/delete`, {
    method: 'POST',
    body: data,
    protected: true,
  })
}

export async function createShareLink(
  itineraryId: string,
): Promise<ShareTokenResponse> {
  return apiRequest<ShareTokenResponse>(`/itineraries/${itineraryId}/share`, {
    method: 'POST',
    protected: true,
  })
}

export async function getShareLink(
  itineraryId: string,
): Promise<ShareTokenResponse> {
  return apiRequest<ShareTokenResponse>(`/itineraries/${itineraryId}/share`, {
    method: 'GET',
    protected: true,
  })
}

export async function revokeShareLink(
  itineraryId: string,
): Promise<void> {
  await apiRequest<void>(`/itineraries/${itineraryId}/share`, {
    method: 'DELETE',
    protected: true,
  })
}

export async function getSharedItinerary(
  shareToken: string,
): Promise<SharedItineraryDetail> {
  return apiRequest<SharedItineraryDetail>(`/shared/${shareToken}`, {
    method: 'GET',
    protected: false,
  })
}

export async function searchPhotos(
  keywords: string,
  limit = 3,
): Promise<PhotoSearchResult[]> {
  const response = await apiRequest<{ items: PhotoSearchResult[] }>('/itineraries/photos/search', {
    method: 'POST',
    body: { keywords, limit },
    protected: true,
  })

  return response.items ?? []
}
