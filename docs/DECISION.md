# Decisión técnica (Etapa 1) — 22/10/2026

## 1. Acceso a modelos: suscripción ≠ API

| Opción | ¿Oficial? | Coste para ti | Qué implica | Estado en la app |
|---|---|---|---|---|
| **Gemini API, nivel gratuito** (clave de Google AI Studio) | Sí | 0 € | Límites de uso bajos; en el nivel gratuito Google **usa el contenido para mejorar sus productos**. Modelos Flash/Flash-Lite disponibles gratis; los Pro no. | **Implementado** (proveedor por defecto) |
| Gemini API de pago (Cloud Billing) | Sí | Por consumo. Ej.: un modelo Flash a 0,75 $/M tokens de entrada y 3,75 $/M de salida hasta el 31/12/2026 (se duplica desde el 01/01/2027) | Sin uso de datos para mejorar productos; límites más altos | Mismo conector, solo cambia la clave. **Requiere tu autorización** |
| Suscripción de pago de Gemini (Google AI Pro/Ultra) | — | Ya pagada | Las cuotas de la suscripción aplican en la web de AI Studio/app Gemini. La API se factura aparte; los suscriptores pueden optar a créditos mensuales de Google Cloud **si activan Cloud Billing**. | No se usa directamente. Opción a explorar: créditos de Cloud |
| **Ollama local** | Sí (software libre) | 0 € | Todo en tu equipo; calidad y velocidad según tu hardware | **Implementado** |
| Claude API (Claude Console) | Sí | Por consumo (pago aparte de Claude Pro) | Clave API propia, facturación por tokens | No implementado. **Requiere tu autorización** |
| Claude Pro dentro de una app propia | Restringido | — | La documentación de Claude Code indica que quien construye productos con el Agent SDK debe usar **clave API**, y que no se permite enrutar peticiones con credenciales de Free/Pro/Max ni ofrecer el login de Claude.ai en apps de terceros. | **Descartado** para no incumplir condiciones |
| Claude Pro en herramientas oficiales (Claude Code, app de Claude) | Sí | Incluido | Uso legítimo de tu suscripción: puedes seguir usando Claude Code para desarrollar este proyecto | Fuera de la app |

**Recomendación:** empezar con Gemini (nivel gratuito) para validar el flujo real sin coste, y Ollama si
quieres privacidad total. Si más adelante necesitas más calidad o límites, las opciones con coste
(Gemini de pago o Claude API) se activan añadiendo una clave; ninguna se ha contratado.

Fuentes:
[Precios Gemini API](https://ai.google.dev/pricing) ·
[Planes de Google AI y API](https://ai.google.dev/gemini-api/docs/google-ai-plans) ·
[Modelos Gemini](https://ai.google.dev/gemini-api/docs/models) ·
[API generateContent](https://ai.google.dev/api/generate-content) ·
[Claude: suscripción y API se facturan aparte](https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-is-claude-api-usage-billed-separately-from-my-paid-claude-plan) ·
[Claude Code: autenticación y uso de credenciales](https://code.claude.com/docs/en/legal-and-compliance)

> Nota: en 2026 hubo cambios sobre el uso programático de las suscripciones de Claude (créditos para Agent SDK).
> La documentación oficial vigente sigue indicando clave API para productos propios, por eso se descarta
> esa vía. Si quieres explorarla, conviene confirmarlo con Anthropic antes.

## 2. Electron frente a Tauri

| Criterio | Electron | Tauri |
|---|---|---|
| Stack | Node.js + Chromium: el que ya conoces | Rust + WebView2; requiere Rust y MSVC Build Tools en Windows |
| Audio | Chromium integrado: `getUserMedia`, `MediaRecorder`, y en Windows captura del audio del sistema (loopback) vía `desktopCapturer` | Micrófono vía WebView2; el loopback requiere un plugin nativo en Rust |
| Claves | `safeStorage` (DPAPI en Windows) incluido | Plugin `stronghold`/keyring |
| Tamaño | ~150 MB comprimido | ~10 MB |
| Mantenimiento | Un solo lenguaje (TypeScript) | TypeScript + Rust |

**Elegido: Electron.** El tamaño importa poco en una herramienta personal; pesan más el lenguaje único,
la vía directa para audio del sistema en Windows (objetivo de la Etapa 4) y el cifrado de claves integrado.

## 3. Audio (avance de la Etapa 4, pendiente de validar)

Opciones a medir en Windows, de menor a mayor esfuerzo:

1. **Dictado de Windows (`Win+H`)** sobre el campo de texto: funciona hoy sin desarrollo. Procesado según la configuración de privacidad de Windows.
2. **Micrófono → transcripción local** con whisper.cpp (modelo `base`/`small`): sin coste, nada sale del equipo; latencia según CPU/GPU.
3. **Micrófono → transcripción remota** con un modelo de transcripción de Gemini (la página de precios lista modelos *Transcribe* en el nivel gratuito): sin instalación, el audio sale del equipo.
4. **Audio de una llamada** (loopback del sistema en Windows vía Electron): solo con consentimiento de los participantes y donde esté permitido.

En todos los casos: transcripción visible y editable antes de enviar, indicador claro de captura, sin guardar grabaciones por defecto.

## 4. Siguientes etapas

1. **Validar el MVP en tu Windows** (lista de comprobación en el README) con una clave de Gemini.
2. **Etapa 3, contexto de código:** seleccionar carpeta/archivos, respetar `.gitignore`, excluir secretos, mostrar qué se envía y citar rutas.
3. **Etapa 4, audio:** empezar por micrófono + transcripción editable y medir la latencia real.
4. **Etapa 5, entrenamiento:** entrevistas simuladas y seguimiento de temas débiles.
