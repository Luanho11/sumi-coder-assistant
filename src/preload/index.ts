import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Attempt, Draft, InterviewQuestion } from '../core/academy/types'
import type { PlacementAnswer } from '../core/academy/placement'
import type { ProviderInfo } from '../core/providers'
import type { AcademyView, ExamResult, LinkStatus } from '../main/academy'
import type { RunResult } from '../main/sandbox'
import type { UsageDay } from '../main/storage'
import type { InterviewReport } from '../core/academy/types'
import type { Answer } from '../core/academy/v2/grading'
import type { MasteryOutcome, ExamOutcome } from '../core/academy/v2/engine'
import type { RubricGrade, RubricLevel } from '../core/academy/v2/ai-hooks'
import type { Exercise as ExerciseV2, Item as ItemV2, Tier } from '../core/academy/v2/types'
import type {
  Observation,
  ObserverStatus,
  QuickInput,
  LearningProfile,
  ProfileView,
  TurnFeedback,
  ProviderErrorInfo,
  ProviderId,
  RunEvent,
  RunRequest,
  Session,
  SessionSummary,
  Settings,
  SettingsView
} from '../core/types'

// API mínima y tipada expuesta a la interfaz. La interfaz no tiene acceso a Node ni a las claves.
const api = {
  getSettings: (): Promise<SettingsView> => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: Partial<Settings>): Promise<SettingsView> => ipcRenderer.invoke('settings:update', patch),
  setSecret: (id: ProviderId, value: string): Promise<SettingsView> => ipcRenderer.invoke('secret:set', id, value),
  clearSecret: (id: ProviderId): Promise<SettingsView> => ipcRenderer.invoke('secret:clear', id),
  providersInfo: (): Promise<Record<ProviderId, ProviderInfo>> => ipcRenderer.invoke('providers:info'),
  listModels: (id: ProviderId): Promise<{ ok: true; models: string[] } | { ok: false; error: ProviderErrorInfo }> =>
    ipcRenderer.invoke('models:list', id),
  listSessions: (): Promise<SessionSummary[]> => ipcRenderer.invoke('sessions:list'),
  getSession: (id: string): Promise<Session | undefined> => ipcRenderer.invoke('sessions:get', id),
  createSession: (): Promise<Session> => ipcRenderer.invoke('sessions:create'),
  renameSession: (id: string, title: string): Promise<Session> => ipcRenderer.invoke('sessions:rename', id, title),
  deleteSession: (id: string): Promise<void> => ipcRenderer.invoke('sessions:delete', id),
  setFeedback: (sessionId: string, turnId: string, feedback: Omit<TurnFeedback, 'at'> | null): Promise<Session> =>
    ipcRenderer.invoke('turn:feedback', sessionId, turnId, feedback),
  getProfile: (): Promise<ProfileView> => ipcRenderer.invoke('profile:get'),
  updateProfile: (patch: Partial<LearningProfile>): Promise<ProfileView> => ipcRenderer.invoke('profile:update', patch),
  rememberFact: (text: string): Promise<ProfileView> => ipcRenderer.invoke('profile:remember', text),
  forgetFact: (id: string): Promise<ProfileView> => ipcRenderer.invoke('profile:forget', id),
  speak: (text: string): Promise<{ ok: true; audio: string; mime: string } | { ok: false; reason: string; message?: string }> =>
    ipcRenderer.invoke('voice:speak', text),
  transcribe: (wavBase64: string): Promise<{ ok: true; text: string } | { ok: false; reason: string }> => ipcRenderer.invoke('voice:transcribe', wavBase64),
  geminiVoices: (): Promise<string[]> => ipcRenderer.invoke('voice:geminiVoices'),
  fishStatus: (): Promise<{ configured: boolean; source: 'stored' | 'default' | null }> => ipcRenderer.invoke('voice:fishStatus'),
  setFishKey: (value: string): Promise<SettingsView> => ipcRenderer.invoke('voice:setFishKey', value),
  getUsage: (): Promise<UsageDay> => ipcRenderer.invoke('usage:get'),
  onUsage: (cb: (u: UsageDay) => void) => listen('usage:update', cb),
  observerStatus: (): Promise<ObserverStatus> => ipcRenderer.invoke('observer:status'),
  setObserver: (active: boolean): Promise<void> => ipcRenderer.invoke('observer:set', active),
  analyzeScreenNow: (): Promise<Observation | null> => ipcRenderer.invoke('observer:runOnce'),
  captureRegion: (): Promise<QuickInput | null> => ipcRenderer.invoke('capture:region'),
  readClipboard: (): Promise<QuickInput> => ipcRenderer.invoke('quick:clipboard'),
  onQuickInput: (cb: (q: QuickInput) => void) => listen('quick:input', cb),
  onObservation: (cb: (o: Observation) => void) => listen('observer:observation', cb),
  onObserverStatus: (cb: (s: ObserverStatus) => void) => listen('observer:status', cb),
  run: (req: RunRequest): Promise<string> => ipcRenderer.invoke('copilot:run', req),
  cancel: (requestId: string): Promise<void> => ipcRenderer.invoke('copilot:cancel', requestId),
  onRunEvent: (cb: (ev: RunEvent) => void) => listen('copilot:event', cb),
  getAcademy: (): Promise<AcademyView> => ipcRenderer.invoke('academy:get'),
  saveDraft: (exerciseId: string, draft: Omit<Draft, 'updatedAt'>): Promise<AcademyView> => ipcRenderer.invoke('academy:draft', exerciseId, draft),
  markLessonDone: (lessonId: string): Promise<AcademyView> => ipcRenderer.invoke('academy:lessonDone', lessonId),
  evaluate: (exerciseId: string, confidence: number): Promise<AcademyView & { attempt: Attempt; notice?: string }> =>
    ipcRenderer.invoke('academy:evaluate', exerciseId, confidence),
  aiHint: (exerciseId: string, draft: Omit<Draft, 'updatedAt'>): Promise<AcademyView & { text: string }> =>
    ipcRenderer.invoke('academy:aiHint', exerciseId, draft),
  submitPlacement: (answers: PlacementAnswer[], practical: Record<string, string>): Promise<AcademyView & { notice?: string }> =>
    ipcRenderer.invoke('academy:placement', answers, practical),
  runChallenge: (challengeId: string, code: string): Promise<AcademyView & { result: RunResult }> => ipcRenderer.invoke('academy:runChallenge', challengeId, code),
  markChallenge: (challengeId: string): Promise<AcademyView> => ipcRenderer.invoke('academy:markChallenge', challengeId),
  runScratch: (language: 'javascript' | 'sql', code: string, setup?: string): Promise<RunResult> => ipcRenderer.invoke('academy:runScratch', language, code, setup),
  submitExam: (moduleId: string, answers: number[]): Promise<AcademyView & { score: number; correct: number; total: number; results: ExamResult[] }> =>
    ipcRenderer.invoke('academy:submitExam', moduleId, answers),
  interviewStart: (area: string, count: number): Promise<InterviewQuestion[]> => ipcRenderer.invoke('academy:interviewStart', area, count),
  interviewGrade: (answers: { id: string; answer: string }[]): Promise<AcademyView & { interview: InterviewReport; notice?: string }> =>
    ipcRenderer.invoke('academy:interviewGrade', answers),
  // ───────── Academia v2: niveles, compuertas, dominio y práctica escalonada ─────────
  v2: {
    readiness: (lessonId: string, results: boolean[]): Promise<AcademyView> => ipcRenderer.invoke('v2:readiness', lessonId, results),
    partDone: (lessonId: string, partId: string): Promise<AcademyView> => ipcRenderer.invoke('v2:partDone', lessonId, partId),
    checkpoint: (lessonId: string, partId: string, results: boolean[]): Promise<{ reteach: boolean; view: AcademyView }> => ipcRenderer.invoke('v2:checkpoint', lessonId, partId, results),
    pause: (lessonId: string, key: string, answer: string): Promise<AcademyView> => ipcRenderer.invoke('v2:pause', lessonId, key, answer),
    reexplain: (lessonId: string, partId: string, sceneIndex: number, question?: string): Promise<string | null> => ipcRenderer.invoke('v2:reexplain', lessonId, partId, sceneIndex, question),
    practiceSubmit: (p: { lessonId: string; tier: Tier; answer: string; checkAnswers: Record<string, Answer> }): Promise<{
      checks: { id: string; ok: boolean; explanation: string; why?: string }[]
      checksOk: boolean
      grade: RubricGrade | null
      passed: boolean
      needsSelfCheck: boolean
      tooShort: boolean
      view: AcademyView
    }> => ipcRenderer.invoke('v2:practiceSubmit', p),
    practiceSelfCheck: (lessonId: string, tier: Tier, levels: RubricLevel[]): Promise<{ score: number; passed: boolean; view: AcademyView }> => ipcRenderer.invoke('v2:practiceSelfCheck', lessonId, tier, levels),
    masteryStart: (lessonId: string): Promise<ItemV2[]> => ipcRenderer.invoke('v2:masteryStart', lessonId),
    masterySubmit: (lessonId: string, itemIds: string[], answers: Record<string, Answer>, external?: Record<string, boolean>): Promise<MasteryOutcome & { view: AcademyView }> =>
      ipcRenderer.invoke('v2:masterySubmit', lessonId, itemIds, answers, external),
    gradeWritten: (itemId: string, answer: string): Promise<{ score: number; ok: boolean; provisional: boolean; grade: RubricGrade | null; missing: string[] }> => ipcRenderer.invoke('v2:gradeWritten', itemId, answer),
    runCode: (itemId: string, code: string): Promise<RunResult> => ipcRenderer.invoke('v2:runCode', itemId, code),
    gradeTask: (taskId: string, answer: string): Promise<{ grade: RubricGrade | null; needsSelfCheck: boolean; tooShort: boolean; rubric: import('../core/academy/v2/types').Criterion[]; exemplar: string }> => ipcRenderer.invoke('v2:gradeTask', taskId, answer),
    examStart: (kind: 'module' | 'level', id: string): Promise<{ items: ItemV2[]; writtenTasks: ExerciseV2[]; passPct: number }> => ipcRenderer.invoke('v2:examStart', kind, id),
    examSubmit: (
      kind: 'module' | 'level',
      id: string,
      itemIds: string[],
      answers: Record<string, Answer>,
      external?: Record<string, boolean>,
      written?: Record<string, { score: number; provisional?: boolean }>
    ): Promise<ExamOutcome & { view: AcademyView }> => ipcRenderer.invoke('v2:examSubmit', kind, id, itemIds, answers, external, written),
    projectSubmit: (courseId: string, levelId: string, submission: string): Promise<{ grade: RubricGrade | null; needsSelfCheck: boolean; passed: boolean; tooShort?: boolean; view: AcademyView }> =>
      ipcRenderer.invoke('v2:projectSubmit', courseId, levelId, submission),
    projectSelfCheck: (courseId: string, levelId: string, levels: RubricLevel[]): Promise<{ score: number; passed: boolean; view: AcademyView }> => ipcRenderer.invoke('v2:projectSelfCheck', courseId, levelId, levels),
    entryDone: (courseId: string, levelId: string): Promise<AcademyView> => ipcRenderer.invoke('v2:entryDone', courseId, levelId),
    reviewDue: (): Promise<{ lessonId: string; title: string; items: ItemV2[] }[]> => ipcRenderer.invoke('v2:reviewDue'),
    reviewSubmit: (lessonId: string, ok: boolean): Promise<AcademyView> => ipcRenderer.invoke('v2:reviewSubmit', lessonId, ok)
  },
  checkLinks: (urls: string[]): Promise<Record<string, LinkStatus>> => ipcRenderer.invoke('resources:check', urls),
  pickFileToFix: (): Promise<{
    token: string
    name: string
    path: string
    content: string
  } | null> => ipcRenderer.invoke('codefix:pick'),
  proposeFix: (token: string, instruction: string): Promise<{ explanation: string; proposal: string }> =>
    ipcRenderer.invoke('codefix:propose', token, instruction),
  applyFix: (token: string): Promise<{ backup: string }> => ipcRenderer.invoke('codefix:apply', token),
  undoFix: (token: string): Promise<void> => ipcRenderer.invoke('codefix:undo', token)
}

function listen<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

export type CopilotApi = typeof api

contextBridge.exposeInMainWorld('copilot', api)
