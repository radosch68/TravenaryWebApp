import { apiRequest } from '@/services/api-client'
import { ApiError } from '@/services/contracts'

export interface DraftDay {
  date: string
  activities: string[]
  notesForDay?: string | null
}

export interface DraftItinerary {
  _id: string
  title: string
  startDate: string
  endDate: string
  activities: string[]
  tags: string[]
  coverPhoto: { url: string; caption?: string | null } | null
  description?: string | null
  language: string
  days?: DraftDay[] | null
}

export interface GenerationStatusResponse {
  requestId: string
  status: 'pending' | 'completed' | 'failed'
  drafts?: DraftItinerary[]
  errorMessage?: string
}

export interface SelectDraftResponse {
  itineraryId: string
  title: string
  message: string
}

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 60000

export async function startGeneration(
  prompt: string,
  model?: string,
): Promise<{ generationRequestId: string; status: 'pending' }> {
  return apiRequest<{ generationRequestId: string; status: 'pending' }>(
    '/ai-generation/generate',
    {
      method: 'POST',
      body: { prompt, ...(model ? { model } : {}) },
      protected: true,
    },
  )
}

export async function pollForDrafts(
  generationRequestId: string,
): Promise<GenerationStatusResponse> {
  return apiRequest<GenerationStatusResponse>(
    `/ai-generation/status/${generationRequestId}`,
    {
      method: 'GET',
      protected: true,
    },
  )
}

export async function pollUntilComplete(
  generationRequestId: string,
  onTick?: () => void,
): Promise<GenerationStatusResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    const result = await pollForDrafts(generationRequestId)

    if (result.status === 'completed' || result.status === 'failed') {
      return result
    }

    onTick?.()
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new ApiError(408, {
    code: 'GENERATION_TIMEOUT',
    message: 'Generation timed out',
  })
}

export async function selectDraft(
  draftId: string,
  generationRequestId: string,
): Promise<SelectDraftResponse> {
  return apiRequest<SelectDraftResponse>('/ai-generation/draft/select', {
    method: 'POST',
    body: { draftId, generationRequestId },
    protected: true,
  })
}
