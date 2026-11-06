# Pedagogía v2 — estado y cómo continuar

## Qué está hecho
- **Motor v2 completo** (`src/core/academy/v2`, `src/main/academy-v2.ts`, `src/renderer/src/v2`): cursos de 3 niveles, clases largas por partes, mini-ejercicios, práctica A/B/C, dominio 80 %, exámenes de módulo y de nivel, proyecto, repaso espaciado, compuertas estrictas, corrección local y por IA con respaldo sin conexión.
- **Estándar** en `docs/pedagogia/ESTANDAR.md` (incluye 4.3b «historia real» y 4.3c «nada técnico sin explicar») y validador `scripts/validate-content-v2.mjs` (`npm run validate:v2`, `npm run test:validator-v2`).
- **Diseño «documental»** del escenario de clase: papel claro para explicar, noche tintada con la cifra grande para las historias; sin tarjetas con barras laterales.
- **Contenido:** curso `seguridad-web` (borrador): clases `sec-l1` (Ética, permiso y alcance) y `sec-l15` (Cómo funciona una web por dentro), ambas validadas con 0 errores. Generadores en `scripts/contenido/seguridad-web/` (se regeneran con `python3 build_l1.py out.json` y se insertan con `merge_into_course.py`).
- Los otros 19 cursos siguen en su versión antigua; su guion de reescritura está en los prompts 02–20.

## Qué falta
- Escribir el resto de las clases (≈ 350) de los 20 cursos con el mismo estándar, empezando por el orden de prioridad de los prompts.
- Probar de extremo a extremo los ítems `code` y `sql` y escribir tests de `ai-hooks`.
- La integración real con la API de IA, las claves y el instalador `.exe` (paso posterior, no hecho).

## Regla de oro al escribir
Cada clase cuenta un caso real con fuentes abiertas de verdad, tiene 40–64 diapositivas con poco texto, y **nada técnico aparece sin haberse explicado antes**. El validador lo hace cumplir.
