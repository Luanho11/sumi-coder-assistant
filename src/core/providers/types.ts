import type { ChatMessage, ProviderId, StreamEvent } from '../types'

export type FetchLike = typeof fetch

export interface GenerateRequest {
  model: string
  system: string
  messages: ChatMessage[]
  temperature?: number
  signal?: AbortSignal
}

export interface ModelProvider {
  readonly id: ProviderId
  readonly displayName: string
  /** Genera la respuesta en streaming. Lanza ProviderError ante cualquier fallo. */
  stream(req: GenerateRequest): AsyncGenerator<StreamEvent>
  listModels(signal?: AbortSignal): Promise<string[]>
}
