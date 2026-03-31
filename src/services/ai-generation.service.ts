import { apiRequest } from '@/services/api-client'
import { ApiError } from '@/services/contracts'

export interface DraftDay {
  date: string
  activities: string[]
  notesForDay?: string | null
}

export interface CoverPhotoOption {
  url: string
  caption?: string | null
}

export interface DraftItinerary {
  _id: string
  title: string
  startDate: string
  endDate: string
  activities: string[]
  tags: string[]
  destinationKeywords?: string
  coverPhotoOptions?: CoverPhotoOption[]
  description?: string | null
  language: string
  days?: DraftDay[] | null
}

export interface GenerationStatusResponse {
  generationRequestId: string
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
  signal?: AbortSignal,
): Promise<{ generationRequestId: string; status: 'pending' }> {
  return apiRequest<{ generationRequestId: string; status: 'pending' }>(
    '/ai-generation/generate',
    {
      method: 'POST',
      body: { prompt, ...(model ? { model } : {}) },
      protected: true,
      signal,
    },
  )
}

export async function pollForDrafts(
  generationRequestId: string,
  signal?: AbortSignal,
): Promise<GenerationStatusResponse> {
  return apiRequest<GenerationStatusResponse>(
    `/ai-generation/status/${generationRequestId}`,
    {
      method: 'GET',
      protected: true,
      signal,
    },
  )
}

function waitForNextPoll(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, delayMs)

    const handleAbort = (): void => {
      window.clearTimeout(timeoutId)
      signal?.removeEventListener('abort', handleAbort)
      reject(new ApiError(499, { code: 'REQUEST_ABORTED', message: 'Request was aborted' }))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

export async function pollUntilComplete(
  generationRequestId: string,
  onTick?: () => void,
  signal?: AbortSignal,
): Promise<GenerationStatusResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new ApiError(499, { code: 'REQUEST_ABORTED', message: 'Request was aborted' })
    }

    const result = await pollForDrafts(generationRequestId, signal)

    if (result.status === 'completed' || result.status === 'failed') {
      return result
    }

    onTick?.()
    await waitForNextPoll(POLL_INTERVAL_MS, signal)
  }

  throw new ApiError(408, {
    code: 'GENERATION_TIMEOUT',
    message: 'Generation timed out',
  })
}

export async function selectDraft(
  draftId: string,
  generationRequestId: string,
  selectedPhotoUrl?: string,
  signal?: AbortSignal,
): Promise<SelectDraftResponse> {
  return apiRequest<SelectDraftResponse>('/ai-generation/draft/select', {
    method: 'POST',
    body: {
      draftId,
      generationRequestId,
      ...(selectedPhotoUrl ? { selectedPhotoUrl } : {}),
    },
    protected: true,
    signal,
  })
}
