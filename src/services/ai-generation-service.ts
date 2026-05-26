import { apiRequest } from '@/services/api-client'
import type {
  AiGenerationHistoryDetail,
  AiGenerationHistoryListParams,
  AiGenerationHistoryListResponse,
  OutputDepth,
  RefinementMode,
} from '@/services/contracts'

export interface ModelInfo {
  id: string
  label: string
}

function toQuery(params: AiGenerationHistoryListParams = {}): string {
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

  if (params.status) {
    query.set('status', params.status)
  }

  const encoded = query.toString()
  return encoded.length > 0 ? `?${encoded}` : ''
}

export async function listAiGenerationHistory(
  params: AiGenerationHistoryListParams = {
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
): Promise<AiGenerationHistoryListResponse> {
  return apiRequest<AiGenerationHistoryListResponse>(`/ai-generation/requests${toQuery(params)}`, {
    method: 'GET',
    protected: true,
  })
}

export async function getAiGenerationHistoryDetail(requestId: string): Promise<AiGenerationHistoryDetail> {
  return apiRequest<AiGenerationHistoryDetail>(`/ai-generation/requests/${requestId}`, {
    method: 'GET',
    protected: true,
  })
}

export async function fetchAvailableModels(signal?: AbortSignal): Promise<ModelInfo[]> {
  const response = await apiRequest<{ models: ModelInfo[] }>('/ai-generation/models', {
    method: 'GET',
    protected: true,
    signal,
  })

  return response.models
}

export async function selectAiDraft(
  draftId: string,
  generationRequestId: string,
  selectedPhotoUrl?: string,
): Promise<{ itineraryId: string; title: string; message: string }> {
  return apiRequest<{ itineraryId: string; title: string; message: string }>(
    '/ai-generation/draft/select',
    {
      method: 'POST',
      body: {
        draftId,
        generationRequestId,
        ...(selectedPhotoUrl ? { selectedPhotoUrl } : {}),
      },
      protected: true,
    },
  )
}

export async function startAiGeneration(
  payload: {
    prompt: string
    model?: string
    draftCount?: number
    outputDepth?: OutputDepth
    languageMode?: 'auto' | 'curated' | 'other'
    languageCode?: 'en' | 'cs-CZ' | 'de' | 'fr' | 'es' | 'it' | 'pt-BR'
    languageOther?: string
    departureFrom?: string
    timing?:
      | 'thisWeekend'
      | 'nextWeek'
      | 'nextMonth'
      | 'summerHoliday'
      | 'winterHoliday'
      | 'customDates'
      | 'flexible'
      | 'other'
    timingOther?: string
    travelerProfile?: 'solo' | 'couple' | 'familyWithKids' | 'friendsGroup' | 'business' | 'other'
    travelerProfileOther?: string
    budgetProfile?: 'budget' | 'midRange' | 'premium' | 'luxury' | 'other'
    budgetProfileOther?: string
    sourceRequestId?: string
    sourceDraftId?: string
    refinementMode?: RefinementMode
  },
): Promise<{ generationRequestId: string; status: 'pending'; message: string; estimatedTime: string }> {
  return apiRequest<{ generationRequestId: string; status: 'pending'; message: string; estimatedTime: string }>(
    '/ai-generation/generate',
    {
      method: 'POST',
      body: payload,
      protected: true,
    },
  )
}
