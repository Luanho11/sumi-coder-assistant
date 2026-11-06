# XARA Coder Assistant

Tutora y asistente de programación con IA para Windows (antes “Copiloto Técnico”). Su objetivo: que llegues a ser
un gran profesional en 2026, cuando buena parte del código lo escriben agentes y lo que se paga es **especificar,
revisar, verificar, decidir y comunicar**.

## Novedades de la v0.4

- **Responde según lo que preguntas.** Un concepto (“¿qué es la POO? déjame un ejercicio”) recibe una clase corta:
  idea clave, analogía, **diagrama** (Mermaid, se dibuja dentro de la app), ejemplo, errores típicos, ejercicio y pregunta.
  Una duda rápida, una respuesta directa. La plantilla completa (resumen, requisitos, estrategia, plan, código, verificación)
  queda para problemas de programación reales.
- **Academia** (`Ctrl+2`): 12 rutas, 300+ ejercicios.
  - **Ingeniería de software con IA (2026)**, ruta propia de XARA: 7 módulos y 16 ejercicios de nivel profesional (especificar para agentes,
    instrucciones de repositorio, revisar código generado, pruebas como red de seguridad, evals, seguridad OWASP LLM, coste, MCP,
    control humano, portafolio, diseño de sistemas y negociación salarial).
  - Las 11 rutas de tu proyecto base (Análisis, HTML/CSS, React, Angular, Java, Python, C#, QA, SQL, Análisis funcional, Soporte TI),
    importadas con `scripts/import-formacion.mjs`: 76 módulos, 123 clases y 300 ejercicios.
- **Ejercicios guiados en 5 pasos**: entender → planificar → construir → verificar → defender (pregunta de entrevista).
  Cada ejercicio indica si se permite IA (sin IA / IA como tutora / IA como compañera que debes revisar). Borrador con guardado automático.
- **Pistas progresivas** (5 peldaños): solo se dan después de escribir un intento, cuentan en la evaluación, y al acabarse
  XARA da una pista sobre tu intento concreto.
- **“Dónde está la respuesta”**: documentación oficial y vídeos. XARA comprueba desde tu equipo que los vídeos de YouTube y los
  enlaces siguen disponibles (gratis, sin clave) y ofrece una búsqueda alternativa si alguno ya no existe.
- **Evaluación con rúbrica por IA**: nota 0-100, nivel (bien hecho, parcial, incorrecto, falta evidencia, no defendible),
  criterio a criterio con evidencia, tipo de error, fortalezas y siguiente paso. Antes declaras tu seguridad: XARA mide tu calibración.
  Sin conexión, una estimación orientativa que nunca aprueba.
- **Examen de nivel**: 3 preguntas adaptativas por área (54 preguntas propias en 9 áreas, más las de tus clases) y 3 tareas
  prácticas corregidas por IA. Te da un punto de partida (como mucho semi-senior) y te recomienda rutas y módulo inicial.
- **Mi nivel** (`Ctrl+3`): nivel global y por áreas calculado con evidencias (ejercicios bien hechos), repasos pendientes
  (lo suspendido vuelve al día siguiente), calibración y qué te falta para el siguiente nivel. Senior exige ejercicios avanzados reales.
- **Carrera** (`Ctrl+4`): cómo se trabaja en 2026, perfiles con más proyección, cómo calcular tu sueldo objetivo con fuentes y
  próximos pasos según tu nivel. Es análisis de XARA (inferencias), no datos verificados; no da cifras inventadas.
  “Plan personalizado con XARA” genera un plan de 90 días con tu nivel.
- **Clase interactiva**: desde cualquier clase, XARA la explica mejor (analogía, diagrama, ejemplo resuelto, ejercicio con huecos y preguntas de repaso).
- **Corrección de archivos con permiso** (🔧): desactivada por defecto. Para activarla ves un aviso y lo confirmas. Eliges un archivo,
  dices qué corregir, ves el **diff línea a línea**, aplicas (con **copia de seguridad**) y puedes **deshacer**. Se bloquean archivos de
  secretos (.env, claves, certificados), los de .gitignore y los que contienen claves o contraseñas. Si el archivo cambió mientras tanto, no se pisa.
- **Tus datos se conservan**: la primera vez que abres XARA se copian la configuración, la clave cifrada, el historial y la memoria
  de “Copiloto Técnico”.

## Tutor que ve tu pantalla (v0.3)

- **Siempre en modo tutor:** escalera de pistas en 5 peldaños (pregunta → analogía → principio → siguiente paso → ejemplo paralelo),
  una *Pregunta para ti* al final de cada análisis y clasificación del error (conceptual, procedimental, estratégico o despiste).
- **Recortar pantalla** (`Ctrl+Alt+S` desde cualquier app, o 📷 *Recortar*): oculta la app, recortas una zona y se adjunta a la consulta.
  También puedes pegar una imagen con `Ctrl+V`. La imagen se envía con esa consulta y **no se guarda** en el historial.
- **Usar lo copiado** (`Ctrl+Alt+C`): copia texto o una imagen en cualquier app (`Ctrl+C`) y pulsa el atajo. Electron no puede leer
  la selección de otras aplicaciones, por eso se usa el portapapeles.
- **Modo observador** (👁 o `Ctrl+Alt+O`), **desactivado por defecto**: cada 60 s (mínimo 30) captura la pantalla principal, compara
  con la anterior y, solo si cambió, pide al modelo un consejo de tutor. Si hay algo útil muestra una notificación de Windows y un aviso
  en la app con *Profundizar*. Tiene límite diario (120 por defecto), espera automática ante límites del proveedor y se pausa al bloquear
  el equipo. Mientras está activo, el título de la ventana y la barra superior lo indican. Las capturas no se guardan.
  Úsalo solo donde la ayuda con IA esté permitida: no se oculta de capturas ni de sistemas de supervisión.
- `Ctrl+Alt+J` muestra u oculta la app. Si otra aplicación ya usa un atajo global, Windows no deja registrarlo.

## Aprende con el uso

El modelo **no se reentrena** (ningún proveedor lo permite con una suscripción o clave normal). La app mejora así:

- **Criterio senior en el prompt:** trade-offs, complejidad, patrones, casos límite, seguridad, rendimiento,
  errores típicos de perfil junior y cómo comunicarlo en una entrevista.
- **Memoria local:** cada respuesta se etiqueta con sus temas; tú la valoras con 👍/👎 (y un motivo, p. ej.
  “Demasiado largo”). Con eso y las acciones que pides (pistas, explicaciones, depuración) se detectan los temas
  que dominas y los que debes reforzar.
- **Perfil en cada consulta:** un resumen breve (preferencias, temas a reforzar, motivos de rechazo, nivel habitual)
  se añade al prompt. En **🧠 Memoria** (`Ctrl+M`) ves el texto exacto, escribes tus preferencias o desactivas la memoria.
  Ese resumen viaja al proveedor junto con la pregunta; el historial completo se queda en tu equipo.

> Estado: v0.4. Contexto de código de un proyecto completo y audio son las siguientes etapas (ver `docs/DECISION.md`).

## Requisitos

- Windows 11 (también funciona en Linux/macOS para desarrollo).
- Node.js 22 LTS o superior y npm.
- Un proveedor de modelos:
  - **Gemini (recomendado para empezar, sin coste):** una clave API gratuita de Google AI Studio
    (<https://aistudio.google.com/apikey>). En el nivel gratuito Google puede usar el contenido para mejorar
    sus productos: no pegues código confidencial de terceros.
  - **Ollama (100 % local, sin coste):** instala Ollama (<https://ollama.com>) y descarga un modelo, p. ej.
    `ollama pull qwen2.5-coder:7b`. Necesita un equipo con RAM/GPU suficiente; la calidad depende del modelo.

## Instalación y ejecución (desde el código)

```powershell
cd copiloto
npm install
npm run dev        # abre la app en modo desarrollo con recarga en caliente
```

Otras órdenes:

| Orden | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias (Vitest) de la lógica de XARA, proveedores, errores, academia y persistencia |
| `npm run typecheck` | Comprobación de tipos TypeScript |
| `npm run build` | Compila main, preload y renderer en `out/` |
| `npm start` | Ejecuta la versión compilada |
| `npm run dist:win` | Genera el instalador NSIS y un `.zip` portable en `release/` |
| `npm run build && node scripts/e2e-smoke.mjs` | Prueba de extremo a extremo con un servidor Ollama **simulado** |

## Primer uso

1. Al abrir la app sin clave configurada aparece **Configuración** (también con `Ctrl+,`).
2. Elige **Gemini**, pega la clave y pulsa **Guardar**. Se guarda cifrada con tu usuario de Windows
   (Electron `safeStorage`/DPAPI) y nunca se envía a la interfaz. Alternativa: variable de entorno `GEMINI_API_KEY`.
3. Pulsa **Probar conexión**: lista los modelos disponibles para tu clave. Elige uno (p. ej. un modelo *Flash*).
4. **Usar este proveedor**, pega un enunciado y pulsa `Ctrl+Enter`.

## Atajos

| Atajo | Acción |
|---|---|
| `Ctrl+Enter` | Analizar (primera consulta) o preguntar (seguimiento) |
| `Alt+1…5` | Pista · Depurar · Revisar código · Pruebas · Explicar (usa el texto del campo como contexto) |
| `Esc` | Cancelar la respuesta en curso |
| `Ctrl+N` / `Ctrl+K` / `Ctrl+B` | Nueva sesión / ir al campo de texto / mostrar u ocultar historial |
| `Ctrl+1…4` | Tutor · Academia · Mi nivel · Carrera |
| `Ctrl+Shift+T` | Mantener la ventana encima de las demás |
| `Ctrl+Alt+S` / `Ctrl+Alt+C` | (Globales) Recortar pantalla / usar lo copiado |
| `Ctrl+Alt+O` / `Ctrl+Alt+J` | (Globales) Activar o pausar el observador / mostrar u ocultar la app |
| `Ctrl+M` | Memoria: lo que ha aprendido, preferencias, activar/desactivar |
| `Ctrl+,` | Configuración |

## Arquitectura

```
src/
  core/        Lógica pura, sin Electron (probada con Vitest)
    prompts.ts     Prompts por acción y nivel de ayuda; historial con presupuesto de contexto
    sections.ts    Divide la respuesta Markdown en secciones (también durante el streaming)
    copilot.ts     Ejecuta un turno: streaming, cancelación, errores normalizados
    profile.ts     Perfil de aprendizaje: temas dominados/débiles, preferencias, bloque para el prompt
    topics.ts      Extrae los temas que el modelo añade como comentario oculto
    observer.ts    Modo observador: cuándo capturar, detección de cambios, límites y lectura del consejo
    codefix.ts     Corrección de archivos: bloqueo de secretos y .gitignore, prompt y diff por líneas
    academy/       Academia: catálogo (ruta de XARA + rutas importadas en data/base.json), pasos guiados,
                   examen de nivel adaptativo, evaluación por rúbrica, cálculo de nivel y orientación de carrera
    errors.ts      Clasificación de errores: auth, límite (429 + Retry-After), red, servidor, bloqueo…
    stream.ts      Lectores SSE y NDJSON
    providers/     Capa de proveedores: interfaz ModelProvider + Gemini (REST oficial) + Ollama
  main/        Proceso principal de Electron: IPC validado, persistencia JSON, claves cifradas,
               captura de pantalla y recorte (screen.ts), observador (observer.ts), atajos globales
  preload/     Puente mínimo y tipado (contextBridge); la interfaz no tiene acceso a Node
  renderer/    Interfaz React
tests/         Pruebas unitarias
scripts/       Servidor Ollama simulado y prueba E2E con Playwright
```

- **Las llamadas a la IA se hacen en el proceso principal**: la clave nunca llega al renderer.
- **Persistencia:** `%APPDATA%\XARA Coder Assistant\` → `settings.json`, `secrets.json` (cifrado), `profile.json`, `sessions\<id>.json`,
  `academy.json` (intentos, borradores, examen y clases vistas) y `backups\` (copias antes de corregir archivos).
  Escritura atómica; un archivo dañado no bloquea el resto. `XARA_DATA_DIR` permite otra carpeta.
- **Actualizar las rutas del proyecto base:** `node --experimental-strip-types scripts/import-formacion.mjs <carpeta-del-proyecto>`.
- **Añadir un proveedor:** implementa `ModelProvider` (`stream` + `listModels`) en `src/core/providers/` y regístralo en `index.ts`.
- **Seguridad de la ventana:** `contextIsolation`, `sandbox`, sin `nodeIntegration`, CSP estricta, navegación bloqueada.

## Qué está verificado y qué no

Verificado en Linux (entorno de desarrollo en la nube):

- `npm test`: 81 pruebas en verde (proveedores con `fetch` falso e imágenes, errores, streaming, prompts y modo tutor, perfil de aprendizaje, observador, persistencia, cifrado).
- `npm run typecheck` y `npm run build` sin errores.
- Prueba E2E en Electron real (Xvfb) contra un **servidor Ollama simulado**: streaming, secciones, pista,
  valoración 👎 con motivo, perfil de memoria y su envío en la siguiente consulta, persistencia tras reiniciar, error 429 con reintento, error de red, `Ctrl+N`, primer arranque, aislamiento de la interfaz, recorte de pantalla real (Xvfb) enviado al modelo, texto copiado, observador con aviso, indicador y pausa,
  pregunta conceptual con formato de clase y diagrama dibujado, examen de nivel completo con parte práctica, ejercicio guiado con pista bloqueada hasta escribir un intento y evaluación por rúbrica, Mi nivel, Carrera, clase interactiva, y corrección de archivo con aviso, bloqueo de .env, diff, copia de seguridad y deshacer (41/41).
- `electron-builder --win zip` genera el ejecutable de Windows x64.
- El paquete activa los *fuses* de Electron (sin `RunAsNode`, sin `NODE_OPTIONS` ni `--inspect`, integridad del ASAR y carga solo desde el ASAR). Comprobado en el paquete Linux con `npx @electron/fuses read`.

**No verificado todavía** (requiere tu equipo):

- Ejecución en Windows 11 (ventana, `safeStorage`/DPAPI, instalador NSIS, que el ejecutable arranque con los *fuses* activos y que una segunda instancia solo enfoque la ventana abierta).
- Una consulta contra **Gemini real**: el entorno de desarrollo no tiene clave. El conector sigue la API REST
  oficial (`streamGenerateContent?alt=sse`) y está probado contra respuestas simuladas con ese formato.
  Tampoco se ha comprobado con un modelo real que la evaluación devuelva el JSON pedido (si no lo hace, XARA lo avisa y usa la estimación sin IA).
- La comprobación de vídeos y enlaces: el entorno de desarrollo no tiene acceso a YouTube. Los vídeos del proyecto base no se han verificado.
- La migración de datos desde “Copiloto Técnico” en Windows (copia de la carpeta, incluida la clave cifrada).

### Lista de comprobación en Windows

1. `npm install && npm test && npm run dev`.
2. Configura la clave de Gemini → **Probar conexión** debe listar modelos.
3. Analiza un problema: la respuesta debe llegar progresivamente y por secciones.
4. Pulsa **Pista**, **Pruebas** y **Explicar**; haz una pregunta de seguimiento.
5. Valora varias respuestas con 👍/👎 y abre 🧠 Memoria (`Ctrl+M`): deben aparecer temas y motivos.
6. Cierra y vuelve a abrir: la sesión debe aparecer en el historial con sus turnos.
7. Pon una clave incorrecta: debe mostrarse “Credencial no válida”. Desconecta la red: “Sin conexión”.
8. Comprueba que `%APPDATA%\XARA Coder Assistant\secrets.json` no contiene la clave en claro y que tus sesiones de Copiloto Técnico aparecen.
9. Pregunta “¿Qué es la programación orientada a objetos?”: debe salir una clase con diagrama, no la plantilla de problema.
10. Haz el examen de nivel y un ejercicio de la Academia hasta la evaluación; revisa Mi nivel.
11. Activa la corrección de archivos con un archivo de prueba, aplica y deshaz.
12. Opcional: `npm run dist:win` y prueba el instalador (sin firma de código: SmartScreen mostrará un aviso).

## Limitaciones conocidas

- Ejecutable sin firmar y sin icono propio.
- El modelo puede equivocarse: la sección *Verificación* propone pruebas, pero la app no ejecuta código.
- Las notificaciones nativas y los atajos globales solo se han probado en Linux; en Windows falta comprobarlos.
- El observador captura solo la pantalla principal y su contador diario se reinicia al cerrar la app.
- Sin resaltado de sintaxis en los bloques de código (se priorizó el flujo funcional).
- La “validación siempre conectada” se limita a comprobar enlaces y vídeos: la búsqueda web dentro de las respuestas (Grounding con Google Search)
  no existe en el nivel gratuito de Gemini y se decidió no activarla (en el nivel de pago: 5.000 búsquedas/mes incluidas y luego 14 USD por 1.000, precio consultado el 24/10/2026).
- El nivel y la evaluación dependen del criterio del modelo: son una guía para aprender, no una certificación.
- La corrección de archivos trabaja con un archivo cada vez y la comprobación de .gitignore cubre patrones sencillos (no negaciones).
- La ventana “encima de todo” es una opción normal de productividad; no se intenta ocultarla de capturas de pantalla.

## 1.1.0 — Motor pedagógico v2

Sobre la 1.0.0 (voz Verity en español, respaldo con la voz de Windows, sandbox) se añadió el motor pedagógico v2: cursos de tres niveles, clases largas con historia real y 40–64 diapositivas, mini-ejercicios, práctica A/B/C, dominio 80 %, exámenes y compuertas. Ver `docs/PEDAGOGIA-HANDOFF.md` y `docs/pedagogia/ESTANDAR.md`. El curso `seguridad-web` tiene dos clases escritas (borrador, visibles con el interruptor de vista previa de la Academia).
