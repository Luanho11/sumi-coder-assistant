import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, nativeImage, Notification, powerMonitor, safeStorage, shell, type IpcMainInvokeEvent, type NativeImage } from 'electron'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { executeTurn } from '../core/copilot'
import { OBSERVER_SYSTEM } from '../core/observer'
import { buildProfilePrompt, computeInsights } from '../core/profile'
import { buildSystemPrompt, deriveTitle } from '../core/prompts'
import { createProvider, PROVIDERS } from '../core/providers'
import { DEFAULT_FISH_VOICE, fishSpeech, geminiSpeech, geminiTranscribe, GEMINI_VOICES, speakableText } from '../core/voice'
import type {
  ChatMessage,
  CopilotAction,
  ImageAttachment,
  ProfileView,
  ProviderId,
  QuickInput,
  RunEvent,
  RunRequest,
  Settings,
  SettingsView,
  TurnFeedback
} from '../core/types'
import { registerAcademy } from './academy'
import { registerCodeFix } from './codefix'
import { migrateUserData } from './migrate'
import { ScreenObserver } from './observer'
import { captureScreen, screenSignature, selectRegion, toAttachment } from './screen'
import { SecretStore } from './secrets'
import { AcademyStore, ProfileStore, SessionStore, SettingsStore, UsageStore } from './storage'

const ACTIONS: CopilotAction[] = ['analyze', 'hint', 'debug', 'review', 'tests', 'explain', 'followup', 'lesson']
const NEEDS_INPUT: CopilotAction[] = ['analyze', 'followup', 'lesson']
const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'ollama']
/** Variables de entorno aceptadas como alternativa a guardar la clave (útil en desarrollo). */
const ENV_KEYS: Partial<Record<ProviderId, string>> = { gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY' }
/** Claves gratuitas precargadas en el build (si existe out/main/default-keys.json). No se versiona. */
let defaultKeys: { gemini?: string; groq?: string; fishAudio?: string } = {}
function loadDefaultKeys(): void {
  try {
    defaultKeys = JSON.parse(readFileSync(path.join(__dirname, 'default-keys.json'), 'utf8'))
  } catch {
    defaultKeys = {}
  }
}
const APP_NAME = 'XARA Coder Assistant'
const MAX_INPUT_CHARS = 200_000
const MAX_IMAGE_BASE64 = 10_000_000
const SHORTCUTS = {
  region: 'CommandOrControl+Alt+S',
  clipboard: 'CommandOrControl+Alt+C',
  observer: 'CommandOrControl+Alt+O',
  toggleWindow: 'CommandOrControl+Alt+J'
}

let win: BrowserWindow | null = null
let settingsStore: SettingsStore
let sessionStore: SessionStore
let secretStore: SecretStore
let profileStore: ProfileStore
let academyStore: AcademyStore
let usageStore: UsageStore
let observer: ScreenObserver
let shortcutConflicts: string[] = []
const running = new Map<string, { controller: AbortController; sessionId: string }>()

async function getApiKey(id: ProviderId): Promise<string | undefined> {
  const stored = await secretStore.get(id)
  if (stored) return stored
  const env = ENV_KEYS[id]
  if (env && process.env[env]) return process.env[env]
  // Clave gratuita precargada (si el build la trae).
  return (id === 'gemini' || id === 'groq') ? defaultKeys[id] || undefined : undefined
}

/** Clave de Fish Audio (voz Verity): la guardada por el usuario o la precargada en el build. */
async function getFishKey(): Promise<string | undefined> {
  return (await secretStore.get('fish' as ProviderId)) || defaultKeys.fishAudio || undefined
}

async function settingsView(): Promise<SettingsView> {
  const s = await settingsStore.get()
  const secrets = {} as SettingsView['secrets']
  for (const id of PROVIDER_IDS) {
    if (await secretStore.has(id)) secrets[id] = { configured: true, source: 'stored' }
    else if (ENV_KEYS[id] && process.env[ENV_KEYS[id]!]) secrets[id] = { configured: true, source: 'env' }
    else if ((id === 'gemini' || id === 'groq') && defaultKeys[id]) secrets[id] = { configured: true, source: 'env' }
    else secrets[id] = { configured: false }
  }
  return { ...s, secrets, encryptionAvailable: await secretStore.isAvailable(), shortcutConflicts }
}

async function providerFor(id: ProviderId, settings: Settings) {
  return createProvider(id, { apiKey: await getApiKey(id), ollamaUrl: settings.ollamaUrl })
}

function assertProvider(id: unknown): ProviderId {
  if (!PROVIDER_IDS.includes(id as ProviderId)) throw new Error('Proveedor no válido.')
  return id as ProviderId
}

function sanitizeSettingsPatch(patch: unknown): Partial<Settings> {
  if (typeof patch !== 'object' || patch === null) return {}
  const p = patch as Record<string, unknown>
  const out: Partial<Settings> = {}
  if (p.providerId !== undefined) out.providerId = assertProvider(p.providerId)
  if (typeof p.ollamaUrl === 'string') out.ollamaUrl = p.ollamaUrl.trim()
  if (typeof p.alwaysOnTop === 'boolean') out.alwaysOnTop = p.alwaysOnTop
  if (typeof p.codeFix === 'boolean') out.codeFix = p.codeFix
  if (typeof p.voice === 'object' && p.voice !== null) {
    const v = p.voice as Record<string, unknown>
    out.voice = {
      engine: v.engine === 'sistema' || v.engine === 'gemini' || v.engine === 'fish' ? v.engine : 'fish',
      autoRead: v.autoRead === true,
      geminiVoice: typeof v.geminiVoice === 'string' ? v.geminiVoice : 'Kore',
      fishModel: typeof v.fishModel === 'string' ? v.fishModel : '',
      systemVoice: typeof v.systemVoice === 'string' ? v.systemVoice : '',
      volume: typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1 ? v.volume : 1
    }
  }
  if (typeof p.observer === 'object' && p.observer !== null) {
    const o = p.observer as Record<string, unknown>
    out.observer = { intervalSec: Number(o.intervalSec), dailyCap: Number(o.dailyCap) }
  }
  if (typeof p.models === 'object' && p.models !== null) {
    const m = p.models as Record<string, unknown>
    out.models = {} as Settings['models']
    for (const id of PROVIDER_IDS) if (typeof m[id] === 'string') out.models[id] = (m[id] as string).trim()
  }
  return out
}

async function profileView(): Promise<ProfileView> {
  const profile = await profileStore.get()
  const insights = computeInsights(await sessionStore.all())
  return { ...profile, insights, promptBlock: buildProfilePrompt(profile, insights) }
}

function sanitizeFeedback(fb: unknown): TurnFeedback | null {
  if (fb === null) return null
  const f = fb as Partial<TurnFeedback>
  if (f?.rating !== 'up' && f?.rating !== 'down') throw new Error('Valoración no válida.')
  const note = typeof f.note === 'string' ? f.note.trim().slice(0, 120) : undefined
  return { rating: f.rating, ...(note ? { note } : {}), at: new Date().toISOString() }
}

function validImage(img: unknown): ImageAttachment | undefined {
  if (img === undefined || img === null) return undefined
  const i = img as Partial<ImageAttachment>
  if ((i.mimeType !== 'image/png' && i.mimeType !== 'image/jpeg') || typeof i.data !== 'string' || i.data.length > MAX_IMAGE_BASE64) {
    throw new Error('Imagen no válida o demasiado grande.')
  }
  return { mimeType: i.mimeType, data: i.data }
}

function toRenderer(channel: string, payload: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function send(event: RunEvent): void {
  toRenderer('copilot:event', event)
}

function showWindow(): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function quickInputFrom(img: NativeImage): QuickInput {
  const image = toAttachment(img)
  return { image, preview: `data:${image.mimeType};base64,${image.data}` }
}

async function captureRegion(): Promise<QuickInput | null> {
  // Se oculta la ventana para capturar lo que hay debajo.
  win?.hide()
  await new Promise((r) => setTimeout(r, 250))
  try {
    const region = await selectRegion(await captureScreen(), process.env.ELECTRON_RENDERER_URL)
    return region ? quickInputFrom(region) : null
  } finally {
    // Se muestra aunque estuviera oculta: el recorte llega al campo de texto de la app.
    showWindow()
  }
}

/** Lee lo que el usuario copió (texto o imagen), porque Electron no puede leer la selección de otras apps. */
async function readClipboard(): Promise<QuickInput> {
  const text = (await clipboard.readText()).trim()
  if (text) return { text: text.slice(0, MAX_INPUT_CHARS) }
  for (const item of await clipboard.read()) {
    if (!item.types.includes('image/png')) continue
    const blob = (await item.getType('image/png')) as Blob
    const img = nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()))
    if (!img.isEmpty()) return quickInputFrom(img)
  }
  return {}
}

/** Cuenta una llamada al proveedor y avisa a la interfaz para mostrar el uso del día. */
function bumpUsage(id: ProviderId): void {
  void usageStore.bump(id).then((day) => toRenderer('usage:update', day))
}

/** Llamada sin streaming hacia la interfaz: se acumula la respuesta completa del proveedor activo. */
async function complete(system: string, messages: ChatMessage[], signal: AbortSignal): Promise<string> {
  const settings = await settingsStore.get()
  const provider = await providerFor(settings.providerId, settings)
  bumpUsage(settings.providerId)
  let text = ''
  for await (const ev of provider.stream({ model: settings.models[settings.providerId], system, messages, temperature: 0.2, signal })) {
    if (ev.type === 'delta') text += ev.text
  }
  return text
}

async function analyzeScreen(image: ImageAttachment): Promise<string> {
  const { promptBlock } = await profileView()
  return complete(
    promptBlock ? `${OBSERVER_SYSTEM}\n\n${promptBlock}` : OBSERVER_SYSTEM,
    [{ role: 'user', content: 'Captura actual de mi pantalla.', images: [image] }],
    AbortSignal.timeout(60_000)
  )
}

async function setObserver(active: boolean): Promise<void> {
  if (active) await observer.start()
  else await observer.stop()
  win?.setTitle(active ? `${APP_NAME} · ● Observando pantalla` : APP_NAME)
  if (active && Notification.isSupported()) {
    new Notification({ title: 'Modo observador activado', body: 'XARA analizará tu pantalla periódicamente. Ctrl+Alt+O para pausarlo.' }).show()
  }
}

function registerShortcuts(): void {
  const actions: Record<keyof typeof SHORTCUTS, () => void> = {
    region: () => void captureRegion().then((q) => q && toRenderer('quick:input', q)),
    clipboard: () => {
      showWindow()
      void readClipboard().then((q) => toRenderer('quick:input', q))
    },
    observer: () => void observer.status().then((st) => setObserver(!st.active)),
    toggleWindow: () => (win?.isVisible() && win.isFocused() ? win.hide() : showWindow())
  }
  shortcutConflicts = []
  for (const [name, accelerator] of Object.entries(SHORTCUTS) as [keyof typeof SHORTCUTS, string][]) {
    if (!globalShortcut.register(accelerator, actions[name])) shortcutConflicts.push(accelerator)
  }
}

async function run(req: RunRequest): Promise<string> {
  if (!ACTIONS.includes(req.action)) throw new Error('Acción no válida.')
  if (typeof req.input !== 'string' || req.input.length > MAX_INPUT_CHARS) throw new Error('Entrada no válida o demasiado larga.')
  if (NEEDS_INPUT.includes(req.action) && !req.input.trim() && !req.image) throw new Error('Escribe una pregunta o pega un enunciado.')
  for (const r of running.values()) {
    if (r.sessionId === req.sessionId) throw new Error('Ya hay una consulta en curso en esta sesión.')
  }
  const image = validImage(req.image)
  const session = await sessionStore.get(req.sessionId)
  if (!session) throw new Error('La sesión no existe.')

  const settings = await settingsStore.get()
  const provider = await providerFor(settings.providerId, settings)
  const model = settings.models[settings.providerId]
  bumpUsage(settings.providerId)
  const { promptBlock } = await profileView()
  if (typeof req.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(req.requestId) || running.has(req.requestId)) {
    throw new Error('Identificador de consulta no válido.')
  }
  const requestId = req.requestId
  const controller = new AbortController()
  running.set(requestId, { controller, sessionId: session.id })

  // Se ejecuta en segundo plano; la interfaz recibe los eventos por 'copilot:event'.
  void (async () => {
    try {
      const turn = await executeTurn({
        session,
        action: req.action,
        input: req.input,
        image,
        provider,
        model,
        signal: controller.signal,
        profilePrompt: promptBlock,
        onStart: (t) => send({ requestId, type: 'started', turn: t }),
        onDelta: (text) => send({ requestId, type: 'delta', text })
      })
      if (session.turns.length === 0) session.title = req.input.trim() ? deriveTitle(req.input) : 'Consulta sobre una captura'
      session.turns.push(turn)
      session.updatedAt = new Date().toISOString()
      await sessionStore.save(session)
      // XARA puede guardar en su memoria un dato duradero sobre el usuario que descubrió en la respuesta.
      if (turn.remembered?.length) await profileStore.remember(turn.remembered, 'xara').catch(() => {})
      send({ requestId, type: 'finished', turn })
    } catch (err) {
      console.error('Error guardando el turno', err)
      send({ requestId, type: 'failed', message: 'No se pudo guardar la respuesta en el historial. Revisa el espacio en disco y vuelve a intentarlo.' })
    } finally {
      running.delete(requestId)
    }
  })()
  return requestId
}

/** Solo la ventana principal puede llamar a la API; cualquier otro contenido cargado queda fuera. */
function handle<T>(channel: string, fn: (...args: any[]) => Promise<T> | T): void {
  ipcMain.handle(channel, (e: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (e.sender !== win?.webContents) throw new Error('Origen no autorizado.')
    return fn(...args)
  })
}

function registerIpc(): void {
  handle('settings:get', () => settingsView())
  handle('settings:update', async (patch: unknown) => {
    const s = await settingsStore.update(sanitizeSettingsPatch(patch))
    win?.setAlwaysOnTop(s.alwaysOnTop)
    return settingsView()
  })
  handle('secret:set', async (id: unknown, value: unknown) => {
    if (typeof value !== 'string') throw new Error('Valor no válido.')
    await secretStore.set(assertProvider(id), value)
    return settingsView()
  })
  handle('secret:clear', async (id: unknown) => {
    await secretStore.clear(assertProvider(id))
    return settingsView()
  })
  handle('providers:info', () => PROVIDERS)
  handle('models:list', async (id: unknown) => {
    const settings = await settingsStore.get()
    const provider = await providerFor(assertProvider(id), settings)
    try {
      return { ok: true, models: await provider.listModels(AbortSignal.timeout(15_000)) }
    } catch (err) {
      return { ok: false, error: (err as { toInfo?: () => unknown }).toInfo?.() ?? { kind: 'unknown', message: String(err) } }
    }
  })
  handle('sessions:list', () => sessionStore.list())
  handle('sessions:get', (id: string) => sessionStore.get(id))
  handle('sessions:create', () => sessionStore.create())
  handle('sessions:rename', (id: string, title: string) => sessionStore.rename(id, String(title)))
  handle('sessions:delete', (id: string) => sessionStore.delete(id))
  handle('turn:feedback', (sessionId: string, turnId: string, fb: unknown) => sessionStore.setFeedback(sessionId, String(turnId), sanitizeFeedback(fb)))
  handle('profile:get', () => profileView())
  handle('profile:update', async (patch: unknown) => {
    const p = (patch ?? {}) as Record<string, unknown>
    await profileStore.update({
      ...(typeof p.enabled === 'boolean' ? { enabled: p.enabled } : {}),
      ...(typeof p.preferences === 'string' ? { preferences: p.preferences } : {})
    })
    return profileView()
  })
  handle('profile:remember', async (text: unknown) => {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Escribe algo para recordar.')
    await profileStore.remember([text], 'usuario')
    return profileView()
  })
  handle('profile:forget', async (id: unknown) => {
    await profileStore.forget(String(id))
    return profileView()
  })
  handle('voice:geminiVoices', () => GEMINI_VOICES)
  handle('voice:speak', async (text: unknown) => {
    const settings = await settingsStore.get()
    const clean = speakableText(String(text ?? ''))
    if (!clean) return { ok: false as const, reason: 'vacío' }
    try {
      if (settings.voice.engine === 'fish') {
        const key = await getFishKey()
        if (!key) return { ok: false as const, reason: 'sin_clave' }
        const model = settings.voice.fishModel || DEFAULT_FISH_VOICE
        const audio = await fishSpeech(key, model, clean, fetch, AbortSignal.timeout(45_000))
        return { ok: true as const, audio, mime: 'audio/mpeg' }
      }
      const key = await getApiKey('gemini')
      if (!key) return { ok: false as const, reason: 'sin_clave' }
      const audio = await geminiSpeech(key, settings.voice.geminiVoice, clean, fetch, AbortSignal.timeout(30_000))
      bumpUsage('gemini')
      return { ok: true as const, audio, mime: 'audio/wav' }
    } catch (err) {
      const info = (err as { toInfo?: () => { kind?: string; message?: string } }).toInfo?.()
      return { ok: false as const, reason: info?.kind ?? 'error', message: info?.message ?? String(err) }
    }
  })
  handle('voice:fishStatus', async () => {
    const stored = await secretStore.has('fish' as ProviderId)
    return { configured: stored || !!defaultKeys.fishAudio, source: stored ? 'stored' : defaultKeys.fishAudio ? 'default' : null }
  })
  handle('voice:setFishKey', async (value: unknown) => {
    if (typeof value !== 'string') throw new Error('Clave no válida.')
    await secretStore.set('fish' as ProviderId, value)
    return settingsView()
  })
  handle('voice:transcribe', async (wavBase64: unknown) => {
    if (typeof wavBase64 !== 'string' || wavBase64.length > MAX_IMAGE_BASE64) throw new Error('Audio no válido.')
    const settings = await settingsStore.get()
    const key = await getApiKey('gemini')
    if (!key) return { ok: false as const, reason: 'sin_clave' }
    try {
      const text = await geminiTranscribe(key, settings.models.gemini, wavBase64, fetch, AbortSignal.timeout(30_000))
      bumpUsage('gemini')
      return { ok: true as const, text }
    } catch (err) {
      return { ok: false as const, reason: (err as { toInfo?: () => { kind?: string } }).toInfo?.()?.kind ?? 'error' }
    }
  })
  handle('usage:get', () => usageStore.get())
  handle('observer:status', () => observer.status())
  handle('observer:set', (active: unknown) => setObserver(active === true))
  handle('observer:runOnce', () => observer.runOnce(true))
  handle('capture:region', () => captureRegion())
  handle('quick:clipboard', () => readClipboard())
  handle('copilot:run', (req: RunRequest) => run(req))
  handle('copilot:cancel', (requestId: string) => {
    running.get(requestId)?.controller.abort()
  })
  registerAcademy(handle, {
    store: academyStore,
    complete,
    hintSystem: async (step) => buildSystemPrompt('hint', (await profileView()).promptBlock, step)
  })
  registerCodeFix(handle, {
    getWindow: () => win,
    isEnabled: async () => (await settingsStore.get()).codeFix,
    complete,
    backupDir: path.join(dataDir(), 'backups')
  })
}

function dataDir(): string {
  return process.env.XARA_DATA_DIR || app.getPath('userData')
}

async function createWindow(): Promise<void> {
  const settings = await settingsStore.get()
  win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 420,
    minHeight: 420,
    title: APP_NAME,
    backgroundColor: '#15171c',
    alwaysOnTop: settings.alwaysOnTop,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  win.once('ready-to-show', () => win?.show())
  // El título nativo indica si el observador está activo; el <title> de la página no debe pisarlo.
  win.on('page-title-updated', (e) => e.preventDefault())

  // La interfaz no navega fuera de la app; los enlaces https se abren en el navegador.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win?.webContents.getURL()) e.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

// Una segunda instancia no podría registrar los atajos globales y escribiría los mismos JSON a la vez.
if (!app.requestSingleInstanceLock()) app.exit(0)
app.on('second-instance', showWindow)
// Antes de que Chromium lea su carpeta de datos: así también se conserva la clave con la que se cifraron los secretos.
if (!process.env.XARA_DATA_DIR) migrateUserData()

app.whenReady().then(async () => {
  loadDefaultKeys()
  const dir = dataDir()
  settingsStore = new SettingsStore(dir)
  sessionStore = new SessionStore(dir)
  secretStore = new SecretStore(dir, safeStorage)
  profileStore = new ProfileStore(dir)
  academyStore = new AcademyStore(dir)
  usageStore = new UsageStore(dir)
  observer = new ScreenObserver({
    getSettings: async () => (await settingsStore.get()).observer,
    capture: captureScreen,
    signature: screenSignature,
    toAttachment,
    analyze: analyzeScreen,
    onObservation: (o) => {
      toRenderer('observer:observation', o)
      if (!Notification.isSupported()) return
      const n = new Notification({ title: `XARA · ${o.title}`, body: o.tip })
      n.on('click', showWindow)
      n.show()
    },
    onStatus: (st) => toRenderer('observer:status', st)
  })
  registerIpc()
  registerShortcuts()
  powerMonitor.on('lock-screen', () => void setObserver(false))
  powerMonitor.on('suspend', () => void setObserver(false))
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  for (const r of running.values()) r.controller.abort()
  if (process.platform !== 'darwin') app.quit()
})
