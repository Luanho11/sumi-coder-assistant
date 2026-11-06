import { useEffect, useState } from 'react'
import type { ProviderInfo } from '../../../core/providers'
import type { ProviderId, SettingsView, VoiceSettings } from '../../../core/types'
import { DEFAULT_FISH_VOICE, FISH_VOICES } from '../../../core/voice'
import { systemVoices, useVoice } from '../useVoice'
import { cleanIpcError } from '../util'
import './Dialog.css'

interface Props {
  settings: SettingsView
  providers: Record<ProviderId, ProviderInfo>
  onChange: (s: SettingsView) => void
  onClose: () => void
}

const OTRA = 'otra'

type TestState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string }

export function SettingsDialog({ settings, providers, onChange, onClose }: Props) {
  const [pid, setPid] = useState<ProviderId>(settings.providerId)
  const [keyDraft, setKeyDraft] = useState('')
  const [model, setModel] = useState(settings.models[pid])
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl)
  const [models, setModels] = useState<string[]>([])
  const [test, setTest] = useState<TestState>({ kind: 'idle' })
  const [gVoices, setGVoices] = useState<string[]>([])
  const [sVoices, setSVoices] = useState<{ name: string; lang: string }[]>([])
  const [fish, setFish] = useState<{ configured: boolean; source: 'stored' | 'default' | null }>({ configured: false, source: null })
  const [fishDraft, setFishDraft] = useState('')
  const info = providers[pid]
  const secret = settings.secrets[pid]

  useEffect(() => {
    setModel(settings.models[pid])
    setModels([])
    setTest({ kind: 'idle' })
    setKeyDraft('')
  }, [pid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void window.copilot.geminiVoices().then(setGVoices)
    void window.copilot.fishStatus().then(setFish)
    const load = () => setSVoices(systemVoices())
    load()
    window.speechSynthesis?.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load)
  }, [])

  const saveFishKey = () =>
    wrap(async () => {
      onChange(await window.copilot.setFishKey(fishDraft))
      setFishDraft('')
      setFish({ configured: true, source: 'stored' })
      setTest({ kind: 'ok', text: 'Clave de Fish Audio guardada cifrada en este equipo.' })
    })

  const setVoice = (patch: Partial<VoiceSettings>) => void window.copilot.updateSettings({ voice: { ...settings.voice, ...patch } }).then(onChange)
  const voice = settings.voice
  const sample = useVoice(voice, () => {})
  const fishId = voice.fishModel || DEFAULT_FISH_VOICE
  const [fishCustom, setFishCustom] = useState(!FISH_VOICES.some((v) => v.id === fishId))
  const chooseFish = (id: string) => {
    setFishCustom(id === OTRA)
    if (id !== OTRA) setVoice({ fishModel: id })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const wrap = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (err) {
      setTest({ kind: 'error', text: cleanIpcError(err) })
    }
  }

  const saveKey = () =>
    wrap(async () => {
      onChange(await window.copilot.setSecret(pid, keyDraft))
      setKeyDraft('')
      setTest({ kind: 'ok', text: 'Clave guardada cifrada en este equipo.' })
    })

  const clearKey = () =>
    wrap(async () => {
      onChange(await window.copilot.clearSecret(pid))
      setTest({ kind: 'ok', text: 'Clave eliminada.' })
    })

  const checkConnection = () =>
    wrap(async () => {
      setTest({ kind: 'loading' })
      if (pid === 'ollama') onChange(await window.copilot.updateSettings({ ollamaUrl }))
      const res = await window.copilot.listModels(pid)
      if (res.ok) {
        setModels(res.models)
        setTest({
          kind: 'ok',
          text: res.models.length ? `Conexión correcta: ${res.models.length} ${res.models.length === 1 ? 'modelo disponible' : 'modelos disponibles'}.` : 'Conexión correcta, pero no hay modelos disponibles.'
        })
      } else setTest({ kind: 'error', text: res.error.message })
    })

  const apply = () =>
    wrap(async () => {
      onChange(await window.copilot.updateSettings({ providerId: pid, models: { ...settings.models, [pid]: model }, ollamaUrl }))
      onClose()
    })

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Configuración">
        <h2>Configuración del proveedor</h2>

        <div className="field">
          <label>Proveedor</label>
          <div className="segmented">
            {(Object.keys(providers) as ProviderId[]).map((id) => (
              <button key={id} className={pid === id ? 'on' : ''} onClick={() => setPid(id)}>
                {providers[id].name}
              </button>
            ))}
          </div>
          <p className="privacy">🔒 {info.privacy}</p>
        </div>

        {info.requiresKey && (
          <div className="field">
            <label>Clave API</label>
            <div className="row">
              <input
                type="password"
                autoComplete="off"
                placeholder={secret.configured ? '•••••••• (configurada)' : 'Pega tu clave API'}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
              />
              <button onClick={saveKey} disabled={!keyDraft.trim() || !settings.encryptionAvailable}>
                Guardar
              </button>
              {secret.source === 'stored' && <button onClick={clearKey}>Borrar</button>}
            </div>
            <p className="hint">
              {secret.source === 'stored'
                ? 'La clave está guardada cifrada con tu usuario de Windows y nunca se muestra en la interfaz.'
                : secret.configured
                  ? `${info.name} ya trae una clave gratuita precargada: funciona sin que hagas nada. Puedes poner la tuya aquí si quieres.`
                  : pid === 'gemini'
                    ? 'Crea una clave gratuita en Google AI Studio: https://aistudio.google.com/apikey'
                    : pid === 'groq'
                      ? 'Crea una clave gratuita en console.groq.com/keys'
                      : 'Pega tu clave.'}
              {!settings.encryptionAvailable && ' (El cifrado del sistema no está disponible en este equipo.)'}
            </p>
          </div>
        )}

        {pid === 'ollama' && (
          <div className="field">
            <label>URL de Ollama</label>
            <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label>Modelo</label>
          <div className="row">
            <input list="model-list" value={model} onChange={(e) => setModel(e.target.value)} placeholder="nombre del modelo" />
            <datalist id="model-list">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <button onClick={checkConnection} disabled={test.kind === 'loading'}>
              {test.kind === 'loading' ? 'Comprobando…' : 'Probar conexión'}
            </button>
          </div>
          {models.length > 0 && (
            <select value={models.includes(model) ? model : ''} onChange={(e) => setModel(e.target.value)}>
              <option value="" disabled>
                Elige un modelo de la lista…
              </option>
              {models.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          )}
        </div>

        {test.kind === 'ok' && <p className="ok-text">{test.text}</p>}
        {test.kind === 'error' && <p className="error-text">{test.text}</p>}

        <hr className="modal-sep" />
        <h2>Voz de XARA</h2>
        <div className="field">
          <label>Cómo suena</label>
          <div className="segmented">
            <button className={voice.engine === 'fish' ? 'on' : ''} onClick={() => setVoice({ engine: 'fish' })}>
              Verity (Fish Audio)
            </button>
            <button className={voice.engine === 'gemini' ? 'on' : ''} onClick={() => setVoice({ engine: 'gemini' })}>
              Gemini
            </button>
            <button className={voice.engine === 'sistema' ? 'on' : ''} onClick={() => setVoice({ engine: 'sistema' })}>
              Windows
            </button>
          </div>
          <p className="hint">
            Verity es la voz recomendada (natural y cercana). Si una voz online falla, XARA sigue con la voz de Windows y te dice por qué.
          </p>
          <div className="row">
            <button onClick={() => (sample.speaking ? sample.stop() : void sample.speak('Hola, soy XARA. Así sueno cuando te doy la clase.'))}>
              {sample.speaking ? '⏹ Detener' : '▶ Escuchar la voz'}
            </button>
          </div>
          {sample.error && <p className="error-text">{sample.error}</p>}
        </div>

        {voice.engine === 'fish' && (
          <>
            <div className="field">
              <label>Clave de Fish Audio</label>
              <div className="row">
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={fish.configured ? '•••••••• (configurada)' : 'Pega tu clave de Fish Audio'}
                  value={fishDraft}
                  onChange={(e) => setFishDraft(e.target.value)}
                />
                <button onClick={saveFishKey} disabled={!fishDraft.trim() || !settings.encryptionAvailable}>
                  Guardar
                </button>
              </div>
              <p className="hint">
                {fish.source === 'stored'
                  ? 'Tu clave está guardada cifrada en este equipo.'
                  : fish.configured
                    ? 'Viene una clave gratuita precargada: la voz Verity funciona sin que hagas nada.'
                    : 'Pega tu clave de Fish Audio para usar la voz Verity.'}
              </p>
            </div>
            <div className="field">
              <label>Versión de la voz</label>
              <select value={fishCustom ? OTRA : fishId} onChange={(e) => chooseFish(e.target.value)}>
                {FISH_VOICES.map((v, i) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{i === 0 ? ' (recomendada)' : ''}
                  </option>
                ))}
                <option value={OTRA}>Otra voz de Fish Audio (pega su id)</option>
              </select>
              {fishCustom && (
                <input value={voice.fishModel} onChange={(e) => setVoice({ fishModel: e.target.value.trim() })} placeholder="El código largo del enlace de la voz en fish.audio" />
              )}
            </div>
          </>
        )}

        {voice.engine === 'gemini' && gVoices.length > 0 && (
          <div className="field">
            <label>Timbre de voz</label>
            <select value={voice.geminiVoice} onChange={(e) => setVoice({ geminiVoice: e.target.value })}>
              {gVoices.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
        )}

        {voice.engine === 'sistema' && (
          <div className="field">
            <label>Voz de Windows</label>
            <select value={voice.systemVoice} onChange={(e) => setVoice({ systemVoice: e.target.value })}>
              <option value="">La primera en español</option>
              {sVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label>Volumen: {Math.round(voice.volume * 100)}%</label>
          <input type="range" min={0} max={1} step={0.05} value={voice.volume} onChange={(e) => setVoice({ volume: Number(e.target.value) })} />
        </div>

        <div className="field">
          <label className="row-check">
            <input type="checkbox" checked={voice.autoRead} onChange={(e) => setVoice({ autoRead: e.target.checked })} />
            Leer en voz alta cada respuesta al terminar
          </label>
        </div>

        <p className="hint">
          🎤 ¿Sin micrófono en el PC? Puedes escribirle a XARA siempre; también puedes dictar desde tu teléfono con su teclado por voz y traer el texto con el portapapeles (Ctrl+Alt+C).
        </p>

        <div className="modal-actions">
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={apply}>
            Usar este proveedor
          </button>
        </div>
      </div>
    </div>
  )
}
