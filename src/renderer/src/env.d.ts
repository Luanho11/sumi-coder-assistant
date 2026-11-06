import type { CopilotApi } from '../../preload'

declare global {
  interface Window {
    copilot: CopilotApi
  }
}
