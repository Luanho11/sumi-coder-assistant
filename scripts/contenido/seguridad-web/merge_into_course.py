#!/usr/bin/env python3
# Inserta o reemplaza clases (y sus términos de glosario) en el JSON v2 de un curso, conservando el resto.
# Uso: merge_into_course.py <curso.json> <modulo-id> <clase.json> [<clase.json> ...]
import json, sys
course_path, module_id, *lessons = sys.argv[1:]
course = json.load(open(course_path, encoding='utf-8'))
mod = next(m for lv in course['levels'] for m in lv['modules'] if m['id'] == module_id)
gl = {g['id']: g for g in course.get('glossary', [])}
order = []
for f in lessons:
    d = json.load(open(f, encoding='utf-8'))
    for g in d['glossary']: gl[g['id']] = g
    lid = d['lesson']['id']
    idx = next((i for i, l in enumerate(mod['lessons']) if l['id'] == lid), None)
    if idx is None: mod['lessons'].append(d['lesson'])
    else: mod['lessons'][idx] = d['lesson']
    order.append(lid)
# el orden del módulo sigue el orden dado en la línea de comandos para las clases que se pasaron
rest = [l for l in mod['lessons'] if l['id'] not in order]
byid = {l['id']: l for l in mod['lessons']}
mod['lessons'] = [byid[i] for i in order] + rest
course['glossary'] = list(gl.values())
json.dump(course, open(course_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', [l['id'] for l in mod['lessons']], 'glosario', len(course['glossary']))
