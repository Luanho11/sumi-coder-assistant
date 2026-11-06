## 1. Contexto y objetivo

**XARA Coder Assistant** es una app de escritorio (Electron + React + TypeScript, Windows) que funciona como tutora para formarse como profesional de TI. Su *Academia* tiene rutas (cursos) → módulos → clases (diapositivas narradas por voz) → ejercicios guiados en 5 pasos → exámenes. El contenido vive en JSON dentro de `src/core/academy/data/` y se valida con `scripts/validate-content.mjs`.

**Quién la usa:** LM, que estudia por su cuenta. Es hispanohablante de Latinoamérica (Perú), quiere trabajar como profesional (desarrollo, análisis, QA, soporte) y necesita un **profesor particular excelente**, no un generador de ejercicios.

**El problema, en sus palabras:** la clase de ~1 minuto y la práctica/examen están en niveles muy distintos. Lo que le piden hacer nunca se le enseñó; el tutor asume que ya lo sabe; «no está pensando en enseñar, está pensando en cumplir». Lo que exige a partir de ahora:

1. **Nunca asumir nada.** Todo lo que se pida en práctica o examen se enseña antes, desde cero, con ejemplos resueltos.
2. **Clases de calidad de profesor particular**, mucho más completas y con mejores diapositivas.
3. **Tres niveles en cada curso** (principiante, intermedio, avanzado) que formen a un profesional.
4. **No se avanza hasta aprobar todo** lo anterior.
5. Toda la atención en que **aprenda**, no en que «cumpla».

**Lo que dijo después de ver el primer resultado (obligatorio cumplirlo):**

6. **Las clases deben atrapar y contar una historia real** (un caso con año, lugar y cifra: «en 1989…», «en 2010…») que mantenga la intriga durante toda la clase, con fuentes verificadas.
7. **Muchas más diapositivas** para ~20–25 minutos de voz (40–64), con **poco texto cada una**; lo que no cabe se dice.
8. **Nada de diseño genérico:** odia las tarjetas con barra o esquina de color a un lado, los bordes redondeados de un solo lado y los bloques de texto. Quiere un diseño con personalidad, claro y de buen gusto.
9. **Cada cosa técnica se explica antes de pedirla.** No quiere «sufrir» como en clases básicas seguidas de evaluaciones técnicas difíciles: lo que se muestra (código, símbolos, herramientas) se enseña primero y lo que se evalúa es proporcional a lo enseñado.
10. **Aprende de oído y practicando:** escuchar y hacer mini-ejercicios en el momento, antes de cualquier examen.

## 2. Diagnóstico con datos reales del código

| Dato medido en el proyecto | Valor |
|---|---|
| Clases en la Academia | 217 (210 en JSON + 7 de la ruta propia de XARA) |
| Palabras de teoría por clase | media 196 · mediana 185 · mínimo 38 · máximo 451 |
| Diapositivas por clase | media 3,0 (entre 1 y 5) |
| Duración real de una clase narrada | ≈ 1–2 minutos |
| Ejercicios que piden producir algo propio (no guiados) | 78 % (302 de 388) |
| Examen de módulo | 5 preguntas de test, 70 para aprobar, **no bloquea nada** |
| Qué marca una clase como «vista» | ver cada escena ~4 s: no comprueba que se aprendió |

**Causa raíz nº 1: el propio validador impone clases pobres.** `scripts/validate-content.mjs` exige entre 2 y 5 diapositivas y ≤ 700 caracteres por diapositiva. Mientras esa regla exista, ninguna clase puede enseñar de verdad.

**Ejemplo concreto (ruta Seguridad web, clase «Ética, permiso y alcance»).** La clase son 4 diapositivas (~257 palabras, 2 minutos) que listan ideas: permiso, alcance, divulgación. La práctica pide: *«Redacta en una página las reglas de la prueba: alcance incluido y excluido, ventana horaria, técnicas permitidas y prohibidas, contacto de emergencia, manejo de datos de pacientes y entrega del informe»*. Lo que falla:

- Se enseñó a **reconocer** (nivel «recordar/comprender») y se evalúa **crear** un documento profesional (nivel «crear»). Hay un salto de 3 escalones.
- Nunca se mostró un acuerdo completo, ni una plantilla, ni uno mal hecho para criticar, ni uno con huecos para completar.
- «Ventana», «técnicas prohibidas», «tercero», «pasarela de pagos», «hosting» aparecen sin definirse; se asume que el alumno sabe qué es cada cosa.
- El paso 1 de la práctica dice «explica qué dudas tienes» **antes** de haber enseñado nada.
- Las pistas dicen «piensa en quién es dueño de cada pieza», pero esa idea nunca se explicó como método.
- «IA solo como tutor» acaba siendo «no te ayudo»: la tutora no enseña, solo evita dar la respuesta.

**Causas raíz** (se repiten en las 20 rutas):

1. La clase es una **lista de ideas**, no una instrucción.
2. **Desajuste de nivel cognitivo** entre lo enseñado y lo evaluado.
3. **No hay modelos resueltos** ni andamiaje que se va retirando.
4. **Vocabulario sin definir y prerrequisitos asumidos.**
5. **Nada obliga a dominar** antes de avanzar.
6. Los **exámenes son demasiado cortos y adivinables** (5 preguntas con 4 opciones).

## 3. Principios y referentes (qué copiamos de cada uno)

| Referente | Qué hace | Qué copiamos |
|---|---|---|
| **Khan Academy** — [niveles de dominio](https://support.khanacademy.org/hc/tr/articles/5548760867853) y [Course Mastery](https://support.khanacademy.org/hc/en-us/articles/115002552631) | Un tema pasa por *Intentado* (<70 %), *Familiar* (70–99 %), *Competente* (100 % en el ejercicio) y *Dominado* (se logra con una prueba que mezcla temas). Hay pruebas de unidad y un «reto del curso» que muestrea todo el curso. | Dominio por tramos, umbral alto, **pruebas que mezclan temas** y un examen final del nivel que muestrea todo. |
| **freeCodeCamp** — [currículo Full Stack](https://www.freecodecamp.org/news/christmas-2025-freecodecamp-curriculum-updates/) y [su giro hacia más teoría](https://www.freecodecamp.org/news/freecodecamp-turns-10-major-curriculum-updates) | Lecciones con preguntas de comprobación → *workshops* paso a paso → *labs* desde editor vacío con pruebas → páginas de repaso → quizzes → proyecto final y examen. Añadieron más teoría porque «solo aprender haciendo» dejó huecos de explicación. | La secuencia **explicar → guiado → autónomo → repaso → examen → proyecto**, y no abandonar la explicación. |
| **Brilliant** — [aprender haciendo](https://brilliant.org/) | Todo es interactivo, en pasos pequeños, con respuesta inmediata. | Pasos pequeños y **retroalimentación instantánea**; la clase no es solo ver y oír. |
| **Rosenshine** — [10 principios de instrucción](https://www.reonline.org.uk/research/10-principles-of-instruction) | Repasar lo anterior; avanzar en pasos pequeños; dar modelos y ejemplos resueltos; guiar la práctica; comprobar la comprensión; buscar ~80 % de aciertos; dar andamios y retirarlos; práctica independiente; repasos semanales y mensuales. | La estructura de cada clase y el **umbral del 80 %**. |
| **Teoría de la carga cognitiva** — [guía que se retira gradualmente](https://ro.uow.edu.au/era/622) | Para novatos, los ejemplos resueltos dan el nivel de guía adecuado; al avanzar se sustituyen poco a poco por problemas con menos guía. En un estudio con empleados, retirar la guía gradualmente superó tanto a «ejemplo + problema» como a resolver sin ayuda. Cuando el alumno ya sabe, la guía sobra (*expertise reversal*). | Escalera de práctica **A (replica) → B (adapta) → C (crea)**: la ayuda se retira a medida que se domina. |
| **Práctica espaciada** — [metaanálisis 2025 en matemáticas](https://eprints.whiterose.ac.uk/id/eprint/229807) | Repartir la práctica en varias sesiones mejora la retención frente a concentrarla (efecto pequeño a medio, g ≈ 0,28). El beneficio de recuperar frente a releer **no** fue concluyente en ese metaanálisis, aunque otros estudios lo apoyan. | Repaso a 1, 3, 7 y 21 días **con preguntas** (no releyendo). Apostamos por el espaciado, que tiene la evidencia más firme. |

**Libros que inspiran el diseño** (ideas, no citas): *Make It Stick* (Brown, Roediger y McDaniel: aprender recordando, espaciando y mezclando temas), *How Learning Works* (Ambrose et al.: conocimiento previo, práctica dirigida y retroalimentación), *Understanding by Design* (Wiggins y McTighe: diseño «hacia atrás», empezar por lo que el alumno debe poder hacer) y los principios de Rosenshine ya citados.

## 3.1 Cómo aprende LM (esto manda sobre cualquier otra preferencia de formato)

**Aprende de oído y haciendo.** Prefiere **escuchar** una explicación y **practicarla enseguida** antes que releer texto. Consecuencias obligatorias:

1. **La voz es el canal principal.** La narración debe entenderse **sin mirar la pantalla**; la pantalla refuerza (esquema, tabla, código), no repite.
2. **Un mini-ejercicio justo después de cada idea nueva** (`micro`): se oye la pregunta, se responde en el momento y se oye la explicación. Después de la teoría viene la práctica grande, y el examen solo pregunta lo que se oyó y se practicó así.
3. **Poca lectura obligatoria.** Lo que hay que leer es corto; lo largo se dice. La hoja de referencia es opcional.
4. **Práctica antes que memoria:** cuanto antes manipule, complete, ordene, clasifique o corrija, mejor.

**Regla de oro que resume todo:** *no se evalúa nada que no se haya enseñado, modelado y practicado antes, en ese orden.*
## 4. El modelo pedagógico (obligatorio, sin excepciones)

### 4.1 Estructura de un curso

**Curso → 3 niveles → módulos → clases.** Todo curso tiene exactamente los tres niveles, aunque hoy le falte alguno.

| Nivel | Qué se asume al entrar | Qué logra el alumno | Verbos dominantes | Cierre del nivel |
|---|---|---|---|---|
| **Principiante** | Solo lo declarado en `entryBaseline` (nunca conocimiento previo del tema) | Hacer tareas guiadas del oficio y explicar los conceptos con sus palabras | recordar, comprender, aplicar | Examen de nivel + proyecto de nivel |
| **Intermedio** | Todo el nivel anterior, ya aprobado | Resolver tareas reales con criterio propio, detectar errores típicos y corregirlos | aplicar, analizar | Examen de nivel + proyecto de nivel |
| **Avanzado** | Todo lo anterior | Decidir entre alternativas, revisar trabajo ajeno (incluido el generado por IA) y defenderlo en entrevista | analizar, evaluar, crear | Examen de nivel + proyecto final de portafolio |

Tamaño orientativo: cada nivel tiene 2–5 módulos; cada módulo 2–4 clases; **cada clase enseña una sola habilidad** que se pueda practicar y medir.

### 4.2 La ley de paridad (si una regla se rompe, la clase está mal)

1. **Se enseña antes de pedir.** Nada que aparezca en una práctica, una pista, un examen o una pregunta de entrevista queda sin enseñar en una clase anterior o en la misma.
2. **Todo entregable se modela antes.** Si un ejercicio pide *producir X* (un documento, una consulta, un diagrama, un componente, una prueba), la clase incluye: la **anatomía de X** (sus partes y para qué sirve cada una), una **plantilla**, un **ejemplo resuelto completo** pensando en voz alta, un **ejemplo con huecos** que el alumno completa, y un **ejemplo defectuoso** para criticar.
3. **Toda palabra técnica se define la primera vez que aparece**, en palabras de todos los días, con un ejemplo y, si hace falta, un no-ejemplo. Va al glosario del curso.
4. **El nivel cognitivo sube un solo escalón cada vez.** La práctica va en escalera: **A replica** el ejemplo resuelto con otros datos; **B adapta** a un caso con un cambio; **C crea** desde cero la tarea profesional.
5. **Toda pista remite a algo enseñado** («repasa la parte 3»), nunca a algo que se da por sabido.
6. **Las preguntas de examen miden objetivos enseñados y practicados**, no trucos ni vocabulario que no se explicó.

### 4.3 Anatomía de una clase (la receta)

Una clase dura **35–50 minutos con práctica** (narración 20–28 min repartida en **40–64 diapositivas cortas**, de unos 25–40 segundos cada una). Fases:

| Fase | Qué contiene | Reglas |
|---|---|---|
| **0. Preparación** | Objetivos medibles («Podrás…»), por qué importa y **3 preguntas de prerrequisitos** (`readiness`). Si falla ≥ 2, se muestra un repaso breve (`remedial`) antes de empezar. | Las preguntas solo miden lo que se sabe *antes* de la clase. Jamás usan términos que la clase enseña. |
| **1. Gancho** | Un **caso real con fuente** (año, lugar, cifra) que intriga y que la clase te enseñará a entender y a resolver. | Nunca inventado. Ver 4.3b: la historia recorre toda la clase. |
| **2. Partes (4–7)** | Cada parte es una sub-habilidad con su ciclo: **concepto en capas** (intuición → nombre → definición) → **ejemplo resuelto narrado** → **no-ejemplo o error típico** → **comprobación inmediata** (1–3 ítems con explicación por distractor). Cada parte trae `reteach`: otra explicación (otra analogía, otro ejemplo) que se muestra si el alumno falla 2 veces. | Una idea por escena. Máximo 14 escenas por parte. **Cada parte abre o cierra con una escena `story`.** |
| **3. Práctica escalonada** | Ejercicios **A → B → C** (en avanzado, también **D**). | Ver 4.4. |
| **4. Cierre** | Ideas clave, **hoja de referencia** (Markdown para guardar), errores comunes con su arreglo, qué clase sigue. | La hoja de referencia se puede usar en la práctica C. |
| **5. Dominio** | ≥ 10 ítems (mejor 12) de 3 o más tipos distintos, ≥ 2 por objetivo. | Se aprueba con ≥ 80 %. |
| **6. Repaso** | 3–4 ítems distintos a los de dominio, que reaparecen a 1, 3, 7 y 21 días. | No bloquean el avance. |

**Diseño hacia atrás.** Primero se escriben los objetivos, las prácticas y las preguntas de dominio y examen; después, las partes que enseñan cada objetivo. Cada parte declara los objetivos que enseña y la matriz de alineación (objetivo → parte → ítems que lo evalúan) debe quedar completa.

**Mini-ejercicios (`micro`).** Cada parte lleva **al menos 2 escenas con un mini-ejercicio adjunto** (`scene.micro`), puesto justo después de la idea que acaba de oírse: un ítem rápido de respuesta cerrada (`mcq`, `multi`, `fill`, `order`, `classify` o `spot`) cuyo enunciado se lee en voz alta. El reproductor se detiene, pregunta, corrige y **dice la explicación**. Son formativos: no bloquean, pero registran. La comprobación de fin de parte (`checkpoint`) sigue existiendo y mezcla lo de toda la parte.

**Reglas de escena** (el validador las comprueba):

- Una escena = una idea. Título ≤ 70 caracteres. Contenido en pantalla ≤ 900 caracteres y **≤ 55 palabras de texto** (≤ 40 en `story` y `hook`), sin contar código, tablas ni diagramas: **lo que no cabe se dice, no se escribe.** Prefiere una tabla, un diagrama o una cifra grande a un párrafo.
- **Narración (lo que dice el profesor) entre 140 y 1.500 caracteres; la media ronda 350–550** (25–40 segundos). La voz recorta a 1.800: no te acerques. La narración **explica**, no lee la diapositiva.
- Cada 2–3 escenas hay un apoyo visual: diagrama `mermaid` (con color y ≤ 12 nodos), tabla comparativa o bloque de código.
- Tipos de escena: `hook`, `story`, `concept`, `definition`, `analogy`, `worked-example`, `faded-example`, `non-example`, `misconception`, `compare`, `pause-think`, `demo`, `recap`.
- Mínimos por clase: **40–64 escenas**, ≥ 2 `worked-example`, ≥ 1 `faded-example`, ≥ 1 `non-example` o `misconception`, ≥ 1 `analogy`, ≥ 3 escenas con apoyo visual, narración total entre **2.400 y 4.600 palabras** (≈ 16–30 min), `realCase` con ≥ 2 fuentes y ≥ 4 escenas reales (`hook` + `story` con fuente).

### 4.3b La historia: cada clase cuenta un caso real

El alumno aprende de oído y se queda cuando hay una historia. **Cada clase recorre un caso real, con fuente verificable**, contado por capítulos:

1. **Gancho (`hook`):** el caso real en su momento más intrigante, con una **cifra o año grande** (`stamp`), lugar y fecha (`dateline`) y la fuente (`source`). Termina en una pregunta que la clase responderá.
2. **Cada parte abre o cierra con una escena `story`:** un nuevo giro del mismo caso, otro caso real que ilustra la idea o, como mucho una por clase, una **viñeta imaginada** marcada `imagined: true` («Imaginemos…»).
3. **Datos reales solo con fuente:** cada hecho, cifra o cita se respalda en `realCase.sources` (título, URL https que abriste de verdad, y la afirmación que respalda). Si no puedes verificarlo, **no lo cuentes** o márcalo en `verify`. No inventes diálogos ni «reconstruyas» detalles que la fuente no da; cuenta lo que dice la fuente y nada más.
4. **La historia enseña, no adorna:** cada capítulo debe llevar a la idea técnica de su parte y, cuando se pueda, cerrar el círculo al final («¿recuerdas el número del principio? Ahora sabes qué falló»).
5. **Cuenta con ritmo de narrador:** escena concreta → tensión → qué cambió. Frases cortas, sin tecnicismos antes de tiempo. Ni sensacionalismo ni juicios sobre personas: hechos y consecuencias.
6. En lo legal o ético, sé exacto: «según el fiscal…», «según la prensa especializada…», y evita declarar culpables.

### 4.3c Todo lo técnico se explica antes de pedirlo

El alumno nunca debe toparse con algo técnico que no se le explicó. Reglas (el validador comprueba las dos últimas):

1. **Todo símbolo, comando, sigla o palabra clave que aparece en pantalla se explica antes** en palabras sencillas, con su ejemplo mínimo.
2. **Si hay código que leer, antes hay una escena «Cómo leer…»** que enseña la notación (qué significa cada símbolo y palabra clave) con un micro-ejercicio. Se puede partir en 2 escenas. El alumno no escribe código hasta que sabe leerlo.
3. **Lo que se pregunta con formato técnico (`entre comillas invertidas`) debe aparecer explicado en alguna escena de la clase o anterior**, o presentarse en el propio enunciado como dato de ejemplo (`nombre=valor`).
4. Cuando una herramienta aparezca (F12, un panel, un comando), una escena enseña **cómo abrirla, dónde mirar y qué significa lo que se ve**, antes de pedir que se use.
5. Si una clase se vuelve demasiado técnica para 40–64 diapositivas, **pártela en dos clases**: es mejor una clase más que una clase que obliga a sufrir en el examen.

### 4.4 La escalera de práctica

| Escalón | Qué hace el alumno | Ayuda | Comprobación |
|---|---|---|---|
| **A · Replica** | Repite el ejemplo resuelto con otros datos | Plantilla con huecos (`scaffold`), todo el vocabulario a la vista | Automática (ítems `checks`), reintentos ilimitados |
| **B · Adapta** | Resuelve un caso donde cambia una cosa (un tercero más, otro dato, otro formato) | Plantilla sin huecos, lista de comprobación | Automática + rúbrica (≥ 70) |
| **C · Crea** | Produce la tarea profesional completa | Plantilla opcional; 5 fases: entender, planificar, construir, verificar, defender | Rúbrica de ≥ 4 criterios (≥ 70) |
| **D · Transfiere** (opcional en avanzado) | Situación nueva, mezcla de clases, o **revisar trabajo ajeno (incluido el de una IA)** | Ninguna | Rúbrica |

Cada ejercicio trae: enunciado en palabras sencillas, **«lo que te piden, traducido»** (`decoded`), el entregable que produce (`produces`), pistas progresivas que remiten a una parte de la clase (`taughtIn`), una **respuesta modelo comentada** que se muestra *después* del primer intento (`exemplar` + `exemplarNotes`), rúbrica con tres niveles por criterio, errores comunes y lista de autocomprobación.

**Política de IA.** `ia_tutor` significa que la tutora **enseña**: explica de otra forma, da un ejemplo paralelo resuelto, hace preguntas que guían. Lo que no hace es escribir el entregable del alumno. Nunca significa «no te ayudo».

### 4.5 Evaluación y compuertas (avanzar exige aprobar)

| Qué | Cómo se aprueba | Si no se aprueba |
|---|---|---|
| Preparación | Informativa: si falla ≥ 2 de 3, se ofrece el repaso | — |
| Comprobación de parte | Formativa; 2 fallos seguidos activan `reteach` | No bloquea |
| Práctica A | Superar todas las comprobaciones | Reintento ilimitado |
| Práctica B | Comprobaciones + rúbrica ≥ 70 | Comparar con el modelo y reintentar |
| Práctica C | Rúbrica ≥ 70 | Comparar con el modelo y reintentar |
| **Dominio de la clase** | ≥ 80 % de un intento de ≥ 8 ítems tomados de un banco de ≥ 10 | Informe por objetivo; debe repasar la parte indicada y reintenta con **otros ítems** |
| **Examen de módulo** | ≥ 80 % de ≥ 10 ítems tomados de un banco ≥ 20 | Igual |
| **Examen de nivel** | ≥ 80 % global **y** ≥ 60 % en cada objetivo; ≥ 20 ítems de un banco ≥ 50 + ≥ 2 tareas escritas con rúbrica ≥ 70 | Igual |
| **Proyecto de nivel** | Rúbrica ≥ 70 | Retroalimentación y reentrega |

**Orden estricto, sin saltos:** la clase *n + 1* se abre al dominar la *n*; el módulo siguiente al aprobar el examen del módulo; el nivel siguiente al aprobar el examen y el proyecto del nivel. El examen de nivel de inicio **recomienda** por dónde empezar pero no desbloquea nada. Un «examen de salto» (opcional, fase tardía) exige el mismo estándar y un 85 %.

**Tipos de ítem** (varios por clase, no solo test): `mcq`, `multi`, `order`, `classify`, `fill`, `match`, `spot` (encuentra el error), `code`, `sql` y `written` (respuesta escrita con rúbrica). Los de respuesta cerrada se corrigen solos; los `written` pasan por la tutora con rúbrica (gancho de IA) y, **sin conexión, quedan «provisionales»**: se aceptan para avanzar con una autocomprobación guiada y se confirman cuando haya corrección.

**Preguntas de test bien hechas:** 4 opciones; cada incorrecta lleva `whyNot` (qué error de razonamiento delata); la correcta no es sistemáticamente la más larga ni cae casi siempre en la misma posición; sin «todas las anteriores»; la explicación dice **por qué**.
## 5. Esquema de datos v2 (contrato único)

Los cursos nuevos viven en `src/core/academy/data/courses/<id-del-curso>.json` (un archivo por curso). Si el `id` coincide con una ruta antigua, **la reemplaza** cuando `status` es `"published"`. Mientras sea `"draft"`, la app sigue mostrando la ruta antigua y el curso nuevo solo se ve con el modo de vista previa.

```ts
// src/core/academy/v2/types.ts
export type LevelId = 'principiante' | 'intermedio' | 'avanzado'
export type Bloom = 'recordar' | 'comprender' | 'aplicar' | 'analizar' | 'evaluar' | 'crear'
export type SceneKind = 'hook' | 'story' | 'concept' | 'definition' | 'analogy' | 'worked-example' | 'faded-example'
                      | 'non-example' | 'misconception' | 'compare' | 'pause-think' | 'demo' | 'recap'
export type ItemType = 'mcq' | 'multi' | 'order' | 'classify' | 'fill' | 'match' | 'spot' | 'code' | 'sql' | 'written'

export interface Course {
  schema: 2
  status: 'draft' | 'published'
  id: string                       // = id de la ruta antigua que reemplaza
  title: string; description: string
  area: Area; color: string        // #rrggbb
  audience: string                 // quién es y qué sabe al entrar
  entryBaseline: string[]          // lo ÚNICO que se asume al entrar
  outcomes: string[]               // 6-10 «Podrás…» verificables en el trabajo real
  prerequisiteCourses: string[]    // recomendados (no bloquean)
  glossary: GlossaryTerm[]         // ≥ 15 términos
  levels: [Level, Level, Level]    // principiante, intermedio, avanzado
  legacy?: { replacesModules: string[]; keptExerciseIds: string[] }
}

export interface GlossaryTerm {
  id: string                       // kebab-case estable
  term: string; aliases?: string[] // formas con las que aparece en los textos
  plain: string                    // 20-260 car., palabras de todos los días, sin circularidad
  example: string; nonExample?: string
  firstTaughtIn: string            // id de la clase que lo enseña
}

export interface Level {
  id: LevelId; title: string
  promise: string                  // «Al terminar este nivel podrás…»
  entryCheck?: Item[]              // ≥ 8 en intermedio y avanzado: prerrequisitos del nivel anterior
  modules: Module[]
  exam: ExamSpec                   // examen de nivel
  project: Project
}
export interface Module { id: string; title: string; description: string; lessons: Lesson[]; exam: ExamSpec }
export interface ExamSpec {
  bank: Item[]                     // módulo ≥ 20 · nivel ≥ 50
  perAttempt: number               // módulo ≥ 10 · nivel ≥ 20
  passPct: 80; minPerObjectivePct: 60
  writtenTasks?: Exercise[]        // nivel: ≥ 2 tareas escritas/prácticas con rúbrica
}
export interface Project {
  id: string; title: string; brief: string          // ≥ 150 car.
  deliverables: string[]                            // ≥ 3
  milestones: { title: string; tasks: string[] }[]
  rubric: Criterion[]                               // ≥ 5
  passScore: 70
  portfolioEntry: string                            // cómo presentarlo en GitHub / entrevista
}
export interface Criterion { criterion: string; objective?: string; levels: { bien: string; parcial: string; falta: string } }

export interface Lesson {
  id: string; title: string
  minutes: number                                   // 15-60, estimación honesta con práctica
  objectives: { id: string; bloom: Bloom; text: string }[]   // 2-5; text empieza por «Podrás »
  requires: string[]                                // ids de glosario ya enseñados
  teaches: string[]                                 // ids de glosario que introduce
  modelsArtifacts: string[]                         // entregables con ejemplo resuelto + ejemplo con huecos aquí
  readiness: Item[]                                 // exactamente 3
  remedial: { lessonId?: string; refresher?: string }[]   // refresher: 50-700 car.
  realCase: { title: string; summary: string;      // el caso real que recorre la clase (summary 100-700 car.)
              sources: { title: string; url: string; claim: string }[] }   // ≥ 2; url https verificada; claim = lo que esa fuente respalda
  hook: Scene                                       // kind 'hook': caso real con stamp, dateline y source (nunca imagined)
  parts: Part[]                                     // 4-7; cada parte lleva ≥ 1 escena kind 'story'
  practice: Exercise[]                              // al menos A, B y C
  mastery: { items: Item[]; passPct: 80 }           // ≥ 10 ítems (mejor 12: así el reintento trae otros), ≥ 2 por objetivo, ≥ 3 tipos
  wrapup: { keyIdeas: string[]; cheatSheet: string; commonMistakes: { mistake: string; fix: string }[]; nextLesson: string }
  review: Item[]                                    // 3-4, distintos a mastery
  resources?: { kind: 'doc' | 'video'; title: string; url: string }[]  // solo enlaces oficiales verificables
  verify?: string[]                                 // afirmaciones que una persona debe comprobar (versiones, leyes, cifras)
}
export interface Part { id: string; title: string; objectives: string[]; scenes: Scene[]; checkpoint: Item[]; reteach: Scene }
// `objectives`: ids de objetivos de la clase que ESTA parte enseña (≥ 1). Toda comprobación y todo micro-ejercicio de la parte mide solo esos objetivos,
// y todo objetivo de la clase lo enseña alguna parte: así nada se evalúa sin haberse enseñado (el validador lo comprueba y genera la matriz de alineación).
export interface Scene {
  kind: SceneKind; title: string
  content: string                  // Markdown en pantalla (tablas, código, ```mermaid), ≤ 900 car., ≤ 55 palabras de texto (≤ 40 en story y hook)
  narration: string                // lo que DICE el profesor, 140-1500 car. (media 350-550)
  stamp?: string                   // story y hook (obligatorio): la cifra o el año que ocupa la pantalla, ≤ 14 car., p. ej. «1989», «114.000»
  dateline?: string                // story y hook (obligatorio): lugar y fecha, p. ej. «CERN, Ginebra · marzo de 1989»
  source?: string                  // story y hook: nombre corto de la fuente del hecho real (obligatorio salvo imagined)
  imagined?: boolean               // viñeta inventada, se rotula «Imaginemos»; prohibida en hook
  glossaryRefs?: string[]
  artifact?: string                // obligatorio en worked-example y faded-example
  micro?: Item                     // mini-ejercicio rápido tras esta idea (≥ 2 por parte); se oye, se responde y se oye la explicación
}

export interface Item {
  id: string; type: ItemType
  objective: string                // id de objetivo que mide
  bloom: Bloom
  prompt: string
  explanation: string              // POR QUÉ (30-420 car.); en `written` va en la rúbrica
  // mcq:      options: {text, whyNot?}[4], correctIndex
  // multi:    options: {text, whyNot?}[5-6], correctIndexes[]
  // order:    steps: string[] (4-7, escritos en el orden correcto; la UI los baraja)
  // classify: buckets: string[], cases: {text, bucket}[] (≥ 6, ≥ 2 por categoría)
  // fill:     template con «___», blanks: {accept: string[]}[] (1-4)
  // match:    pairs: {left, right}[] (4-6)
  // spot:     artifact: string (≥ 3 líneas), correctLines: number[] (1-based)
  // code/sql: starter, solution, tests[] (reutiliza el motor del Entorno), functionName?, setup?
  // written:  rubric: Criterion[] (≥ 3), exemplar (≥ 200 car.), minWords, offlineChecklist: {criterion, anyOf: string[]}[] (≥ 3)
}

export interface Exercise {
  id: string; tier: 'A' | 'B' | 'C' | 'D'; title: string
  statement: string                // 80-1600 car., palabras sencillas
  decoded: { youAreAsked: string[]; terms: string[]; doNotNeed?: string[] }   // «lo que te piden, traducido»
  produces?: string                // entregable; debe estar en modelsArtifacts de esta clase o anterior
  aiPolicy: 'sin_ia' | 'ia_tutor' | 'ia_par'
  objectives: string[]
  scaffold?: string                // plantilla o esqueleto (obligatorio en A y B)
  steps: { id: string; title: string; prompt: string; checklist?: string[] }[]   // A/B: intenta·compara·corrige; C: entender·plan·construir·verificar·defender
  hints: { text: string; taughtIn: string }[]    // ≥ 3; taughtIn = id de una parte ya enseñada
  exemplar: string                 // respuesta modelo (se muestra tras el primer intento)
  exemplarNotes: string[]          // ≥ 2: qué mirar y por qué está bien
  rubric: Criterion[]              // A/B ≥ 3 · C/D ≥ 4
  commonErrors: string[]; selfCheck: string[]
  checks?: Item[]                  // comprobación automática (obligatoria en A y B salvo rúbrica)
  interviewQuestion?: string; harderVariant?: string
  legacyId?: string                // id del ejercicio antiguo del que procede
  challengeId?: string             // reto del Entorno (challenges.json) que sirve de práctica o comprobación
}
```

**Modelo de referencia.** `docs/pedagogia/muestra-oro-sec-l1.v2.json` (adjunto al prompt) es una clase completa que cumple el esquema y pasa el validador: 25 escenas, ~3.200 palabras de narración (~20 min), tres ejercicios en escalera, 10 ítems de dominio. **Léela entera antes de escribir una sola línea y úsala como vara de calidad.** Si tu clase es más floja que ella, no está terminada.

**Numeración en los mapas curriculares.** En el mapa de cada curso, «L1, L2…» indican el **orden pedagógico** y no son los `id`. El `id` de una clase que migra es el antiguo; el de una clase nueva continúa la numeración con el prefijo del curso. **El orden de las clases en el JSON es el orden en que se enseñan**: el validador lo usa para comprobar que nada se pide antes de enseñarse.

**Identificadores.** Clases: `<prefijo>-l<n>` (p. ej. `js-l12`; **conserva** el id antiguo cuando la clase migra). Partes: `<clase>-p<n>`. Objetivos: `<clase>-o<n>`. Ítems: `<clase>-m<n>` (dominio), `-cp<parte><letra>` (comprobación), `-r<n>` (preparación), `-v<n>` (repaso). Todos únicos en el curso.
## 6. Cómo escribe un profesor particular excelente

### 6.1 La voz

- **Español latinoamericano neutro, tuteo.** Cálido, directo, sin condescendencia ni exclamaciones vacías. Habla *con* el alumno: «fíjate», «pausa y piensa», «vamos a hacerlo juntos».
- **Nunca asume.** Prohibido «como ya sabes», «obviamente», «simplemente», «es trivial». Si una palabra técnica no se definió, se define ahora.
- **Anticipa la confusión:** «si te estás preguntando X, es normal; pasa porque…».
- **Explica el porqué de cada paso**, no solo el qué. En un ejemplo resuelto: qué hago, por qué lo hago, qué podría salir mal y cómo compruebo.
- **Concreto antes que abstracto.** Personas, datos y situaciones reales (una pyme, una clínica, una tienda, un equipo de soporte). Contexto latinoamericano cuando ayude (soles, Yape, boletas, horarios de Lima), sin depender de datos locales que no puedas verificar.
- **Tecnicismos:** el término en inglés se da con su glosa la primera vez («endpoint, el punto de acceso de una API»). Código con identificadores en inglés o español, pero **consistente** en todo el curso; comentarios y explicaciones en español.
- **Sin relleno.** El validador rechaza «es muy importante», «en el mundo actual», «sumérgete», etc. Una frase que se puede borrar sin perder nada, se borra.

### 6.1b Escribir para el oído (el alumno escucha más de lo que lee)

- **La narración se entiende sin mirar.** Si dices «como ves en la tabla», di también qué hay en ella. Anuncia la estructura: «Son tres cosas. Primera…».
- **Frases cortas, una idea por frase,** repitiendo el término clave en vez de usar «esto» o «eso».
- **El código se describe hablando** («la línea que compara el correo con la contraseña…»); nunca esperes que se lea un símbolo. En pantalla va el código; en la voz, su sentido.
- **Cifras y siglas dichas con claridad** («ochenta por ciento», «A-P-I, interfaz de programación»).
- **Cada micro-ejercicio** tiene un enunciado de ≤ 260 caracteres que suene bien leído en voz alta y opciones breves.
- **Termina cada escena importante con una frase que fije la idea** («Si te quedas con una cosa: …»).

### 6.1c Contar la historia (cada clase es un relato real)

- **Empieza por la escena, no por la definición.** Año, lugar, persona, cifra. «Junio de 2010. Hace pocos meses que salió el iPad…».
- **Una cifra o un año por pantalla** (el `stamp`): lo grande se recuerda. El texto en pantalla es una frase corta; lo demás lo cuenta la voz.
- **Capítulos:** gancho → giro en cada parte → desenlace que cierra el círculo. Entre capítulos, la teoría; cada idea técnica se *gana* con un momento del relato.
- **Fidelidad total a la fuente.** Cuenta lo que la fuente dice, con sus matices («según la prensa especializada», «el fiscal escribió que…»). No inventes diálogos, motivos ni cifras. Si dos fuentes difieren, di «entre X e Y» o no uses la cifra y anótalo en `verify`.
- **Hechos, no sentencias.** Describe lo que ocurrió y sus consecuencias; evita adjetivos sobre personas y no declares culpables.
- **Casos reales primero; viñetas imaginadas solo para probar tú mismo** («Imaginemos…» y `imagined: true`), como mucho una por clase, y nunca en el gancho.
- **Elige casos que enseñen:** el caso debe contener la idea técnica de la clase (un número editable en una dirección, un permiso mal escrito…), no ser solo famoso.

### 6.1d Nada técnico sin explicar

- Todo símbolo, comando, sigla o herramienta que aparezca en pantalla se explica **antes**, con palabras sencillas y un ejemplo mínimo.
- **Antes de mostrar código, una escena «Cómo leer…»** (se puede partir en dos): una tabla «Escrito → Se lee» con 5–9 piezas y un micro-ejercicio. El código se **lee** (de arriba abajo, línea a línea) antes de pedirse que se escriba.
- **Herramientas** (F12, un panel, un comando): primero cómo se abren y dónde mirar; después qué significa lo que se ve; solo entonces, una tarea.
- **En los ítems**, evita el formato técnico que la clase no enseñó. Si usas un dato de ejemplo (`precio=1`), preséntalo en el propio enunciado.
- Si explicar todo lo técnico no cabe en 64 diapositivas, **parte la clase en dos**.

### 6.2 Cómo se enseña un concepto: el ciclo de 5 movimientos

1. **Caso concreto** donde se siente el problema (sin nombre técnico todavía).
2. **Nombre y definición** en palabras sencillas, con un ejemplo.
3. **Analogía** con algo cotidiano y dónde **se rompe** la analogía.
4. **Contraejemplo**: qué *no* es, o el error típico y por qué falla.
5. **Comprobación**: una pregunta para que el alumno use lo que acaba de ver.

### 6.3 Cómo se escribe un ejemplo resuelto

Dos o más por clase, de tamaño real (no de juguete). Cada paso responde a cuatro preguntas: **qué hago · por qué · qué podría salir mal · cómo lo compruebo**. Muestra también el resultado final **completo** (el documento, la consulta, el diagrama, el componente) para que el alumno vea cómo es un trabajo terminado. Después viene el ejemplo con huecos (`faded-example`) y su solución comentada. Y conviene un ejemplo **defectuoso** para criticar (`non-example` o ítem `spot`).

### 6.4 Convenciones de pantalla (la app las dibuja con estilo propio)

- `> **Ejemplo:** …`, `> **Ojo:** …`, `> **Truco:** …`, `> **Error típico:** …`, `> **Recuerda:** …` → banda de color plana (sin barra lateral ni esquina marcada).
- Lista numerada → pasos que van apareciendo al ritmo de la voz.
- Tabla `| ✅ Bien | ❌ Mal |` → comparativa de dos columnas.
- ```` ```mermaid ```` → diagrama (con `classDef ... fill:` para color, ≤ 12 nodos).
- Bloque de código → con resaltado; las líneas importantes se explican con comentarios `// ← por qué`.
- Máximo 3 emojis por escena y nunca como sustituto de una explicación.

### 6.5 Dos escenas de muestra (nivel de calidad exigido)

**Definición** (de `muestra-oro-sec-l1`, escena «Alcance, fuera de alcance y ventana»). En pantalla: tres definiciones breves con un ejemplo cada una. La narración dice, entre otras cosas: *«El alcance es la lista exacta de lo que sí puedes probar. Y exacta quiere decir con nombre: un dominio, una dirección, una aplicación concreta. No vale decir "la web". Lo contrario es lo que queda fuera de alcance: todo lo que no esté en esa lista, aunque esté conectado a algo que sí puedes probar. Esta idea es importantísima, porque en la vida real los sistemas están enlazados unos con otros y es fácil cruzar la línea sin querer.»* — Fíjate: el término se define, se ilustra, se contrasta con su opuesto y se avisa del error típico.

**Ejemplo resuelto** (escena «Panadería La Espiga»). La narración piensa en voz alta: *«Lo primero que hago no es probar nada: es preguntar de quién es cada pieza… Con eso decido el alcance… Después elijo la ventana. Le pregunto al dueño cuándo vende menos, porque una prueba puede ralentizar el sistema… Fíjate en el orden: primero las piezas, luego el alcance, luego la ventana.»* — Muestra el **proceso**, no solo el resultado, y termina nombrando el patrón.

### 6.6 Lo que se prohíbe

Copiar texto de otras webs (parafrasea y cita la fuente en `resources`); inventar cifras, estudios, leyes, sueldos o IDs de vídeos; ejercicios cuyo único valor es «cumplir»; enunciados que mezclen tres habilidades nuevas; opciones de test absurdas; ejemplos juguete que no se parecen al trabajo real; clases que son una lista de viñetas.
## 7. Calidad, verificación y forma de trabajar

### 7.1 Reglas duras (las comprueba `scripts/validate-content-v2.mjs`; si falla, no está terminado)

- Tres niveles en orden; objetivos «Podrás…» con verbo de Bloom; al menos un objetivo de nivel *aplicar* o superior por clase.
- Clase: **40–64 escenas**, 4–7 partes, narración total **2.400–4.600 palabras**, ≥ 2 `worked-example`, ≥ 1 `faded-example`, ≥ 1 contraejemplo o error típico, ≥ 1 analogía, ≥ 3 escenas visuales.
- Escena: título ≤ 70, contenido ≤ 900 caracteres y **≤ 55 palabras de texto (≤ 40 en `story`/`hook`)**, narración 140–1.500 caracteres, sin frases genéricas ni «como ya sabes».
- **Historia real:** `realCase` con título, resumen y ≥ 2 fuentes (URL https, afirmación respaldada); el `hook` es un caso real con `stamp`, `dateline` y `source` (nunca `imagined`); ≥ 4 escenas reales; **cada parte lleva ≥ 1 escena `story`**; toda `story` lleva `source` o `imagined: true`.
- **Paridad técnica:** lo que va entre comillas invertidas en una pregunta se explicó antes en una escena de la clase (o anterior), o es un dato de ejemplo `nombre=valor` presentado por la propia pregunta; si hay código en pantalla o en preguntas, existe antes una escena «Cómo leer…».
- **Alineación:** cada parte declara `objectives` (los que enseña); sus comprobaciones y micro-ejercicios miden solo esos; todo objetivo de la clase lo enseña alguna parte. Al terminar un curso, ejecuta `node scripts/gen-alineacion-v2.mjs` y guarda la matriz en `docs/alineacion/<curso>.md`.
- Cada parte tiene 1–3 comprobaciones, una escena `reteach` y **al menos 2 micro-ejercicios** (`scene.micro`) justo después de las ideas nuevas.
- `readiness`: exactamente 3 preguntas, sin términos que la clase enseña.
- Práctica con escalones A, B y C; pistas con `taughtIn` válido; `exemplar` y ≥ 2 `exemplarNotes`; rúbrica con tres niveles por criterio.
- **Paridad:** todo `produces` tiene `worked-example` y `faded-example` del mismo `artifact` en esa clase o antes.
- Dominio: ≥ 10 ítems (mejor 12), ≥ 2 por objetivo, ≥ 3 tipos, alguno de nivel aplicar/analizar; test con `whyNot` en cada distractor; respuestas bien repartidas.
- **Ningún término del glosario aparece en ítems de dominio, repaso o práctica antes de la clase que lo enseña.**
- Curso publicado: glosario ≥ 15, bancos de examen (módulo ≥ 20, nivel ≥ 50), ≥ 8 preguntas de entrada en intermedio y avanzado, ≥ 2 tareas escritas por examen de nivel, proyecto con ≥ 5 criterios.

### 7.2 Autorrevisión antes de cada commit (que el validador pase **no basta**)

1. **Prueba del alumno novato.** Relee la clase como alguien que nunca vio el tema. ¿Hay alguna palabra sin definir, algún salto, algún «ya sabes»?
2. **Prueba del examen.** Para cada ítem de dominio, señala la escena que lo enseña. Si no existe, añade la escena o borra el ítem.
3. **Prueba de la práctica C.** ¿Quien hizo bien A y B tiene todo lo necesario para C? ¿El enunciado pide solo una habilidad nueva?
4. **Prueba del distractor.** Cada opción incorrecta debe ser plausible para alguien que entendió mal algo concreto, y `whyNot` debe nombrar ese error.
5. **Prueba del hecho.** Toda afirmación técnica verificable (comando, versión, cifra, ley, norma) se comprueba contra la documentación oficial si tienes acceso a la web. Si no lo tienes, evita la cifra o añádela a `verify` de la clase. Nunca inventes datos.
6. **Prueba de la voz.** Lee tres narraciones en voz alta, **sin mirar la pantalla**: ¿se entienden? ¿suenan a persona que enseña o a manual? Si dependen de lo que se ve, reescríbelas.
7. **Prueba de la historia.** ¿Cada hecho tiene fuente que *abriste*? ¿La historia llega hasta el final y se conecta con la idea técnica de cada parte? ¿Podrías contarla en 30 segundos a un amigo sin aburrirlo? Si un dato no se pudo verificar, sácalo.
8. **Prueba del «¿esto qué es?».** Recorre las diapositivas con el dedo: cada símbolo, comando, sigla o herramienta, ¿tiene antes su explicación? Si hay código, ¿hay antes «Cómo leer…»? Si un símbolo aparece en un examen y nunca se explicó, la clase no está terminada.
9. **Prueba de la diapositiva.** Tapa la narración: ¿la pantalla se entiende con una mirada de 3 segundos? Si hay un muro de texto, pásalo a la voz.
10. **Prueba del tiempo.** ¿`minutes` es honesto (narración + práctica + dominio)? Una clase de 20 minutos de narración rara vez cabe en menos de 35.

### 7.3 Cómo trabajar

1. **Antes de escribir contenido:** lee la muestra de oro, el glosario que vas a construir y el estado actual del curso.
2. **Primero el esqueleto completo del curso**: título, `audience`, `entryBaseline`, `outcomes`, glosario inicial, niveles, módulos y **todas las clases con sus objetivos y los entregables que modelan**. Valida la estructura antes de escribir escenas.
3. **Luego clase por clase, en orden.** Para cada una: objetivos → glosario nuevo → escenas de cada parte (con su comprobación y `reteach`) → ejemplos resueltos y con huecos → práctica A/B/C → ítems de dominio → repaso. Valida después de cada clase con `node scripts/validate-content-v2.mjs --course src/core/academy/data/courses/<id>.json`.
4. **Después los exámenes** de módulo, de nivel, las preguntas de entrada y los proyectos.
5. **Commits pequeños**, uno por módulo: `git add -A && git commit -m "contenido(<curso>): <módulo> — <n> clases"`.
6. **Escribe el JSON con scripts**, no a mano en un solo bloque (p. ej., Python que construye diccionarios y vuelca con `ensure_ascii=False`). Guarda los generadores en `scripts/contenido/<curso>/` para poder regenerar y corregir. Nunca intentes producir un curso entero de golpe.
7. **Lleva el diario** en `docs/pedagogia/progreso/<curso>.md`: estado por clase (pendiente · escrita · validada · revisada), decisiones, dudas para verificar y lo que falta. Si te quedas sin contexto, deja ese archivo al día: otra sesión continuará desde ahí.
8. **Publica solo al final.** `status: "published"` únicamente cuando el curso entero valida, pasó la autorrevisión y el diario lo dice. Hasta entonces, `"draft"`.

### 7.4 Lo que NO debes hacer

- Tocar el código de la app (`src/main`, `src/renderer`, `src/preload`, `src/core` salvo `data/`), proveedores de IA, `secrets.ts` o `package.json`. Si el motor no soporta algo que necesitas, anótalo en el diario y sigue.
- Llamar a ninguna API ni modelo para generar contenido en tiempo de ejecución: **todo el contenido se escribe aquí, estático.** No hay claves en este entorno y no debes pedirlas.
- Borrar contenido antiguo: el nuevo lo reemplaza al publicarse y el antiguo queda en git. Sí reutiliza sus ideas, ejercicios y enlaces cuando sirvan, citándolos en `legacy`.
- Copiar texto de otras webs. Parafrasea. En `resources` solo enlaces oficiales que sepas que existen; **nunca inventes IDs de vídeo ni URLs**.
- Inflar con relleno para llegar al mínimo de palabras: la longitud sale de explicar y modelar bien.

### 7.5 Entrega (handoff)

Al terminar, o al agotar tu contexto: (1) validador en verde para todo lo que esté `published`; (2) diario actualizado; (3) lista de afirmaciones a verificar (`verify`) consolidada en el diario; (4) un resumen de 10 líneas de lo hecho y lo pendiente. **Otra persona añadirá después la integración con la API de IA y generará el instalador**; tú no necesitas ninguna de esas dos cosas.
