// Convierte las rutas del proyecto base de LM (sistema-formacion, src/lib/tracks/*.ts) al catálogo de XARA.
// Uso: node --experimental-strip-types scripts/import-formacion.mjs <carpeta-del-proyecto-base>
// Los archivos de rutas solo tienen `import type`, así que Node puede cargarlos quitando los tipos.
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = process.argv[2]
if (!base) throw new Error('Indica la carpeta del proyecto base.')
const tracksDir = path.join(base, 'src/lib/tracks')

const FILES = {
  'analisis-software': ['analisis-software.ts', 'analisisSoftwareModules', 'analisis'],
  'analisis-funcional': ['analisis-funcional.ts', 'analisisFuncionalModules', 'analisis'],
  'html-css': ['html-css.ts', 'htmlCssModules', 'frontend'],
  react: ['react.ts', 'reactModules', 'frontend'],
  angular: ['angular.ts', 'angularModules', 'frontend'],
  java: ['java.ts', 'javaModules', 'backend'],
  python: ['python.ts', 'pythonModules', 'backend'],
  csharp: ['csharp.ts', 'csharpModules', 'backend'],
  'qa-testing': ['qa-testing.ts', 'qaModules', 'calidad'],
  'datos-sql': ['sql-data.ts', 'sqlModules', 'datos'],
  'soporte-ti': ['soporte-ti.ts', 'soporteTIModules', 'devops']
}
const AI_POLICY = { guiado: 'ia_tutor', practica_autonoma: 'ia_tutor', sintesis: 'ia_tutor', reto: 'sin_ia', entrevista: 'sin_ia', aplicacion_real: 'ia_par' }
const DIFFICULTY_BY_LEVEL = { principiante: 'principiante', intermedio: 'intermedio', avanzado: 'avanzado', proyecto: 'avanzado' }

// La lista de rutas de index.ts importa otros módulos sin extensión; se leen sus datos con una expresión regular.
const indexSrc = readFileSync(path.join(tracksDir, 'index.ts'), 'utf8')
const meta = {}
for (const m of indexSrc.matchAll(/\{ id: '([^']+)', title: '([^']+)', description: '([^']+)'.*?color: '([^']+)'/g)) {
  meta[m[1]] = { title: m[2], description: m[3], color: m[4] }
}

const tmp = mkdtempSync(path.join(os.tmpdir(), 'xara-import-'))
writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')

const youtube = (v) => ({ kind: 'video', title: v.youtubeTitle ?? v.title, url: `https://www.youtube.com/watch?v=${v.youtubeId}`, youtubeId: v.youtubeId })
const list = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string' && s.trim()) : [])

const tracks = []
const exercises = []
for (const [trackId, [file, exportName, area]] of Object.entries(FILES)) {
  copyFileSync(path.join(tracksDir, file), path.join(tmp, file))
  const mod = await import(pathToFileURL(path.join(tmp, file)).href)
  const modules = mod[exportName].map((m) => ({
    id: m.id,
    trackId,
    title: m.title,
    description: m.description,
    level: m.level,
    roles: list(m.employability?.targetRoles ?? m.employability?.roles),
    ...(m.employability?.averageSalary ? { salary: m.employability.averageSalary } : {}),
    ...(m.project ? { project: { title: m.project.title, description: m.project.description, deliverables: list(m.project.deliverables) } } : {}),
    lessons: m.sessions.map((s) => {
      const videos = (s.videos?.length ? s.videos : s.youtubeId ? [{ youtubeId: s.youtubeId, youtubeTitle: s.youtubeTitle ?? s.title }] : []).map(youtube)
      for (const e of s.exercises ?? []) {
        exercises.push({
          id: e.id,
          trackId,
          moduleId: m.id,
          lessonId: s.id,
          title: e.title,
          description: e.description,
          ...(e.objective ? { objective: e.objective } : {}),
          difficulty: e.difficulty ?? DIFFICULTY_BY_LEVEL[m.level],
          kind: e.subtype ?? 'practica_autonoma',
          theory: e.type === 'teorico',
          aiPolicy: AI_POLICY[e.subtype] ?? 'ia_tutor',
          constraints: list(e.constraints),
          hints: list(e.hints),
          ...(e.solution ? { solution: e.solution } : {}),
          criteria: list(e.evaluationCriteria),
          commonErrors: list(e.commonErrors),
          ...(e.harderVariant ? { harderVariant: e.harderVariant } : {}),
          ...(e.employability?.skill ? { skill: e.employability.skill } : {}),
          ...(e.employability?.interviewQuestion ? { interviewQuestion: e.employability.interviewQuestion } : {}),
          ...(e.employability?.portfolioEvidence ? { portfolioEvidence: e.employability.portfolioEvidence } : {}),
          resources: [
            ...(e.relatedVideo ? [youtube({ youtubeId: e.relatedVideo.youtubeId, youtubeTitle: e.relatedVideo.title })] : []),
            ...(e.relatedDoc ? [{ kind: 'doc', title: e.relatedDoc.title, url: e.relatedDoc.url }] : [])
          ]
        })
      }
      return {
        id: s.id,
        title: s.title,
        ...(s.objective ? { objective: s.objective } : {}),
        slides: (s.slides ?? []).map((sl) => ({ title: sl.title, content: sl.content })),
        videos,
        ...(s.videoEval
          ? {
              quiz: {
                id: `quiz-${s.id}`,
                area,
                difficulty: DIFFICULTY_BY_LEVEL[m.level],
                question: s.videoEval.question,
                options: s.videoEval.options,
                correctIndex: s.videoEval.correctIndex,
                trackId
              }
            }
          : {}),
        exerciseIds: (s.exercises ?? []).map((e) => e.id)
      }
    })
  }))
  const t = meta[trackId] ?? { title: trackId, description: '', color: '#888888' }
  tracks.push({ id: trackId, title: t.title, description: t.description, area, color: t.color, source: 'base', modules })
}

const out = path.join(root, 'src/core/academy/data/base.json')
writeFileSync(out, JSON.stringify({ tracks, exercises }))
console.log(`${tracks.length} rutas, ${tracks.reduce((n, t) => n + t.modules.length, 0)} módulos, ${exercises.length} ejercicios → ${path.relative(root, out)}`)
