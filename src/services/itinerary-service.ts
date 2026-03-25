import { apiRequest } from '@/services/api-client'
import type {
  ItineraryDetail,
  ItineraryListParams,
  ItineraryListResponse,
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

export async function getItinerary(itineraryId: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}`, {
    method: 'GET',
    protected: true,
    skipAuthRefreshOn401: true,
  })
}

export async function deleteItinerary(itineraryId: string): Promise<void> {
  await apiRequest<void>(`/itineraries/${itineraryId}`, {
    method: 'DELETE',
    protected: true,
    skipAuthRefreshOn401: true,
  })
}
