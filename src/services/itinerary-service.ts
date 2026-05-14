import { apiRequest } from '@/services/api-client'
import type {
  ItineraryDetail,
  ItineraryListParams,
  ItineraryListResponse,
  ShareTokenResponse,
  SharedItineraryDetail,
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

export async function getItinerary(itineraryId: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}`, {
    method: 'GET',
    protected: true,
  })
}

export async function getSharedItinerary(shareToken: string): Promise<SharedItineraryDetail> {
  return apiRequest<SharedItineraryDetail>(`/shared/${shareToken}`, {
    method: 'GET',
    protected: false,
  })
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
