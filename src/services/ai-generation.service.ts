import { apiRequest } from '@/services/api-client'
import type { GenerationContextOptions } from '@/services/contracts'

export type OutputDepth = 'fast' | 'balanced' | 'detailed'

export interface DraftActivityObject {
  title: string
  type: string
  time?: string | null
  timeEnd?: string | null
  description?: string | null
}

export type DraftBlockActivity = string | DraftActivityObject

export interface DraftBlock {
  label: string
  activities: DraftBlockActivity[]
}

export interface DraftDay {
  date: string
  blocks: DraftBlock[]
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
  aiModel?: string
  aiResponseTimeMs?: number
  draftCount?: number
  outputDepth?: OutputDepth
}

export interface SelectDraftResponse {
  itineraryId: string
  title: string
  message: string
}

export interface ModelInfo {
  id: string
  label: string
}

const MODEL_TIMEOUT_MS: Record<string, number> = {
  'gpt-3.5-turbo': 180_000,
  'gpt-4o': 240_000,
  'gpt-5.4': 360_000,
}
const DEFAULT_TIMEOUT_MS = 240_000

/** Auto-poll interval after the initial 1 s first poll (milliseconds). */
export const POLL_INTERVAL_MS = 10_000

export function getTimeoutForModel(model?: string): number {
  if (model && model in MODEL_TIMEOUT_MS) {
    return MODEL_TIMEOUT_MS[model]
  }
  return DEFAULT_TIMEOUT_MS
}

export async function fetchAvailableModels(signal?: AbortSignal): Promise<ModelInfo[]> {
  const response = await apiRequest<{ models: ModelInfo[] }>(
    '/ai-generation/models',
    { method: 'GET', protected: true, signal },
  )
  return response.models
}

export async function startGeneration(
  prompt: string,
  model?: string,
  signal?: AbortSignal,
  draftCount?: number,
  outputDepth?: OutputDepth,
  contextOptions?: GenerationContextOptions,
): Promise<{ generationRequestId: string; status: 'pending' }> {
  return apiRequest<{ generationRequestId: string; status: 'pending' }>(
    '/ai-generation/generate',
    {
      method: 'POST',
      body: {
        prompt,
        ...(model ? { model } : {}),
        ...(draftCount != null ? { draftCount } : {}),
        ...(outputDepth ? { outputDepth } : {}),
        ...(contextOptions ? buildContextPayload(contextOptions) : {}),
      },
      protected: true,
      signal,
    },
  )
}

function buildContextPayload(opts: GenerationContextOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (opts.languageMode && opts.languageMode !== 'auto') {
    payload.languageMode = opts.languageMode
    if (opts.languageMode === 'curated' && opts.languageCode) {
      payload.languageCode = opts.languageCode
    }
    if (opts.languageMode === 'other' && opts.languageOther?.trim()) {
      payload.languageOther = opts.languageOther.trim()
    }
  }
  if (opts.timing) {
    payload.timing = opts.timing
    if (opts.timing === 'other' && opts.timingOther?.trim()) {
      payload.timingOther = opts.timingOther.trim()
    }
  }
  if (opts.travelerProfile) {
    payload.travelerProfile = opts.travelerProfile
    if (opts.travelerProfile === 'other' && opts.travelerProfileOther?.trim()) {
      payload.travelerProfileOther = opts.travelerProfileOther.trim()
    }
  }
  if (opts.budgetProfile) {
    payload.budgetProfile = opts.budgetProfile
    if (opts.budgetProfile === 'other' && opts.budgetProfileOther?.trim()) {
      payload.budgetProfileOther = opts.budgetProfileOther.trim()
    }
  }
  return payload
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
