import type { ProviderId } from '../types'
import { GeminiProvider } from './gemini'
import { GroqProvider } from './groq'
import { OllamaProvider } from './ollama'
import type { FetchLike, ModelProvider } from './types'

export type { ModelProvider, GenerateRequest, FetchLike } from './types'

export interface ProviderInfo {
  id: ProviderId
  name: string
  requiresKey: boolean
  /** Qué datos salen del equipo al usar este proveedor. */
  privacy: string
  defaultModel: string
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Gemini (Google AI Studio)',
    requiresKey: true,
    privacy:
      'El texto de cada consulta se envía a Google. En el nivel gratuito de la API, Google puede usar ese contenido para mejorar sus productos: no pegues código confidencial de terceros.',
    defaultModel: 'gemini-3.8-flash'
  },
  groq: {
    id: 'groq',
    name: 'Groq (rápido)',
    requiresKey: true,
    privacy:
      'El texto de cada consulta se envía a Groq. Es muy rápido y tiene nivel gratuito; no pegues código confidencial de terceros.',
    defaultModel: 'llama-3.3-70b-versatile'
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (local)',
    requiresKey: false,
    privacy: 'Todo se procesa en tu equipo. Ningún dato sale de la máquina (salvo que configures una URL remota).',
    defaultModel: ''
  }
}

export function createProvider(id: ProviderId, opts: { apiKey?: string; ollamaUrl?: string; fetchImpl?: FetchLike }): ModelProvider {
  switch (id) {
    case 'gemini':
      return new GeminiProvider(opts.apiKey ?? '', opts.fetchImpl)
    case 'groq':
      return new GroqProvider(opts.apiKey ?? '', opts.fetchImpl)
    case 'ollama':
      return new OllamaProvider(opts.ollamaUrl, opts.fetchImpl)
  }
}
