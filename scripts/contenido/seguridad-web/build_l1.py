#!/usr/bin/env python3
# Genera muestra-oro-sec-l1.v2.json: la clase "Ética, permiso y alcance" reescrita al estándar v2.
import json, sys

L = 'sec-l1'
O1, O2, O3, O4 = f'{L}-o1', f'{L}-o2', f'{L}-o3', f'{L}-o4'
P1, P2, P3, P4 = f'{L}-p1', f'{L}-p2', f'{L}-p3', f'{L}-p4'


def S(kind, title, content, narration, refs=None, artifact=None):
    s = {'kind': kind, 'title': title, 'content': content.strip(), 'narration': narration.strip()}
    if refs: s['glossaryRefs'] = refs
    if artifact: s['artifact'] = artifact
    return s


def mcq(id, obj, bloom, prompt, opts, correct, expl):
    return {'id': id, 'type': 'mcq', 'objective': obj, 'bloom': bloom, 'prompt': prompt,
            'options': [{'text': t, **({'whyNot': w} if i != correct else {})} for i, (t, w) in enumerate(opts)],
            'correctIndex': correct, 'explanation': expl}


def multi(id, obj, bloom, prompt, opts, correct, expl):
    return {'id': id, 'type': 'multi', 'objective': obj, 'bloom': bloom, 'prompt': prompt,
            'options': [{'text': t, **({'whyNot': w} if i not in correct else {})} for i, (t, w) in enumerate(opts)],
            'correctIndexes': correct, 'explanation': expl}


# ───────────────────────── Glosario ─────────────────────────
def G(id, term, plain, example, aliases=None):
    g = {'id': id, 'term': term, 'plain': plain, 'example': example, 'firstTaughtIn': L}
    if aliases: g['aliases'] = aliases
    return g


glossary = [
    G('prueba-seguridad', 'prueba de seguridad', 'Revisar un sistema buscando fallos que alguien malintencionado podría aprovechar, para arreglarlos antes de que los use.', 'Comprobar si una web de reservas deja ver las citas de otras personas.', ['pentest', 'prueba de penetración']),
    G('hacker-etico', 'hacker ético', 'Persona que usa técnicas de ataque, pero con permiso del dueño del sistema, para encontrar fallos y ayudar a corregirlos.', 'Una analista contratada por una clínica para revisar su web de citas.'),
    G('permiso-escrito', 'permiso por escrito', 'Documento firmado por quien es dueño del sistema que dice qué se puede probar, cuándo y cómo.', 'Un acuerdo de una página firmado por la doctora y por quien hace la prueba.', ['autorización', 'permiso firmado']),
    G('alcance', 'alcance', 'La lista exacta de sistemas que sí se pueden probar. Todo lo que no esté en esa lista queda fuera.', 'Alcance: citas.consultorioruiz.com y su API.'),
    G('fuera-alcance', 'fuera de alcance', 'Cualquier sistema que no aparece en la lista autorizada. No se toca, aunque esté conectado a uno que sí se puede probar.', 'La pasarela de pagos del consultorio: pertenece a otra empresa.', ['queda fuera']),
    G('reglas-prueba', 'reglas de la prueba', 'Documento corto que reúne todo lo acordado: alcance, ventana, técnicas, contacto, datos e informe.', 'Una página con siete apartados que firman ambas partes.', ['acuerdo de pruebas']),
    G('ventana', 'ventana de pruebas', 'Los días y las horas exactos en que sí se puede probar. Fuera de esa ventana no hay permiso.', 'Sábados de 08:00 a 14:00, del 7 al 28 de noviembre.', ['ventana']),
    G('tecnica-prohibida', 'técnica prohibida', 'Método que el acuerdo veta porque podría dañar el servicio o a las personas.', 'Saturar el servidor o engañar a una recepcionista.', ['técnicas prohibidas']),
    G('denegacion-servicio', 'denegación de servicio', 'Saturar un sistema con tantas peticiones que deja de atender a los usuarios reales.', 'Mandar miles de peticiones por segundo a la web hasta que se cae.', ['DoS']),
    G('ingenieria-social', 'ingeniería social', 'Engañar a personas (por llamada o correo) para que entreguen acceso o datos, en lugar de atacar la tecnología.', 'Llamar a la recepción fingiendo ser del soporte técnico para que den una clave.'),
    G('contacto-emergencia', 'contacto de emergencia', 'Persona con teléfono que puede decidir al instante qué hacer si algo se rompe durante la prueba.', 'La doctora Ruiz, con su móvil, localizable las 24 horas.'),
    G('datos-personales', 'datos personales', 'Información que identifica a una persona: nombre, teléfono, correo, historial médico.', 'El nombre y el teléfono que aparecen en una cita.', ['datos sensibles']),
    G('evidencia-minima', 'evidencia mínima', 'La menor prueba posible que demuestra que el fallo existe, sin llevarte más información de la necesaria.', 'Una captura de un solo registro con el nombre tapado.'),
    G('informe', 'informe', 'Documento que entrega quien prueba: qué encontró, cómo repetirlo, qué impacto tiene y cómo arreglarlo.', 'Un PDF cifrado con tres hallazgos, sus pasos y su corrección.'),
    G('divulgacion-responsable', 'divulgación responsable', 'Avisar del fallo en privado a quien puede arreglarlo, darle tiempo y no hablar en público antes.', 'Escribir al correo de seguridad de una empresa y esperar 90 días.'),
    G('security-txt', 'security.txt', 'Archivo público en una web que indica a quién escribir y cómo para reportar un fallo de seguridad.', 'tuweb.com/.well-known/security.txt con un correo de contacto.'),
    G('tercero', 'tercero', 'Empresa distinta de tu cliente que presta una pieza del sistema y es dueña de sus propios servidores.', 'La empresa que aloja la web o la que cobra las tarjetas.', ['proveedor']),
    G('pasarela-pagos', 'pasarela de pagos', 'Servicio externo que procesa el cobro de las tarjetas por cuenta de la tienda.', 'El botón «Pagar» que te lleva a la página segura del banco.'),
    G('hosting', 'hosting', 'Servicio de una empresa que mantiene tu página encendida en sus servidores.', 'Pagar cada mes a un proveedor para que la web esté siempre disponible.', ['alojamiento']),
]


def ST(kind, title, content, narration, stamp, dateline, source=None, imagined=False, refs=None):
    s = S(kind, title, content, narration, refs)
    s['stamp'] = stamp
    s['dateline'] = dateline
    if imagined: s['imagined'] = True
    else: s['source'] = source
    return s


def order(id, obj, bloom, prompt, steps, expl):
    return {'id': id, 'type': 'order', 'objective': obj, 'bloom': bloom, 'prompt': prompt, 'steps': steps, 'explanation': expl}


def classify(id, obj, bloom, prompt, buckets, cases, expl):
    return {'id': id, 'type': 'classify', 'objective': obj, 'bloom': bloom, 'prompt': prompt, 'buckets': buckets,
            'cases': [{'text': t, 'bucket': b} for t, b in cases], 'explanation': expl}


def fill(id, obj, bloom, prompt, template, blanks, expl):
    return {'id': id, 'type': 'fill', 'objective': obj, 'bloom': bloom, 'prompt': prompt, 'template': template,
            'blanks': [{'accept': a} for a in blanks], 'explanation': expl}


# ───────────────────────── El caso real que recorre la clase ─────────────────────────
realCase = {
 'title': 'Tres historias reales sobre el permiso: Pentágono 2016, Iowa 2019 y Misuri 2021',
 'summary': 'En 2016 el Pentágono dio permiso legal a 1.410 hackers para atacar cinco webs públicas durante cuatro semanas. En 2019 dos consultores con una carta de autorización pasaron 12 horas en la cárcel porque el edificio era del condado y no del estado que los contrató. En 2021 un periodista de Misuri vio números de seguro social en el código de una web oficial, avisó y esperó a que lo corrigieran; el gobernador lo llamó hacker y el fiscal no presentó cargos.',
 'sources': [
  {'title': 'Departamento de Defensa de EE. UU.: hoja informativa de «Hack the Pentagon» (junio de 2016)', 'url': 'https://nsarchive.gwu.edu/sites/default/files/documents/5977346/National-Security-Archive-Department-of-Defense.pdf', 'claim': 'Se dio consentimiento legal a hackers para técnicas específicas contra cinco webs públicas entre el 18 de abril y el 12 de mayo de 2016; 1.410 participantes, 1.189 reportes y 138 válidos.'},
  {'title': 'Departamento de Defensa: resultados de Hack the Pentagon (comunicado NR-228-16)', 'url': 'https://www.globalsecurity.org/security/library/news/2016/06/sec-160617-dod02.htm', 'claim': 'Ninguna de las redes críticas del Departamento formó parte de la competencia.'},
  {'title': 'Dark Reading: Hack The Pentagon paid 117 hackers', 'url': 'https://www.darkreading.com/vulnerabilities-threats/-hack-the-pentagon-paid-117-hackers-who-found-bugs-in-dod-websites', 'claim': 'Los pagos fueron de 100 a 15.000 dólares y 117 participantes cobraron.'},
  {'title': 'KrebsOnSecurity: arresto de dos pentesters de Coalfire en Iowa (2020)', 'url': 'https://krebsonsecurity.com/?p=50334', 'claim': 'El 11 de septiembre de 2019 dos expertos contratados por el estado de Iowa fueron arrestados en el juzgado del condado de Dallas; los cargos se retiraron el 30 de enero de 2020.'},
  {'title': 'Computing: Penetration testers paid to break-in to Iowa courthouse have charges dropped', 'url': 'https://www.computing.co.uk/news/3085247/pen-testers-iowa-charges', 'claim': 'Tenían autorización escrita, pasaron 12 horas en la cárcel y el sheriff dijo que el estado no podía autorizar la entrada fuera de horario a una propiedad del condado; el contrato no aclaraba ciertos puntos.'},
  {'title': 'The Register: Coalfire duo explain Iowa courthouse arrest debacle (2020)', 'url': 'https://www.theregister.com/2020/08/05/coalfire_pentest_iowa_black_hat/', 'claim': 'Los dos pentesters dijeron que el problema se habría evitado documentando mejor el alcance por escrito.'},
  {'title': 'SC Media: Cybersecurity experts arrested during assessment settle for $600,000', 'url': 'https://www.scworld.com/brief/cybersecurity-experts-arrested-during-assessment-settle-for-600000', 'claim': 'Los dos expertos llegaron a un acuerdo de 600.000 dólares con el condado de Dallas y su exsheriff.'},
  {'title': '3 News Now: el fiscal no presentará cargos contra el periodista', 'url': 'https://www.3newsnow.com/news/prosecutor-isnt-pressing-charges-against-st-louis-reporter-who-found-flaw-in-state-website', 'claim': 'Renaud avisó al estado y prometió no publicar hasta la corrección; el gobernador lo llamó hacker; el fiscal decidió no presentar cargos.'},
  {'title': 'Malwarebytes: Journalist won’t be indicted for viewing a state website’s HTML (2022)', 'url': 'https://www.malwarebytes.com/ja/blog/news/2022/02/journalist-wont-be-indicted-for-hacking-for-viewing-a-state-websites-html', 'claim': 'El fiscal escribió que había un argumento para sostener que se violó la ley, pero que el asunto se resolvió por vías no legales.'}],
}

# ───────────────────────── Gancho: Hack the Pentagon ─────────────────────────
hook = ST('hook', 'El Pentágono invitó a hackers a atacarlo',
 """EE. UU. invitó a 1.410 hackers a atacar cinco de sus webs. Pagó hasta 15.000 dólares por fallo.

¿Qué lo hizo legal?

1. Que eran hackers famosos
2. Que tenían permiso
3. Que lo hicieron de noche""",
 """Abril de 2016. El Departamento de Defensa de Estados Unidos hace algo que parecía imposible: invita a más de mil cuatrocientos hackers a atacar cinco de sus páginas web. No solo lo permite: paga entre cien y quince mil dólares por cada fallo válido que encuentren. Durante cuatro semanas, personas que en otro contexto estarían cometiendo un delito grave hacen exactamente lo mismo, con las mismas técnicas, y reciben dinero y felicitaciones. La primera falla llegó trece minutos después de empezar. Entonces, ¿qué cambió entre un hacker delincuente y uno invitado? Quédate con la pregunta: toda esta clase es la respuesta, y al final sabrás escribir el documento que marca la diferencia.""",
 '1.410', 'Washington D. C. · abril de 2016', 'Departamento de Defensa')

# ───────────────────────── Parte 1 ─────────────────────────
p1_scenes = [
 ST('story', 'Cinco webs, cuatro semanas, reglas escritas',
 """Solo cinco sitios públicos. Solo entre el **18 de abril y el 12 de mayo**.

Las redes críticas del Pentágono quedaron **fuera**.""",
 """Mira qué tenía de especial esa invitación. No era un vale todo. El permiso decía qué páginas: cinco sitios públicos, entre ellos defense punto gov. Decía cuándo: de un día exacto de abril a un día exacto de mayo. Decía quién: había que registrarse antes. Y dejaba fuera lo más delicado: ninguna de las redes críticas del departamento formó parte del reto. Guarda esas tres cosas, qué, cuándo y quién, porque el resto de la clase consiste en aprender a escribirlas bien.""",
 '5 webs', 'Pentágono · 18 de abril al 12 de mayo de 2016', 'Departamento de Defensa'),
 S('concept', 'Las mismas herramientas, dos resultados',
 """Un atacante y un hacker ético usan **las mismas técnicas**. Cambia una sola cosa: el permiso.

| Situación | ¿Se puede probar? |
|---|---|
| Tu propia app, en tu computadora | Sí |
| Una web con permiso firmado | Solo lo firmado |
| La web de tu banco «por curiosidad» | No: es delito |""",
 """Aquí está la clave. Quien ataca una web para robar y quien la revisa para protegerla hacen casi lo mismo: prueban entradas raras, miran qué responde el sistema, buscan puertas mal cerradas. Mira la tabla. En tu propia aplicación, en tu computadora, puedes probar lo que quieras. En la web de un cliente que firmó, solo lo firmado. Y en la de tu banco, por curiosidad, es delito. Las tres situaciones usan las mismas herramientas. Lo único que cambia es el permiso del dueño.""",
 ['hacker-etico']),
 S('analogy', 'El cerrajero',
 """Un cerrajero abre cualquier puerta con las mismas herramientas.

- Si el **dueño lo llamó**: es su trabajo.
- Si abre la del vecino «para ver si era fácil»: es allanamiento.""",
 """Una forma de recordarlo es pensar en un cerrajero. Sabe abrir casi cualquier cerradura, y esa habilidad es exactamente la misma si trabaja o si delinque. ¿Qué cambia entonces? Que alguien lo llamó. Si el dueño de una casa lo contrata para abrir su puerta, es un trabajo respetable. Si abre la del vecino solo para comprobar si era fácil, aunque no entre ni se lleve nada, es una falta grave. Con los sistemas informáticos es igual: la habilidad no define si es delito, lo define la llamada del dueño.""",
 ['permiso-escrito']),
 S('definition', 'Tres términos para empezar',
 """- **Prueba de seguridad**: revisar un sistema buscando fallos, para arreglarlos antes.
- **Hacker ético**: quien lo hace **con permiso** del dueño.
- **Permiso por escrito**: documento **firmado por el dueño** con qué, cuándo y cómo.""",
 """Pongamos nombre a lo que acabamos de ver, porque usaremos estas palabras toda la ruta. Una prueba de seguridad es revisar un sistema buscando fallos que un atacante podría usar, para arreglarlos antes de que los use. Un hacker ético es quien hace esa revisión con permiso del dueño del sistema. Y el permiso por escrito es el documento firmado por el dueño que dice qué se puede probar, cuándo y cómo. Fíjate en cómo se parecen las tres: sin la tercera, las otras dos no existen.""",
 ['prueba-seguridad', 'hacker-etico', 'permiso-escrito']),
 ST('story', 'Imaginemos: Marta encontró una puerta abierta',
 """Marta estudia sistemas. En la web de reservas de la clínica de su tía cambia `1043` por `1044` y aparece la cita de **otra paciente**.""",
 """Ahora un caso imaginado, para que lo pienses tú. Marta estudia sistemas y, un domingo, por curiosidad, abre la página de reservas de la clínica de su tía. En la dirección hay un número: cambia el mil cuarenta y tres por un mil cuarenta y cuatro y, de pronto, aparece la cita de otra paciente, con su nombre y su teléfono. Marta no buscaba nada: solo estaba curioseando. Pero ahora sabe algo que la clínica no sabe. Tiene tres caminos a la vista: seguir probando para entender el fallo, avisar a su tía, o publicarlo para que lo arreglen rápido. Guarda el dilema, volveremos a él.""",
 '1043', 'Una clínica · imaginada', None, True),
 S('pause-think', 'Pausa y piensa: ¿qué hace Marta?',
 """Marta ya vio la cita de otra paciente.

**Antes de seguir:** escribe en una frase qué haría ella, y por qué.""",
 """Hagamos una pausa. Vuelve a Marta, que ya vio la cita de otra paciente. Antes de que sigamos, escribe en una sola frase qué harías tú en su lugar y por qué. No importa si no estás seguro; precisamente el ejercicio sirve para eso. Aprender funciona mejor cuando primero intentas responder y después ves la respuesta correcta, aunque tu intento sea flojo. Guarda tu frase: al final de la clase vamos a volver a ella y comprobarás cuánto cambió tu respuesta.""",
 None),
 S('misconception', '«Solo miré, no robé nada»',
 """| Excusa | Por qué no vale |
|---|---|
| «Solo leí datos» | Entrar sin autorización ya es el acto |
| «Probé de noche» | La hora no crea permiso |
| «Lo hice con buena intención» | La intención no sustituye a la firma |
| «Usé una VPN» | Esconderte no lo hace legal |""",
 """Este es el error más común de quien empieza: pensar que mientras no rompas ni robes nada, no pasa nada. Mira la tabla. Solo leer datos: en la gran mayoría de países, entrar sin autorización ya es el delito, aunque solo mires. Probar de noche: la hora no te da permiso. Tener buena intención: cuenta para la conversación después, pero no sustituye la firma. Y usar una VPN no lo hace legal, solo más difícil de rastrear. Las leyes cambian de un país a otro, así que cuando trabajes en serio consulta la de tu país. Lo que no cambia es la regla práctica: tu mejor defensa es el papel firmado.""",
 ['prueba-seguridad']),
 S('non-example', 'Un «dale, prueba» no es un permiso',
 """> Becario, por chat: «dale, revisa la web cuando quieras»

- ¿Lo firma el **dueño**?
- ¿Dice **qué**?
- ¿Dice **cuándo**?
- ¿Queda **por escrito**?""",
 """Veamos un ejemplo de lo que no es un permiso. Un becario te escribe por chat: dale, revisa la web cuando quieras. ¿Sirve? No. Fíjate en las cuatro preguntas. Primero, ¿lo firma el dueño? Un becario no decide sobre los servidores ni los datos de los clientes. Segundo, ¿dice qué se puede probar? La web es demasiado vago. Tercero, ¿dice cuándo? Y cuarto, ¿queda por escrito en un documento que ambas partes puedan enseñar después? Si falta una sola, no tienes permiso.""",
 ['permiso-escrito']),
 S('compare', 'Con permiso y sin permiso',
 """| | Pentágono, 2016 | Marta, imaginada |
|---|---|---|
| ¿Lo autorizó el dueño? | Sí | No |
| ¿Qué se podía probar? | 5 webs concretas | Nadie lo dijo |
| ¿Cuándo? | 18 abr. – 12 may. | Nadie lo dijo |
| ¿Quedó escrito? | Sí | No |""",
 """Comparemos los dos casos de esta primera parte. Del lado del Pentágono, el dueño autorizó, se dijo qué se podía probar, se dijo cuándo y todo quedó escrito. Del lado de Marta, nada de eso existe: nadie dijo qué, nadie dijo cuándo, nada quedó escrito, y ella no es la dueña de la clínica. Fíjate que la técnica de ambos es la misma: encontrar una puerta abierta. Y fíjate en que Marta no hizo nada malo con mala intención. Pero la diferencia entre ellos no está en las intenciones: está en las cuatro filas de la tabla. Ese es el papel que vamos a aprender a escribir.""",
 ['permiso-escrito']),
 S('concept', 'Un permiso responde tres preguntas',
 """**¿Qué** puedo probar?

**¿Cuándo** puedo hacerlo?

**¿Cómo**, con qué técnicas?

Si falta una respuesta, el permiso está **incompleto**.""",
 """Convirtamos lo aprendido en un hábito: un permiso válido responde tres preguntas. Qué puedo probar, cuándo puedo hacerlo y cómo, es decir, con qué técnicas. El caso del Pentágono respondía las tres con precisión: cinco webs, cuatro semanas, reglas de qué sí y qué no. El caso de Marta no responde ninguna. Y entre medio están los casos más peligrosos: los que responden dos de las tres y dejan una vaga. Cuando leas un permiso, el tuyo o el de otro, repasa esas tres preguntas. Si falta una respuesta, el permiso está incompleto, y lo que quede sin responder lo decidirá otra persona después, probablemente en tu contra.""",
 ['permiso-escrito']),
]
p1_micro = {
 'Las mismas herramientas, dos resultados': mcq(f'{L}-u1', O1, 'comprender', 'Un atacante y un hacker ético usan casi las mismas técnicas. ¿Qué es lo que realmente los separa?',
   [('El permiso del dueño del sistema', None), ('La marca de las herramientas', 'Las herramientas pueden ser idénticas.'), ('Que uno programe mejor', 'El nivel técnico no define la ética.'), ('Que uno trabaje de noche', 'La hora no crea permiso.')], 0,
   'Las técnicas son las mismas: lo único que cambia es el permiso del dueño.'),
 'Tres términos para empezar': fill(f'{L}-u2', O1, 'recordar', 'Completa: el permiso por escrito lo firma el ___ del sistema.', 'El permiso por escrito lo firma el ___ del sistema.', [['dueño', 'dueno', 'propietario']], 'Solo quien es dueño puede autorizar la prueba; un becario o un amigo no.'),
 'Un «dale, prueba» no es un permiso': mcq(f'{L}-u9', O1, 'aplicar', 'Tu jefe te dice en una reunión: «revisa la web cuando puedas». ¿Qué falta para que sea un permiso válido?',
   [('Nada: es tu jefe y lo dijo delante de todos', 'Una frase dicha no dice qué, cuándo ni cómo, y no queda escrita.'), ('Que sea el dueño quien firme un documento con qué, cuándo y cómo', None), ('Que lo repita por mensaje de chat', 'Un chat sigue sin ser un documento firmado ni dice los límites.'), ('Que lo pruebes de noche para no molestar', 'La hora no crea permiso.')], 1,
   'Un permiso válido es un documento firmado por el dueño que dice qué, cuándo y cómo.'),
}
part1 = {
 'id': P1, 'objectives': [O1], 'title': 'Por qué el permiso lo cambia todo', 'scenes': p1_scenes,
 'checkpoint': [
  mcq(f'{L}-cp1a', O1, 'comprender', 'Una amiga te pide, por mensaje, que revises «un poco» la web de su tienda. ¿Qué te falta para poder hacerlo de forma legal?',
      [('Nada: ella es la dueña de la tienda y te lo pidió', 'Dice «un poco» y no define qué ni cuándo, y tampoco queda firmado: es un permiso vago.'),
       ('Un documento firmado que diga qué puedes probar, cuándo y cómo', None),
       ('Probar solo de madrugada, cuando casi nadie la visita', 'La hora no crea permiso; fuera de lo acordado sigues sin autorización.'),
       ('Usar una conexión anónima para que no te relacionen con la prueba', 'Esconderte no lo hace legal, solo más difícil de rastrear.')], 1,
      'Lo que convierte una revisión en prueba legítima es un acuerdo escrito con qué, cuándo y cómo. Ni la confianza, ni la hora, ni el anonimato lo sustituyen.'),
  multi(f'{L}-cp1b', O1, 'comprender', 'Marca TODAS las situaciones que sí necesitan un permiso por escrito antes de empezar.',
        [('Revisar la web de una empresa que te contrató para ello', None),
         ('Probar una app que tú programaste y corre en tu computadora', 'Es tuya y está en tu equipo: nadie más tiene que autorizarte.'),
         ('Mirar «solo un momento» la web de tu banco para ver si es segura', None),
         ('Revisar el servidor de tu universidad porque eres alumno', None),
         ('Practicar en una app diseñada para ser vulnerable y que instalaste tú', 'Está hecha para practicar y corre en tu propio equipo.')], [0, 2, 3],
        'Cualquier sistema ajeno, aunque solo mires y aunque seas alumno o usuario, necesita autorización. Tu propio equipo y las apps hechas para practicar no.'),
 ],
 'reteach': S('analogy', 'Otra forma de verlo: la invitación a una casa',
 """- Con **invitación** del dueño: puedes pasar.
- Sin invitación, aunque la puerta esté abierta: es entrar sin permiso.

El permiso por escrito es la invitación.""",
 """Si la idea del permiso todavía te parece abstracta, piensa en una casa. Si el dueño te invita a una fiesta, puedes entrar, mirar el salón y conversar. Pero si pasas por la calle y ves la puerta abierta, entrar no te da derecho: sigues sin invitación, y aunque solo mires los cuadros, estás dentro de una casa ajena. Con los sistemas informáticos pasa igual. Que un fallo deje la puerta abierta no significa que te hayan invitado a pasar. Y la invitación válida no es un gesto ni un cuando quieras: es una invitación concreta, que dice a qué habitaciones puedes entrar y hasta qué hora, y que queda escrita para los dos.""")}

# ───────────────────────── Parte 2 ─────────────────────────
p2_scenes = [
 ST('story', 'Con una carta firmada… y doce horas en la cárcel',
 """Dos consultores con una **carta de autorización** entraron a un juzgado de Iowa para probar su seguridad.

Terminaron arrestados, **12 horas** en la cárcel.""",
 """Septiembre de 2019, en Iowa. Dos profesionales de seguridad, contratados por el estado para probar sus edificios judiciales, entran al juzgado de un condado, de noche, y hacen saltar la alarma a propósito para medir la reacción. Llegan los policías. Los dos muestran una carta que autoriza el trabajo. Aun así, el sheriff los arresta. Pasan doce horas en la cárcel y los acusan de allanamiento. ¿Cómo es posible, si tenían un papel firmado? La respuesta está en las siete piezas que un acuerdo debe tener bien escritas, y vamos a recorrerlas una por una.""",
 '12 horas', 'Adel, Iowa · 11 de septiembre de 2019', 'Computing y Krebs'),
 S('concept', 'El acuerdo de pruebas, pieza a pieza',
 """| Pieza | Responde a… |
|---|---|
| Alcance | ¿Qué sí se prueba? |
| Fuera de alcance | ¿Qué no se toca? |
| Ventana | ¿Cuándo? |
| Técnicas | ¿Cómo sí y cómo no? |
| Contacto de emergencia | ¿A quién llamo? |
| Datos | ¿Qué hago con lo que vea? |
| Informe | ¿Cómo y a quién se entrega? |""",
 """Un buen acuerdo de pruebas cabe en una página y tiene siete apartados. Mira la tabla: cada pieza responde a una pregunta. El alcance dice qué sí se prueba. Lo que queda fuera dice qué no se toca. La ventana dice cuándo. Las técnicas dicen cómo se puede probar y cómo no. El contacto de emergencia dice a quién llamar si algo se rompe. El apartado de datos dice qué hacer con lo que veas. Y el informe dice cómo y a quién se entrega el resultado. Cuando falla una de estas siete, aparecen los problemas como el de Iowa.""",
 ['reglas-prueba']),
 S('definition', 'Alcance, fuera de alcance y ventana',
 """- **Alcance**: la lista exacta de lo que sí se prueba.
- **Fuera de alcance**: todo lo que no está en la lista, aunque esté conectado.
- **Ventana de pruebas**: días y horas permitidos.""",
 """Empecemos por las tres piezas que más errores provocan. El alcance es la lista exacta de lo que sí puedes probar, y exacta quiere decir con nombre: un dominio, una dirección, una aplicación concreta. No vale decir la web. Lo contrario es lo que queda fuera de alcance: todo lo que no esté en esa lista, aunque esté conectado a algo que sí puedes probar. Y la ventana de pruebas son los días y las horas exactos en que sí hay permiso. Fuera de esa ventana, no lo hay. Fíjate cuánto cambia la historia de Iowa si la ventana hubiera dicho de forma explícita que se podía entrar de noche.""",
 ['alcance', 'fuera-alcance', 'ventana']),
 S('concept', 'Un alcance real: los cinco sitios del Pentágono',
 """```text
Alcance · Hack the Pentagon, 2016
  defense.gov
  dodlive.mil
  dvidshub.net
  myafn.net
  dimoc.mil
```

Cinco nombres exactos. Nada de «sus webs».""",
 """Aquí tienes un alcance de verdad: el del reto del Pentágono. Cinco direcciones, con nombre exacto. No dice las páginas del Departamento ni todo lo relacionado con defensa: dice defense punto gov, dod live punto mil, y tres más. Cualquier otra dirección, aunque pareciera del mismo gobierno, estaba fuera. Fíjate en la lección de escritura: una persona ajena, sin conocer el proyecto, lee la lista y sabe exactamente hasta dónde puede llegar. Ese es el nivel de precisión que buscamos al redactar un alcance.""",
 ['alcance']),
 S('definition', 'Técnicas prohibidas y contacto de emergencia',
 """- **Técnica prohibida**: método que el acuerdo veta porque puede dañar el servicio o a personas.
  - **Denegación de servicio**: saturar el sistema hasta que no atienda a nadie.
  - **Ingeniería social**: engañar a personas para que den acceso.
- **Contacto de emergencia**: quien decide al instante si algo se rompe.""",
 """Siguen las técnicas y el contacto. Una técnica prohibida es un método que el acuerdo veta porque podría hacer daño. Dos clásicas: la denegación de servicio, que consiste en saturar un sistema con tantas peticiones que deja de atender a los usuarios reales, y la ingeniería social, que es engañar a personas, por llamada o por correo, para que te entreguen acceso o datos. Una afecta a las máquinas y la otra a las personas. Y el contacto de emergencia es alguien con teléfono que puede decidir al instante qué hacer si algo se rompe en plena prueba.""",
 ['tecnica-prohibida', 'denegacion-servicio', 'ingenieria-social', 'contacto-emergencia']),
 S('compare', 'Vago contra preciso',
 """| Vago | Preciso |
|---|---|
| «Probar la web» | Solo `citas.consultorioruiz.com` y su API |
| «Cuando quieras» | Sábados 08:00–14:00 (Lima), 7–28 nov. |
| «Nada que dañe» | Prohibido: saturar, engañar al personal, tocar citas reales |
| «Avísame si pasa algo» | Dra. Ruiz, +51 900 000 000, 24 h |""",
 """Aquí tienes cuatro frases vagas y su versión precisa. Probar la web dice poco; la versión precisa nombra una dirección y su API. Cuando quieras es una invitación a problemas; la buena da días, horas y zona horaria. Nada que dañe depende de qué entienda cada uno por dañar; la buena enumera lo prohibido. Y avísame si pasa algo no dice a quién ni cómo; la buena da nombre, teléfono y disponibilidad. Fíjate que la versión precisa nunca es más larga de una línea: precisión no significa más palabras, significa palabras concretas.""",
 ['alcance', 'ventana', 'tecnica-prohibida', 'contacto-emergencia']),
 S('definition', 'Datos personales, evidencia mínima e informe',
 """- **Datos personales**: información que identifica a alguien: nombre, teléfono, historial médico.
- **Evidencia mínima**: la menor prueba que demuestra el fallo.
- **Informe**: qué encontraste, cómo repetirlo, qué impacto tiene y cómo arreglarlo.""",
 """Nos quedan tres piezas, y todas tienen que ver con lo que haces con lo que encuentras. Los datos personales son información que identifica a una persona: nombre, teléfono, correo, historial médico. En una prueba verás datos de verdad, y el acuerdo debe decir qué haces con ellos: normalmente, no los copias. Cuando necesites demostrar un fallo, usas la evidencia mínima: la menor prueba posible que demuestre que existe, sin llevarte más de lo necesario. Y el informe es el documento donde cuentas qué encontraste, cómo repetirlo, qué impacto tiene y cómo arreglarlo.""",
 ['datos-personales', 'evidencia-minima', 'informe']),
 ST('story', 'Lo que el contrato no aclaraba',
 """Según la prensa, el contrato no dejaba claro si incluía **abrir cerraduras** ni entrar **fuera de horario**.""",
 """Volvamos a Iowa con las siete piezas en la mano. Según los reportes de prensa, el contrato entre el estado y la empresa no dejaba claro varias cosas: si los ataques físicos incluían abrir cerraduras, y si se podía entrar fuera del horario de trabajo. Dos frases ambiguas, dos piezas mal escritas: técnicas y ventana. Años después, los propios consultores dijeron en una conferencia que el problema se habría evitado documentando mejor el alcance por escrito. Un papel firmado protege solo hasta donde sea claro. Una frase vaga es una grieta, y el día que alguien discute, la grieta se abre.""",
 'Vago', 'Iowa · 2019', 'Computing y The Register'),
 S('concept', 'La prueba de la frase',
 """Antes de firmar, lee cada línea y pregúntate:

**¿Puede alguien ajeno entenderla de dos maneras?**

Si sí, reescríbela con un nombre, una hora o un número.""",
 """Te dejo una herramienta muy simple para revisar cualquier acuerdo que escribas: la prueba de la frase. Antes de firmar, lee cada línea como si fueras otra persona, alguien que no conoce el proyecto ni sabe qué quisiste decir. Y pregúntate si podría entenderla de dos maneras. Si la respuesta es sí, esa frase es una grieta. Se arregla de una forma: sustituyendo la palabra vaga por un nombre exacto, una hora exacta o un número exacto. Si hubieran pasado esta prueba en Iowa, la frase ataques físicos se habría convertido en una lista con lo que sí y lo que no.""",
 ['reglas-prueba']),
 S('misconception', '«Ya nos entendemos, no hace falta escribirlo»',
 """| Creencia | Realidad |
|---|---|
| «Confío en mi cliente» | La confianza no te protege ante un tercero |
| «Lo hablamos por teléfono» | Lo hablado no se puede enseñar |
| «Es obvio qué incluye» | Cada parte lo entiende distinto |""",
 """Este es el error que se paga más caro: pensar que como se llevan bien, no hace falta escribirlo todo. Mira la tabla. Confiar en el cliente está bien, pero no te protege cuando aparece un tercero que no firmó, como el sheriff de Iowa. Haberlo hablado por teléfono tampoco sirve, porque lo hablado no se puede enseñar a nadie. Y decir que es obvio qué incluye es la frase que antecede a casi todas las discusiones: lo obvio para ti no lo es para quien lee después. Escribirlo todo no es desconfianza; es la forma de cuidarse los dos.""",
 ['permiso-escrito']),
]
p2_micro = {
 'El acuerdo de pruebas, pieza a pieza': classify(f'{L}-u3', O3, 'comprender', '¿Qué pregunta responde cada pieza del acuerdo?', ['¿Qué?', '¿Cuándo?', '¿Cómo?'],
   [('Alcance', '¿Qué?'), ('Fuera de alcance', '¿Qué?'), ('Ventana de pruebas', '¿Cuándo?'), ('Fechas y horas permitidas', '¿Cuándo?'), ('Técnicas prohibidas', '¿Cómo?'), ('Técnicas permitidas', '¿Cómo?')],
   'Alcance y lo que queda fuera dicen qué; la ventana dice cuándo; las técnicas dicen cómo.'),
 'Alcance, fuera de alcance y ventana': mcq(f'{L}-u4', O3, 'aplicar', '¿Cuál de estas es una forma correcta de escribir un alcance?',
   [('Todo lo que tenga relación con la clínica', 'Es demasiado vago: incluye terceros sin decirlo.'), ('citas.consultorioruiz.com y su API', None), ('La web de la doctora', 'No da un nombre exacto ni dice qué se incluye.'), ('Lo que acordemos sobre la marcha', 'Un alcance debe estar escrito antes de empezar.')], 1,
   'El alcance es una lista exacta, con nombres concretos de lo que sí se puede probar.'),
 'Técnicas prohibidas y contacto de emergencia': fill(f'{L}-u10', O3, 'recordar', 'Completa: saturar un sistema hasta que no atienda a nadie se llama denegación de ___.', 'Saturar un sistema hasta que no atienda a nadie se llama denegación de ___.', [['servicio']], 'La denegación de servicio deja el sistema sin atender a los usuarios reales.'),
 'La prueba de la frase': mcq(f'{L}-u11', O3, 'aplicar', 'Un acuerdo dice: «Se probará la web en horario razonable». ¿Cómo lo reescribes?',
   [('«Se probará la web en horario razonable, con criterio del probador»', 'Sigue dependiendo de la interpretación de quien prueba.'), ('«Sábados de 08:00 a 14:00, hora de Lima, del 7 al 28 de noviembre»', None), ('«Se probará cuando haya pocos usuarios conectados»', 'Cuándo hay pocos usuarios no es un dato objetivo.'), ('«Se probará a cualquier hora, para mayor rapidez»', 'Es todavía más vago que la frase original.')], 1,
   'Reescribir es cambiar la palabra vaga por días, horas, zona horaria y fechas exactos.'),
}
part2 = {
 'id': P2, 'objectives': [O3], 'title': 'Qué debe decir un buen acuerdo', 'scenes': p2_scenes,
 'checkpoint': [
  fill(f'{L}-cp2a', O3, 'comprender', 'Completa la frase con el término correcto.',
       'La ___ del acuerdo dice qué días y a qué horas se puede probar; fuera de ella, la prueba deja de estar autorizada.', [['ventana', 'ventana de pruebas']],
       'La ventana de pruebas fija el cuándo. Pasarse aunque sea unos minutos significa probar sin permiso.'),
  classify(f'{L}-cp2b', O3, 'aplicar', 'Ordena cada frase según la pieza del acuerdo a la que pertenece.', ['Alcance', 'Técnicas prohibidas', 'Contacto de emergencia'],
           [('Solo la aplicación de reservas y su API', 'Alcance'), ('El panel de administración de la tienda online', 'Alcance'), ('No se podrán lanzar ataques que saturen el servidor', 'Técnicas prohibidas'),
            ('No se podrá llamar al personal haciéndose pasar por soporte', 'Técnicas prohibidas'), ('Ana Ruiz, +51 900 000 000, localizable las 24 horas', 'Contacto de emergencia'), ('Si el servicio se cae, se llama de inmediato a quien decide', 'Contacto de emergencia')],
           'Cada frase responde a una pregunta distinta: qué se prueba, cómo no se prueba y a quién se llama si algo falla.'),
 ],
 'reteach': S('compare', 'Otro modo de recordar las siete piezas',
 """Las preguntas de un periodista:

- **¿Qué?** → alcance y fuera de alcance
- **¿Cuándo?** → ventana
- **¿Cómo?** → técnicas
- **¿A quién?** → contacto e informe
- **¿Qué hago con lo que vea?** → datos""",
 """Si las siete piezas se te mezclan, agrúpalas con las preguntas que haría un periodista. Qué: el alcance dice qué sí se prueba y lo que queda fuera dice qué no. Cuándo: la ventana. Cómo: las técnicas permitidas y las prohibidas. A quién: el contacto de emergencia, para si algo se rompe, y el informe, para entregar los resultados. Y una pregunta más, la que más se olvida: qué hago con lo que vea, que son los datos. Cuando redactes un acuerdo, recorre esas cinco preguntas en orden y comprueba que cada una tiene una respuesta concreta escrita. Si alguna quedó sin responder, ahí falta una pieza.""")}

# ───────────────────────── Parte 3 ─────────────────────────
p3_scenes = [
 ST('story', 'El estado dijo sí; el condado dijo no',
 """El estado contrató la prueba. El edificio era del **condado**.

Para el sheriff, el estado **no podía autorizar** lo que no era suyo.""",
 """Esta es la parte clave del caso de Iowa. Quien contrató la prueba fue la administración judicial del estado. Pero el juzgado donde entraron los consultores era un edificio del condado, y el condado no había firmado nada. Según la prensa, el sheriff sostuvo que el estado no tenía autoridad para permitir una entrada fuera de horario a una propiedad del condado. Fíjate en la idea: quien paga la prueba no siempre es dueño de todo lo que se prueba. La pregunta que debieron responder antes de empezar es la que vamos a aprender ahora: ¿de quién es cada pieza?""",
 '2 dueños', 'Iowa · 2019', 'Computing y Krebs'),
 S('concept', 'Una web no es una sola cosa',
 """```mermaid
flowchart LR
  U[Paciente] --> A[App de citas]
  A --> H[Hosting del proveedor]
  A --> P[Pasarela de pagos]
  A --> C[Servicio de correo]
  classDef nuestro fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef tercero fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
  class A nuestro
  class H,P,C tercero
```""",
 """Una web parece una sola cosa, pero detrás hay varias piezas. Mira el esquema: el paciente usa la aplicación de citas. La aplicación, en verde, es lo que encargó la doctora. Pero esa aplicación vive en un hosting, que es de otra empresa. Cuando el paciente paga, el cobro lo gestiona una pasarela de otra compañía. Y los recordatorios salen por un servicio de correo, también ajeno. En rojo están las piezas de otros. Todas están conectadas, y por eso es tan fácil que, probando la aplicación, acabes tocando algo que no es de tu cliente.""",
 ['alcance']),
 S('definition', 'Tercero, hosting y pasarela de pagos',
 """- **Tercero**: empresa distinta de tu cliente que presta una pieza y es dueña de sus servidores.
- **Hosting**: servicio que mantiene la web encendida en servidores del proveedor.
- **Pasarela de pagos**: servicio externo que procesa el cobro de las tarjetas.""",
 """Tres términos que aparecen en casi todos los acuerdos. Un tercero es cualquier empresa que no es tu cliente pero presta una pieza del sistema, y es dueña de sus propios servidores. El hosting es el servicio que mantiene una página encendida en los servidores de una empresa: cuando pagas cada mes por tener tu web publicada, pagas hosting. Y una pasarela de pagos es el servicio externo que procesa el cobro de las tarjetas por cuenta de la tienda: la página segura a la que te lleva el botón de pagar. Tu cliente puede ser cliente de ellos, pero no es su dueño.""",
 ['tercero', 'hosting', 'pasarela-pagos']),
 S('concept', 'Solo puede autorizar el dueño',
 """| Pieza | Suele ser de… | Quien firma |
|---|---|---|
| App y su código | El cliente | El cliente |
| Hosting | Empresa de hosting | Esa empresa |
| Pasarela de pagos | Empresa de pagos | Esa empresa |

**Nadie puede dar permiso sobre lo que no es suyo.**""",
 """Aquí está la regla que más tropiezos evita: nadie puede dar permiso sobre lo que no es suyo. La doctora Ruiz puede autorizarte a probar su aplicación, porque es suya, pero no puede autorizarte a probar los servidores de su proveedor de hosting ni la pasarela de pagos. Aunque ella te diga sí, prueba todo, ese sí no cubre cosas de otras empresas. En la tabla ves cada pieza, a quién suele pertenecer y quién tendría que firmar. Es la regla que habría evitado doce horas de cárcel en Iowa.""",
 ['tercero', 'permiso-escrito']),
 S('concept', 'Dos caminos para lo que no es del cliente',
 """Si una pieza es de un **tercero**:

- **Déjala fuera**, con su nombre, por escrito.
- O consigue el **permiso de su dueño**.""",
 """Cuando una pieza es de un tercero, tienes solo dos caminos. El primero, el más sencillo y seguro: dejarla fuera del alcance y escribirlo con su nombre, por ejemplo, queda fuera el hosting del proveedor. El segundo: conseguir el permiso de la empresa dueña, y muchas veces esa empresa publica sus propias reglas para pruebas. Lo que nunca se hace es un tercer camino: asumir que como tu cliente lo usa, tú puedes probarlo. En la práctica, el primer camino cubre la gran mayoría de los casos, y por eso lo vas a practicar mucho.""",
 ['fuera-alcance']),
 S('worked-example', 'Ejemplo resuelto: Panadería La Espiga (1/2)',
 """**Encargo**: «Revisa los pedidos online de la Panadería La Espiga».

1. **Pregunto de quién es cada pieza**: la app es de La Espiga; hosting y pasarela, de otros.
2. **Alcance**: dentro → `pedidos.laespiga.example` y su API. Fuera → hosting y pasarela.
3. **Ventana**: martes 22:00–02:00, cuando casi no hay ventas.""",
 """Veamos esto en acción con un ejemplo resuelto, pensando en voz alta. El encargo dice: revisa los pedidos online de la Panadería La Espiga. Lo primero no es probar nada: es preguntar de quién es cada pieza. La aplicación de pedidos es de La Espiga. El hosting lo da otra empresa. Los cobros pasan por una pasarela. Con eso decido el alcance: dentro, la dirección de pedidos y su API; fuera, el hosting y la pasarela, escritos con nombre. Después elijo la ventana. Le pregunto al dueño cuándo vende menos, y me dice que los martes por la noche. Fíjate en el orden: primero las piezas, luego el alcance, luego la ventana.""",
 ['alcance', 'ventana'], 'acuerdo-pruebas'),
 S('worked-example', 'Ejemplo resuelto: Panadería La Espiga (2/2)',
 """```text
PRUEBA DE SEGURIDAD · PANADERÍA LA ESPIGA
Alcance: pedidos.laespiga.example y su API
Fuera de alcance: hosting del proveedor y pasarela
Ventana: martes 22:00–02:00, del 4 al 25 de nov.
Prohibido: saturar el servidor, engañar al personal,
  cambiar o borrar pedidos reales
Contacto: Rosa Quispe, +51 900 000 001, 24 h
Datos: no se copian; evidencia con datos tapados
Informe: PDF cifrado, solo a Rosa, en 10 días
```""",
 """Y este es el acuerdo terminado, que cabe en una página. Mira cómo cada línea responde a una de las siete preguntas. El alcance nombra la aplicación y su API; lo que queda fuera nombra el hosting y la pasarela. La ventana tiene días, horas y fechas. En técnicas prohibidas escribí tres cosas concretas. El contacto de emergencia tiene nombre, teléfono y disponibilidad. Para los datos, decidí que no se copian y que cualquier evidencia lleva los datos tapados. Y el informe se entrega en un PDF cifrado, a una persona y en un plazo. ¿Notas algo? No hay ni una frase que pueda interpretarse de dos maneras. Ahora te toca completar uno.""",
 ['reglas-prueba'], 'acuerdo-pruebas'),
 S('faded-example', 'Ahora tú: completa el acuerdo del gimnasio',
 """FitPlus tiene app de reservas (propia), hosting de un proveedor y cobros por pasarela.

```text
Alcance: ____________________
Fuera de alcance: ____________________
Ventana: lunes 23:00–03:00
Prohibido: ____________________
Contacto: Luis Paz, +51 900 000 002
```""",
 """Ahora te toca a ti, con ayuda. Te dejo el acuerdo del gimnasio FitPlus con huecos. Tiene una aplicación de reservas que es suya, un hosting de otra empresa y los cobros por una pasarela. La ventana y el contacto ya están hechos. Pausa y completa tres cosas: el alcance, lo que queda fuera, y las técnicas prohibidas. Usa el ejemplo de la panadería como guía, no lo copies sin pensar. Pregúntate de quién es cada pieza y qué podría hacer daño. Tómate un par de minutos, y cuando termines, sigue para comparar con la solución.""",
 ['alcance', 'fuera-alcance', 'tecnica-prohibida'], 'acuerdo-pruebas'),
 S('worked-example', 'Así se completa el acuerdo del gimnasio',
 """```text
Alcance: la app de reservas de FitPlus y su API
Fuera de alcance: hosting del proveedor y
  pasarela de pagos (otras empresas)
Prohibido: saturar el servidor, engañar al personal,
  cambiar reservas o cobros reales
```

Revisa el tuyo: ¿dejaste fuera el hosting y la pasarela?""",
 """Comprobemos. El alcance es la aplicación de reservas de FitPlus y su API: eso es lo único que es del gimnasio. Fuera de alcance van el hosting del proveedor y la pasarela de pagos, con esas palabras, porque son de otras empresas. En las técnicas prohibidas pongo saturar el servidor, engañar al personal y cambiar reservas o cobros reales. Compara con tu versión. Primera pregunta: ¿dejaste fuera el hosting y la pasarela? Si los metiste en el alcance, es el error más frecuente y el más grave, porque estarías probando sistemas ajenos. Segunda: ¿tus técnicas son concretas? Nada peligroso no vale; saturar el servidor sí.""",
 ['alcance', 'fuera-alcance'], 'acuerdo-pruebas'),
 ST('story', 'Cargos retirados y un acuerdo de 600.000 dólares',
 """Los cargos se retiraron en **enero de 2020**.

Años después, los dos consultores llegaron a un acuerdo económico con el condado.""",
 """El final de la historia de Iowa. A finales de enero de 2020 se retiraron los cargos. Los dos consultores contaron su versión en una conferencia de seguridad y pidieron leyes que protejan a quienes hacen estas pruebas de buena fe. Y años más tarde, según el medio especializado SC Media, llegaron a un acuerdo de seiscientos mil dólares con el condado de Dallas y su exsheriff. Tuvieron razón en lo legal, pero igual pasaron meses de pesadilla. La lección es práctica: un permiso bien escrito, que nombre cada pieza y a su dueño, es la forma más barata de no vivir algo así.""",
 '600.000', 'Iowa · 2020 en adelante', 'Krebs y SC Media'),
]
p3_micro = {
 'Una web no es una sola cosa': mcq(f'{L}-u5', O2, 'aplicar', 'En una tienda online, ¿cuál de estas piezas es casi siempre de otra empresa?',
   [('La pasarela de pagos', None), ('El formulario de pedidos de la tienda', 'Es parte de la aplicación propia.'), ('El catálogo de productos que sube la tienda', 'Son datos de la propia tienda.'), ('El panel de administración de la tienda', 'Lo usa y administra la propia tienda.')], 0,
   'La pasarela de pagos la presta una empresa externa con sus propios servidores.'),
 'Tercero, hosting y pasarela de pagos': fill(f'{L}-u6', O2, 'comprender', 'Completa: el servicio que mantiene tu web encendida en servidores ajenos se llama ___.', 'El servicio que mantiene tu web encendida en servidores ajenos se llama ___.', [['hosting', 'alojamiento']], 'El hosting es de la empresa proveedora, no de quien tiene la web.'),
 'Solo puede autorizar el dueño': mcq(f'{L}-u12', O2, 'aplicar', 'Tu cliente te dice: «prueba también el servidor de mi hosting, yo te autorizo». ¿Qué haces?',
   [('Acepto: él paga el servicio, así que puede autorizarlo', 'Pagar por un servicio no lo vuelve dueño de los servidores del proveedor.'), ('Pido el permiso del proveedor o dejo esa pieza fuera, por escrito', None), ('Pruebo igual, pero muy despacio para no molestar', 'La velocidad no crea permiso.'), ('Pruebo de noche para que el proveedor no lo note', 'La hora no crea permiso, y ocultarlo lo empeora.')], 1,
   'Nadie puede autorizar lo que no es suyo: el hosting es del proveedor.'),
 'Ejemplo resuelto: Panadería La Espiga (1/2)': classify(f'{L}-u13', O2, 'aplicar', 'En el caso de La Espiga, ¿qué pieza entra en el alcance y cuál queda fuera?', ['Dentro del alcance', 'Fuera de alcance'],
   [('pedidos.laespiga.example', 'Dentro del alcance'), ('La API de pedidos de La Espiga', 'Dentro del alcance'), ('El panel de administración de La Espiga', 'Dentro del alcance'), ('Los servidores del hosting', 'Fuera de alcance'), ('La pasarela de pagos', 'Fuera de alcance'), ('El servicio de correo externo', 'Fuera de alcance')],
   'Lo que es de La Espiga entra; hosting, pagos y correo son de terceros y quedan fuera con nombre propio.'),
}
part3 = {
 'id': P3, 'objectives': [O2, O3], 'title': 'De quién es cada pieza', 'scenes': p3_scenes,
 'checkpoint': [
  classify(f'{L}-cp3a', O2, 'aplicar', 'Una tienda de ropa te contrata para probar su web. Decide qué entra en el alcance y qué queda fuera.', ['Dentro del alcance', 'Fuera de alcance'],
           [('La aplicación de la tienda que programó su equipo', 'Dentro del alcance'), ('El formulario de pedidos de la propia tienda', 'Dentro del alcance'), ('Los servidores de la empresa de hosting', 'Fuera de alcance'),
            ('La página de la pasarela de pagos', 'Fuera de alcance'), ('El servicio de correo que envía los avisos', 'Fuera de alcance'), ('El panel de administración de la propia tienda', 'Dentro del alcance')],
           'Solo es alcance lo que es del cliente. Hosting, pagos y correo pertenecen a terceros y necesitarían su propia autorización.'),
  mcq(f'{L}-cp3b', O2, 'aplicar', 'La dueña de una tienda te dice: «prueba también los servidores de mi hosting, yo te doy permiso». ¿Qué haces?',
      [('Acepto: ella es quien paga, así que puede autorizarlo', 'Pagar por un servicio no vuelve a nadie dueño de los servidores del proveedor.'),
       ('Pido el permiso de la empresa de hosting o dejo esa pieza fuera del alcance', None),
       ('Pruebo igualmente, pero muy despacio para no molestar', 'La velocidad no crea permiso: seguirías probando algo ajeno.'),
       ('Pruebo solo de noche para que el proveedor no lo note', 'La hora no crea permiso; además, ocultarlo agrava el problema.')], 1,
      'Nadie puede autorizar lo que no es suyo. El hosting es del proveedor: o él firma, o queda fuera del alcance.'),
 ],
 'reteach': S('analogy', 'Otra analogía: el edificio de oficinas',
 """- **La oficina** es del cliente → puede darte permiso.
- **El edificio** es del propietario → no puede.
- **El banco de la planta baja** es de otra empresa.""",
 """Si te cuesta separar las piezas, piensa en una oficina dentro de un edificio alquilado. La oficina es de tu cliente: él puede decirte revisa mis cerraduras. Pero el edificio entero es del propietario, y las puertas del vestíbulo o los ascensores no son de tu cliente, aunque los use todos los días. Y el banco de la planta baja es de una tercera empresa, con sus propias reglas. Es justo lo que pasó en Iowa: quien contrató la prueba era dueño de una parte, pero el edificio entero tenía otro dueño. Con la web ocurre lo mismo: la aplicación es la oficina, el hosting es el edificio y la pasarela es el banco.""")}

# ───────────────────────── Parte 4 ─────────────────────────
p4_scenes = [
 ST('story', 'Un periodista vio un número… y avisó',
 """Un periodista vio números de seguro social de maestros en el **código de una web oficial**.

Avisó al estado y prometió **no publicar** hasta que lo arreglaran.""",
 """Octubre de 2021, estado de Misuri. Un periodista del diario Post-Dispatch visita una página pública del departamento de educación y, al mirar el código de la página, encuentra algo que no debería estar ahí: los números de seguro social de maestros, administradores y consejeros, más de cien mil personas. ¿Qué hace? No los descarga para guardarlos. No los publica. Escribe al estado, les explica los pasos que siguió para encontrarlo y promete no publicar nada hasta que el problema esté corregido. Quédate con esa secuencia, porque es casi un manual de lo que vamos a aprender.""",
 '2021', 'Misuri, EE. UU. · octubre de 2021', '3 News Now'),
 S('concept', 'Regla de oro: detente, documenta, avisa',
 """```mermaid
flowchart TD
  H[Encuentras un fallo] --> Q{¿Está dentro del alcance?}
  Q -- Sí --> S[Evidencia mínima y sigues lo acordado]
  Q -- No --> D[Detente]
  D --> E[Documenta cómo llegaste]
  E --> V[Avisa al cliente]
  classDef ok fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef stop fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
  class S ok
  class D,E,V stop
```""",
 """Lo que ocurre cuando algo sale del plan cabe en tres verbos: detente, documenta, avisa. Mira el diagrama. Encuentras algo. La primera pregunta es siempre si está dentro del alcance. Si lo está, recoges la evidencia mínima y sigues con lo acordado. Si no lo está, te detienes de inmediato, aunque puedas seguir. Después documentas cómo llegaste ahí, con pasos que otra persona pueda repetir. Y por último avisas a tu cliente por el canal que acordaron. La decisión de seguir no es tuya: es de tu cliente y del dueño de esa pieza.""",
 ['fuera-alcance', 'evidencia-minima']),
 S('misconception', 'Lo que nunca se hace con un fallo',
 """| Error | Por qué es grave |
|---|---|
| Descargar toda la base «para demostrarlo» | Te llevas datos personales reales |
| Seguir explorando «un poco más» | Sales del permiso |
| Publicarlo para presionar | Avisas también a los atacantes |
| Pedir dinero por el detalle | Puede considerarse extorsión |""",
 """Veamos los errores clásicos, que casi siempre nacen de buenas intenciones. Descargar toda la base de datos para demostrar lo grave que es te convierte en alguien que se llevó datos personales reales, y eso es mucho peor que el fallo. Seguir explorando un poco más te saca del permiso, aunque lo hagas con curiosidad. Publicarlo para presionar a la empresa avisa también a quienes podrían aprovecharlo antes de que se corrija. Y pedir dinero a cambio de contar el detalle puede entenderse como extorsión. El periodista de Misuri hizo lo contrario de las cuatro cosas.""",
 ['datos-personales']),
 S('concept', 'Evidencia mínima: probar sin llevarte nada',
 """**Sí guardas**

- Una captura de **un** registro
- Nombre y teléfono **tapados**
- Los pasos para repetirlo

**No guardas**

- Tablas completas
- Datos sin tapar""",
 """La evidencia mínima es una idea muy práctica. Tu trabajo es demostrar que el fallo existe, no demostrar hasta dónde llega llevándote todo. Si puedes ver la cita de otra paciente, haces una captura de una sola cita, tapas el nombre y el teléfono, y anotas los pasos exactos para repetirlo. Con eso, quien lo arregle puede reproducirlo, y tú no cargas con datos de nadie. Lo que no guardas son tablas completas ni datos sin tapar. Piensa que cada dato que te llevas es un riesgo que ahora es tuyo: si te roban la computadora, esos datos se pierden contigo.""",
 ['evidencia-minima', 'datos-personales']),
 S('concept', 'Lo encontraste sin buscarlo: divulgación responsable',
 """1. No sigas probando ni lo compartas
2. Busca el canal oficial: `security.txt`, un programa de recompensas o un correo de seguridad
3. Reporta pasos, impacto y evidencia mínima
4. Da un plazo para arreglarlo antes de hablar en público""",
 """Cuando encuentras un fallo sin buscarlo y sin ningún acuerdo, lo correcto se llama divulgación responsable, y tiene cuatro pasos. Uno: no sigas probando y no lo cuentes a nadie más. Dos: busca el canal oficial para avisar. Muchas webs publican un archivo llamado security punto txt que dice a quién escribir; otras tienen un programa de recompensas o un correo de seguridad. Tres: reporta los pasos, el impacto y la evidencia mínima. Cuatro: da un plazo razonable para que lo arreglen, noventa días es lo habitual, antes de hablar en público. Es la secuencia que siguió el periodista de Misuri.""",
 ['divulgacion-responsable', 'security-txt']),
 ST('story', 'El gobernador lo llamó hacker; el fiscal no presentó cargos',
 """El gobernador lo llamó **«hacker»** y pidió una investigación.

En febrero de 2022, el fiscal **no presentó cargos**.""",
 """Y entonces ocurrió lo que nadie esperaba. El gobernador de Misuri acusó al periodista públicamente de hackear y pidió que lo investigaran. En febrero de 2022, el fiscal del condado decidió no presentar cargos. Pero fíjate en un matiz que importa: el fiscal escribió que había un argumento para sostener que se violó la ley, y que no seguiría porque el asunto se había resuelto por otras vías. Es decir, aun haciendo todo bien, aun siguiendo los pasos correctos, el periodista pasó meses en una zona gris. Por eso, cuando trabajes en serio, tu mejor protección sigue siendo el permiso por escrito.""",
 '2022', 'Misuri, EE. UU. · febrero de 2022', '3 News Now y Malwarebytes'),
 S('worked-example', 'Ejemplo resuelto: el aviso de Marta',
 """```text
Asunto: Posible fallo de seguridad en citas.clinica.example
Hola, soy una usuaria. Al cambiar el número de la
dirección /citas/1043 por 1044 vi la cita de otra
persona. No he probado nada más ni guardado datos.
Pasos: 1) abrir mi cita 2) cambiar el número final.
¿Podrían confirmarme la recepción?
```""",
 """Resolvamos el caso de Marta. Primero, se detiene: no prueba más. Segundo, busca cómo avisar: en la web de la clínica encuentra un correo de contacto. Tercero, redacta un aviso corto y claro. Mira lo que tiene: un asunto que dice de qué se trata, quién escribe, qué vio exactamente, la afirmación de que no probó nada más ni guardó datos, los pasos para repetirlo, y una petición concreta, que confirmen la recepción. Lo que no tiene: amenazas, plazos agresivos, datos de la otra paciente, ni pedidos de dinero. Un buen aviso es corto, preciso y amable.""",
 ['divulgacion-responsable', 'informe'], 'aviso-hallazgo'),
 S('concept', 'Vuelve a tu respuesta sobre Marta',
 """Compara con lo que escribiste:

- ¿Dijiste **detenerte**?
- ¿Dijiste **avisar por el canal oficial**?
- ¿Evitaste **publicarlo** o **seguir probando**?""",
 """Ahora vuelve a la frase que escribiste sobre Marta, al principio de la clase. Compárala con tres preguntas. ¿Dijiste que se detiene? ¿Dijiste que avisa por el canal oficial, y no que lo publica ni que sigue probando para entenderlo mejor? Si tu respuesta incluyó alguna de las dos cosas prohibidas, no te preocupes: es lo que hace casi todo el mundo al principio, porque la curiosidad empuja a seguir. Lo que cambia con la formación es el reflejo. Y si tu respuesta ya estaba bien, fíjate qué agregarías ahora: la evidencia mínima y el plazo.""",
 ['divulgacion-responsable']),
 S('recap', 'Lo esencial en una pantalla',
 """- El **permiso por escrito** separa a un hacker ético de un delincuente
- El acuerdo tiene **7 piezas**
- Solo el **dueño** de cada pieza puede autorizar
- Si algo sale del plan: **detente, documenta, avisa**
- Evidencia **mínima**, divulgación **responsable**""",
 """Repasemos lo esencial. Uno: el permiso por escrito es lo que separa a un hacker ético de un delincuente, como en el Pentágono frente a Marta. Dos: un buen acuerdo tiene siete piezas, alcance, fuera de alcance, ventana, técnicas, contacto de emergencia, datos e informe. Tres: solo el dueño de cada pieza puede autorizar su prueba, como aprendiste con Iowa. Cuatro: si algo sale del plan, detente, documenta, avisa. Y cinco: demuestra el riesgo con la evidencia mínima y avisa con divulgación responsable, como el periodista de Misuri. Ahora vamos a practicar redactando acuerdos reales.""",
 None),
 S('concept', 'Si el fallo está en una pieza de un tercero',
 """1. **Detente**
2. Avisa a **tu cliente**
3. Tu cliente avisa al **tercero**

No escribas tú al tercero sin que tu cliente lo sepa.""",
 """Hay un caso especial que merece su propia pantalla: el fallo aparece en una pieza de un tercero, por ejemplo en el hosting o en la pasarela de pagos de tu cliente. ¿A quién avisas? A tu cliente, primero. Te detienes, documentas cómo llegaste y se lo cuentas. Es tu cliente quien tiene relación con ese proveedor y quien decide cómo avisarle. Si tú le escribes directamente al tercero, estás hablando en nombre de alguien sin su permiso, y además el tercero no sabe quién eres ni por qué miraste sus sistemas. Esto también protege a tu cliente: le da la oportunidad de decidir con calma.""",
 ['tercero', 'divulgacion-responsable']),
]
p4_micro = {
 'Regla de oro: detente, documenta, avisa': order(f'{L}-u7', O4, 'aplicar', 'Tu hallazgo sale del alcance. Ordena las acciones.', ['Detenerte', 'Documentar cómo llegaste', 'Avisar al cliente', 'Dejar que el cliente gestione el permiso'], 'Primero paras, luego anotas el camino, después avisas; la decisión de seguir no es tuya.'),
 'Evidencia mínima: probar sin llevarte nada': mcq(f'{L}-u8', O4, 'aplicar', 'Para demostrar un fallo con datos de pacientes, ¿qué guardas?',
   [('Toda la tabla, por si acaso', 'Te llevarías datos personales reales sin necesidad.'), ('Un registro con el nombre tapado', None), ('Cinco registros completos', 'Más datos de los necesarios.'), ('Nada y nunca lo cuentas', 'Sin evidencia mínima el fallo no se puede reproducir.')], 1,
   'La evidencia mínima demuestra el fallo con el menor daño posible.'),
 'Lo encontraste sin buscarlo: divulgación responsable': mcq(f'{L}-u14', O4, 'aplicar', 'Encontraste un fallo en una web sin ningún acuerdo. ¿Qué haces primero?',
   [('Publicarlo en redes para que lo arreglen rápido', 'Avisarías también a quienes podrían aprovecharlo antes del arreglo.'), ('Dejar de probar y buscar su canal oficial para avisar', None), ('Seguir probando para entender bien cuál es el fallo', 'Seguir probando sin permiso es justo lo que se evita.'), ('Pedir dinero a cambio de contar el detalle', 'Puede interpretarse como extorsión.')], 1,
   'Primero paras y avisas por el canal oficial; el resto viene después y con plazo.'),
}
part4 = {
 'id': P4, 'objectives': [O4], 'title': 'Cuando algo sale del plan', 'scenes': p4_scenes,
 'checkpoint': [
  order(f'{L}-cp4a', O4, 'aplicar', 'Durante una prueba autorizada, un fallo de la app de tu cliente te lleva a un servidor que no es suyo. Ordena lo que debes hacer.',
        ['Detenerte de inmediato', 'Anotar cómo llegaste hasta ahí', 'Avisar al cliente por el canal acordado', 'Esperar a que el cliente gestione el permiso del dueño del servidor'],
        'Primero se corta el acceso, después se documenta el camino y se avisa. La decisión de seguir es del cliente y del dueño del servidor, nunca tuya.'),
  mcq(f'{L}-cp4b', O4, 'aplicar', 'Al probar la web de un gimnasio con permiso, ves los datos de varios socios. ¿Qué guardas como evidencia?',
      [('Una captura de un registro con el nombre y el teléfono tapados', None),
       ('La tabla completa, para demostrar el alcance del fallo', 'Te llevarías datos personales reales sin necesidad.'),
       ('Cinco registros sin tapar, por si piden pruebas', 'Más datos de los necesarios; la evidencia debe ser mínima y tapada.'),
       ('Nada, y lo cuentas luego de memoria', 'Sin evidencia ni pasos, el fallo no se puede reproducir ni arreglar.')], 0,
      'La evidencia mínima demuestra el fallo con el menor daño posible: un registro, datos tapados y pasos para repetirlo.'),
 ],
 'reteach': S('analogy', 'Otra analogía: el hallazgo en la obra',
 """- Un electricista ve un cable pelado en el piso del vecino.
- No lo toca más. Anota dónde está. Avisa a su cliente.

Detente, documenta, avisa.""",
 """Piensa en un electricista que trabaja en un piso y, al asomarse por la pared, ve un cable pelado que va hacia el piso del vecino. ¿Qué hace? No entra al piso del vecino a investigarlo, aunque tenga las herramientas. Se detiene, anota dónde lo vio y avisa a su cliente para que el cliente hable con el vecino. Con un fallo fuera de alcance pasa igual: tienes la herramienta y quizá la curiosidad, pero la decisión de entrar a eso no es tuya, ni siquiera de tu cliente: es del dueño de lo que encontraste. Tres verbos: detente, documenta, avisa.""")}

PARTS = [(part1, p1_micro), (part2, p2_micro), (part3, p3_micro), (part4, p4_micro)]
# ───────────────────────── Práctica escalonada ─────────────────────────
ROE_TEMPLATE = """```text
PRUEBA DE SEGURIDAD · [NOMBRE DEL CLIENTE]
Alcance: [qué sí, con nombres exactos]
Fuera de alcance: [qué no, con nombres]
Ventana: [días, horas, zona horaria]
Prohibido: [técnicas concretas]
Contacto de emergencia: [nombre, teléfono, disponibilidad]
Datos: [qué haces con los datos que veas]
Informe: [formato, a quién, plazo]
```"""

exA = {
 'id': f'{L}-pa', 'tier': 'A', 'title': 'Completa el acuerdo de la florería',
 'statement': 'La florería Pétalo recibe pedidos por una aplicación propia (`pedidos.petalo.example`). La web está en un hosting de un proveedor y los cobros se hacen por una pasarela externa. La dueña, Elena Rojas (+51 900 000 003), pide revisar la aplicación los domingos de 06:00 a 10:00, del 8 al 29 de noviembre. Completa los apartados que faltan del acuerdo siguiendo el modelo de la panadería.',
 'decoded': {'youAreAsked': ['Decidir qué piezas son de la florería y cuáles de terceros', 'Escribir el alcance y lo que queda fuera con nombres concretos', 'Completar técnicas prohibidas, datos e informe'], 'terms': ['alcance', 'fuera-alcance', 'ventana', 'tecnica-prohibida', 'datos-personales', 'informe'], 'doNotNeed': ['Saber programar', 'Conocer herramientas de pruebas']},
 'produces': 'acuerdo-pruebas', 'aiPolicy': 'ia_tutor', 'objectives': [O2, O3],
 'scaffold': ROE_TEMPLATE.replace('[NOMBRE DEL CLIENTE]', 'FLORERÍA PÉTALO').replace('[días, horas, zona horaria]', 'domingos 06:00–10:00, del 8 al 29 de nov.').replace('[nombre, teléfono, disponibilidad]', 'Elena Rojas, +51 900 000 003, 24 h'),
 'steps': [
  {'id': 'intenta', 'title': 'Intenta', 'prompt': 'Completa Alcance, Fuera de alcance, Prohibido, Datos e Informe en la plantilla.'},
  {'id': 'compara', 'title': 'Compara', 'prompt': 'Mira el modelo y marca en qué se parece o se diferencia tu versión.'},
  {'id': 'corrige', 'title': 'Corrige', 'prompt': 'Reescribe lo que estuviera vago o incompleto.'}],
 'hints': [
  {'text': 'Empieza por separar las piezas: aplicación, hosting y pasarela. ¿De quién es cada una?', 'taughtIn': P3},
  {'text': 'En «Prohibido» escribe técnicas concretas, como las del ejemplo de la panadería.', 'taughtIn': P2},
  {'text': 'En «Datos» piensa qué ocurre si ves el nombre de un cliente: ¿lo copias o lo tapas?', 'taughtIn': P4}],
 'exemplar': 'Alcance: pedidos.petalo.example y su API. Fuera de alcance: hosting del proveedor y pasarela de pagos. Prohibido: saturar el servidor, engañar al personal, cambiar o borrar pedidos reales. Datos: no se copian datos de clientes; la evidencia lleva los datos tapados. Informe: PDF cifrado, solo a Elena Rojas, en 10 días.',
 'exemplarNotes': ['El alcance nombra solo lo que es de la florería', 'Hosting y pasarela quedan fuera con nombre propio', 'Las técnicas prohibidas son concretas y comprobables'],
 'rubric': [
  {'criterion': 'Separa lo que es de la florería de lo que es de terceros', 'objective': O2, 'levels': {'bien': 'Alcance solo con la app; hosting y pasarela fuera', 'parcial': 'Deja fuera uno de los dos terceros', 'falta': 'Mete el hosting o la pasarela en el alcance'}},
  {'criterion': 'Escribe técnicas prohibidas concretas', 'objective': O3, 'levels': {'bien': 'Nombra al menos tres técnicas concretas', 'parcial': 'Nombra una o usa frases vagas', 'falta': 'No pone técnicas prohibidas'}},
  {'criterion': 'Resuelve datos e informe', 'objective': O3, 'levels': {'bien': 'Dice qué se hace con los datos y cómo se entrega el informe', 'parcial': 'Solo resuelve uno de los dos', 'falta': 'Los deja vacíos'}}],
 'commonErrors': ['Meter el hosting o la pasarela en el alcance', 'Escribir «nada peligroso» en vez de técnicas concretas', 'Olvidar qué se hace con los datos'],
 'selfCheck': ['¿Cada pieza del alcance es de la florería?', '¿Cada técnica prohibida se puede comprobar?', '¿Una persona ajena entendería lo mismo que yo?'],
 'checks': [
  {'id': f'{L}-pa-c1', 'type': 'classify', 'objective': O2, 'bloom': 'aplicar', 'prompt': 'Clasifica cada pieza de la florería.', 'buckets': ['Dentro del alcance', 'Fuera de alcance'],
   'cases': [{'text': 'pedidos.petalo.example', 'bucket': 'Dentro del alcance'}, {'text': 'API de pedidos de la florería', 'bucket': 'Dentro del alcance'}, {'text': 'Servidores del hosting', 'bucket': 'Fuera de alcance'}, {'text': 'Pasarela de pagos', 'bucket': 'Fuera de alcance'}, {'text': 'Panel de administración de la florería', 'bucket': 'Dentro del alcance'}, {'text': 'Servicio de correo del proveedor', 'bucket': 'Fuera de alcance'}],
   'explanation': 'Lo que es de la florería entra; lo que pertenece a terceros queda fuera con nombre propio.'},
  {'id': f'{L}-pa-c2', 'type': 'fill', 'objective': O3, 'bloom': 'aplicar', 'prompt': 'Completa la ventana a partir del enunciado.', 'template': 'Ventana: ___ de 06:00 a 10:00, del 8 al 29 de noviembre.', 'blanks': [{'accept': ['domingos', 'los domingos']}],
   'explanation': 'El enunciado dice domingos; una ventana sin el día exacto no sirve.'}],
}

exB = {
 'id': f'{L}-pb', 'tier': 'B', 'title': 'Adapta el acuerdo a una tienda con envíos',
 'statement': 'La tienda de ropa Moda Sur vende en una plataforma de comercio electrónico (el hosting lo pone la plataforma). Cobra con una pasarela externa y calcula envíos con la API de una empresa de mensajería. Su dueño, Iván Soto (+51 900 000 004), quiere que revises solo su tienda y el panel de administración, los miércoles de 22:00 a 02:00, durante tres semanas desde el 12 de noviembre. Redacta el acuerdo completo usando la plantilla. Aquí hay más terceros que en el ejemplo: piénsalo antes de escribir.',
 'decoded': {'youAreAsked': ['Identificar los tres terceros: plataforma, pasarela y mensajería', 'Escribir el alcance solo con lo que es de Moda Sur', 'Completar los siete apartados sin modelo previo'], 'terms': ['tercero', 'alcance', 'fuera-alcance', 'ventana', 'contacto-emergencia'], 'doNotNeed': ['Conocer la plataforma de comercio', 'Saber hacer las pruebas']},
 'produces': 'acuerdo-pruebas', 'aiPolicy': 'ia_tutor', 'objectives': [O2, O3],
 'scaffold': ROE_TEMPLATE,
 'steps': [
  {'id': 'intenta', 'title': 'Intenta', 'prompt': 'Escribe los siete apartados del acuerdo usando la plantilla en blanco.'},
  {'id': 'compara', 'title': 'Compara', 'prompt': 'Contrasta tu acuerdo con el modelo y con la lista de comprobación.'},
  {'id': 'corrige', 'title': 'Corrige', 'prompt': 'Arregla lo que falló y explica en una frase por qué.'}],
 'hints': [
  {'text': 'Haz una lista de todas las empresas que intervienen y marca cuáles son terceros.', 'taughtIn': P3},
  {'text': 'Si una pieza es de un tercero, solo hay dos caminos: queda fuera o necesitas su permiso.', 'taughtIn': P3},
  {'text': 'Revisa que la ventana tenga día, horas y fechas, y que el contacto tenga teléfono.', 'taughtIn': P2}],
 'exemplar': 'Alcance: tienda y panel de administración de Moda Sur. Fuera de alcance: servidores de la plataforma, pasarela de pagos y API de mensajería. Ventana: miércoles 22:00–02:00, del 12 de nov. al 26 de nov. Prohibido: saturar el servidor, engañar al personal, crear o cancelar pedidos reales. Contacto: Iván Soto, +51 900 000 004, 24 h. Datos: no se copian; evidencia con datos tapados. Informe: PDF cifrado, solo a Iván, en 10 días.',
 'exemplarNotes': ['Detecta los tres terceros y los deja fuera por escrito', 'La ventana incluye día, horas y fechas', 'El contacto y el informe tienen destinatario concreto'],
 'rubric': [
  {'criterion': 'Identifica los tres terceros y los deja fuera', 'objective': O2, 'levels': {'bien': 'Nombra plataforma, pasarela y mensajería como fuera de alcance', 'parcial': 'Detecta solo uno o dos', 'falta': 'Mete algún tercero en el alcance'}},
  {'criterion': 'Ventana y contacto precisos', 'objective': O3, 'levels': {'bien': 'Día, horas, fechas, nombre y teléfono', 'parcial': 'Falta un dato', 'falta': 'Son vagos o no están'}},
  {'criterion': 'Técnicas, datos e informe completos', 'objective': O3, 'levels': {'bien': 'Los tres apartados concretos', 'parcial': 'Uno es vago', 'falta': 'Faltan dos o más'}}],
 'commonErrors': ['Olvidar la API de mensajería como tercero', 'Escribir «cualquier día» en la ventana', 'Dejar el contacto sin teléfono'],
 'selfCheck': ['¿Aparecen los tres terceros como fuera de alcance?', '¿La ventana tiene fechas exactas?', '¿Podría entregar este acuerdo a un abogado sin vergüenza?'],
 'checks': [
  {'id': f'{L}-pb-c1', 'type': 'multi', 'objective': O2, 'bloom': 'aplicar', 'prompt': 'Marca TODAS las piezas que son de terceros en el caso de Moda Sur.',
   'options': [{'text': 'La plataforma de comercio donde está la tienda'}, {'text': 'El panel de administración de Moda Sur', 'whyNot': 'Es la gestión propia de la tienda: la autoriza Iván.'}, {'text': 'La pasarela de pagos'}, {'text': 'La API de la empresa de mensajería'}, {'text': 'Los pedidos de la propia tienda', 'whyNot': 'Son datos y funciones de la tienda de Iván.'}],
   'correctIndexes': [0, 2, 3], 'explanation': 'Plataforma, pasarela y mensajería son empresas distintas con servidores propios; panel y pedidos pertenecen a la tienda.'},
  {'id': f'{L}-pb-c2', 'type': 'mcq', 'objective': O3, 'bloom': 'aplicar', 'prompt': '¿Qué ventana está bien redactada?',
   'options': [{'text': 'Miércoles 22:00–02:00 (hora de Lima), del 12 al 26 de noviembre'}, {'text': 'Por las noches, cuando haya poco tráfico', 'whyNot': 'No fija días ni horas: cada parte puede interpretar una cosa.'}, {'text': 'Los miércoles, sin horario concreto', 'whyNot': 'Falta el horario y las fechas de inicio y fin.'}, {'text': 'Tres semanas desde el 12 de noviembre', 'whyNot': 'No dice qué días ni a qué horas de cada semana.'}],
   'correctIndex': 0, 'explanation': 'Una ventana válida concreta día, hora, zona horaria y fechas de inicio y fin.'}],
}

exC = {
 'id': f'{L}-pc', 'tier': 'C', 'title': 'Redacta las reglas de una prueba para un consultorio',
 'statement': 'La doctora Ruiz tiene una aplicación de reservas para su consultorio (`citas.consultorioruiz.com`) y te pide revisarla. El hosting es de un proveedor y los pagos van por una pasarela externa. Redacta en una página las reglas de la prueba: alcance incluido y excluido, ventana horaria, técnicas permitidas y prohibidas, contacto de emergencia, manejo de datos de pacientes y cómo entregarás el informe.',
 'decoded': {'youAreAsked': ['Decidir qué es de la doctora y qué es de terceros (hosting y pagos)', 'Escribir los siete apartados con datos concretos que tú elijas', 'Pensar en que hay datos de salud, que son especialmente delicados'], 'terms': ['alcance', 'fuera-alcance', 'ventana', 'tecnica-prohibida', 'contacto-emergencia', 'datos-personales', 'informe'], 'doNotNeed': ['Hacer ninguna prueba técnica', 'Más de una página']},
 'produces': 'acuerdo-pruebas', 'aiPolicy': 'ia_tutor', 'objectives': [O1, O2, O3, O4],
 'scaffold': ROE_TEMPLATE,
 'steps': [
  {'id': 'entender', 'title': 'Entender', 'prompt': 'Lee la lista «lo que te piden, traducido» y dibuja las piezas del sistema y quién es dueño de cada una.'},
  {'id': 'plan', 'title': 'Planificar', 'prompt': 'Decide qué entra, qué queda fuera y qué técnicas prohibirás, antes de redactar.'},
  {'id': 'construir', 'title': 'Construir', 'prompt': 'Escribe el acuerdo de una página con los siete apartados.'},
  {'id': 'verificar', 'title': 'Verificar', 'prompt': 'Pasa la lista de comprobación: ¿alguna frase admite dos lecturas?'},
  {'id': 'defender', 'title': 'Defender', 'prompt': 'Responde en 4-6 frases: ¿qué documentos necesitas antes de empezar una prueba de seguridad y por qué?'}],
 'hints': [
  {'text': 'Piensa en quién es dueño de cada pieza: la aplicación, el servidor y los pagos.', 'taughtIn': P3},
  {'text': 'Los datos de pacientes son especialmente delicados: ¿qué haces si ves uno durante la prueba?', 'taughtIn': P2},
  {'text': 'Incluye qué haces si encuentras un camino hacia un sistema que no está en la lista.', 'taughtIn': P4},
  {'text': 'Si dudas del formato, vuelve al ejemplo resuelto de la panadería y cámbialo pieza a pieza.', 'taughtIn': P3}],
 'exemplar': 'Alcance: citas.consultorioruiz.com y su API, con cuentas de prueba entregadas por la doctora. Fuera de alcance: servidores del proveedor de hosting y pasarela de pagos (otras empresas; solo con su firma). Ventana: sábados 08:00–14:00 (hora de Lima), del 7 al 28 de nov. Prohibido: saturar el servidor, engañar al personal, ver o cambiar citas reales fuera de las cuentas de prueba. Contacto: Dra. Ruiz, +51 900 000 000, 24 h. Datos: no se copian historiales; evidencia con datos tapados; todo se borra al terminar. Si un fallo lleva fuera del alcance: detenerse, documentar y avisar. Informe: PDF cifrado, solo a la doctora, en 10 días.',
 'exemplarNotes': ['Separa lo de la doctora de lo del proveedor y la pasarela, y los nombra', 'Trata los datos de pacientes con medidas concretas', 'Incluye qué hacer si algo sale del alcance, que es la parte que más se olvida'],
 'rubric': [
  {'criterion': 'Separa alcance y fuera de alcance nombrando la pasarela y el hosting', 'objective': O2, 'levels': {'bien': 'Ambos terceros fuera, con nombre', 'parcial': 'Solo uno queda fuera', 'falta': 'Mete terceros en el alcance'}},
  {'criterion': 'Prohíbe técnicas que puedan tumbar el servicio o afectar a personas', 'objective': O3, 'levels': {'bien': 'Saturación, ingeniería social y modificar datos reales', 'parcial': 'Solo una o dos', 'falta': 'Frases vagas o ninguna'}},
  {'criterion': 'Define qué hacer con los datos de pacientes', 'objective': O3, 'levels': {'bien': 'No copiar, tapar evidencia y borrar al terminar', 'parcial': 'Menciona los datos sin medidas', 'falta': 'No los menciona'}},
  {'criterion': 'Indica la acción ante un fallo que sale del alcance', 'objective': O4, 'levels': {'bien': 'Detenerse, documentar y avisar', 'parcial': 'Solo avisar', 'falta': 'No lo contempla'}},
  {'criterion': 'En la defensa, justifica por qué hace falta permiso firmado y de quién', 'objective': O1, 'levels': {'bien': 'Explica que sin permiso es delito aunque no robe y que firma el dueño', 'parcial': 'Dice que hace falta permiso sin justificarlo', 'falta': 'No responde o confunde permiso con confianza'}}],
 'commonErrors': ['Dar por hecho que la doctora puede autorizar pruebas sobre el servidor del proveedor', 'Olvidar el manejo de datos personales', 'No poner contacto de emergencia'],
 'selfCheck': ['¿Cada pieza del alcance es de la doctora?', '¿Está escrito qué pasa si algo sale del alcance?', '¿Hay teléfono, fechas y horas exactas?', '¿Cabe en una página?'],
 'interviewQuestion': '¿Qué documentos necesitas antes de empezar una prueba de penetración y por qué?',
 'harderVariant': 'Reescribe el acuerdo para una clínica con tres sedes, dos proveedores de hosting y un laboratorio externo que sube resultados.',
}

# ───────────────────────── Dominio, preparación y repaso ─────────────────────────
mastery = [
 mcq(f'{L}-m1', O1, 'comprender', 'Un amigo te pide que revises su tienda, alojada en una plataforma de comercio. Además de su permiso, ¿qué necesitas tener en cuenta?',
     [('Nada más: el dueño de la tienda ya autorizó y con eso basta para todo el sistema', 'Autoriza su tienda, no los servidores de la plataforma, que son de otra empresa.'),
      ('Que la plataforma es otra empresa con reglas propias', None),
      ('Usar una red anónima para que la plataforma no lo detecte durante la prueba', 'Ocultarte no vuelve legal la prueba.'),
      ('Probar desde la casa de tu amigo', 'El lugar desde el que pruebas no crea permiso.')], 1,
     'Tu amigo autoriza lo que es suyo. La infraestructura de la plataforma es de un tercero, que puede tener reglas o programas propios.'),
 multi(f'{L}-m2', O1, 'comprender', 'Marca TODAS las excusas que NO te protegen legalmente.',
       [('«Solo leí datos, no cambié nada»', None), ('«Lo hice de noche para no molestar»', None), ('«Tengo un acuerdo firmado por la dueña del sistema»', 'Ese sí es el permiso por escrito: protege, dentro de lo que dice.'), ('«Usé una VPN»', None), ('«Quería avisarles del fallo»', None)], [0, 1, 3, 4],
       'Leer, la hora, la VPN o la buena intención no sustituyen el permiso. Solo lo hace un acuerdo firmado por el dueño.'),
 {'id': f'{L}-m3', 'type': 'classify', 'objective': O2, 'bloom': 'aplicar', 'prompt': 'Una clínica te contrata para revisar su web. Clasifica cada pieza.',
  'buckets': ['Dentro del alcance', 'Fuera de alcance'],
  'cases': [{'text': 'La aplicación de citas de la clínica', 'bucket': 'Dentro del alcance'}, {'text': 'El panel de recepción de la clínica', 'bucket': 'Dentro del alcance'}, {'text': 'Los servidores del proveedor de hosting', 'bucket': 'Fuera de alcance'}, {'text': 'La pasarela que cobra las consultas', 'bucket': 'Fuera de alcance'}, {'text': 'El laboratorio externo que sube resultados', 'bucket': 'Fuera de alcance'}, {'text': 'El formulario de contacto de la clínica', 'bucket': 'Dentro del alcance'}],
  'explanation': 'Lo propio entra. Hosting, pagos y laboratorio son terceros, con servidores y dueños distintos.'},
 mcq(f'{L}-m4', O2, 'aplicar', 'Para probar el servidor del hosting que usa tu cliente, ¿quién debe firmar el permiso?',
     [('La empresa de hosting, dueña de esos servidores', None), ('Tu cliente, porque paga el servicio y lo usa todos los días', 'Pagar no da propiedad sobre los servidores del proveedor.'), ('Cualquiera de los dos, porque da igual quién firme el permiso', 'Solo el dueño puede autorizar; no es indiferente.'), ('Nadie: los servidores de otras empresas no se pueden probar nunca', 'Se pueden probar con la autorización de su dueño.')], 0,
     'Solo puede dar permiso quien es dueño. El hosting es del proveedor.'),
 {'id': f'{L}-m5', 'type': 'spot', 'objective': O2, 'bloom': 'analizar', 'prompt': 'Este borrador de acuerdo tiene dos líneas con errores graves. Marca esas dos líneas.',
  'artifact': 'Línea 1: PRUEBA DE SEGURIDAD · TIENDA LUNA\nLínea 2: Alcance: tienda.luna.example y su API\nLínea 3: Fuera de alcance: nada, se puede probar todo lo conectado\nLínea 4: Ventana: viernes 22:00–02:00, del 5 al 26 de nov.\nLínea 5: Prohibido: saturar el servidor, engañar al personal\nLínea 6: Contacto: Carla Luna, +51 900 000 005, 24 h\nLínea 7: Datos: se descargan las tablas para el informe',
  'correctLines': [3, 7], 'explanation': 'La línea 3 convierte en alcance todo lo conectado, incluidos los terceros. La línea 7 permite llevarse datos personales en lugar de usar evidencia mínima.'},
 {'id': f'{L}-m6', 'type': 'fill', 'objective': O3, 'bloom': 'aplicar', 'prompt': 'Completa el apartado de técnicas del acuerdo.', 'template': 'Prohibido: ___ el servidor y ___ al personal para obtener accesos.',
  'blanks': [{'accept': ['saturar', 'colapsar', 'tumbar']}, {'accept': ['engañar', 'manipular']}], 'explanation': 'Las dos técnicas clásicas que se vetan son la denegación de servicio (saturar) y la ingeniería social (engañar a personas).'},
 mcq(f'{L}-m7', O3, 'aplicar', '¿Cuál de estas frases del apartado «Ventana» está bien redactada?',
     [('Cuando el sistema esté tranquilo y haya pocos usuarios conectados', 'No fija día ni hora: cada parte entiende algo distinto.'), ('Durante noviembre, siempre que el equipo tenga tiempo libre', 'No concreta días ni horas, y «cuando haya tiempo» no es una condición.'), ('Los fines de semana, por la mañana, como se pueda', 'No dice horas ni fechas de inicio y fin.'), ('Sábados 08:00–14:00 (hora de Lima), del 7 al 28 de nov.', None)], 3,
     'Una ventana válida fija días, horas, zona horaria y fechas de inicio y fin.'),
 {'id': f'{L}-m8', 'type': 'order', 'objective': O4, 'bloom': 'aplicar', 'prompt': 'Encuentras, sin acuerdo alguno, un fallo en la web de una tienda. Ordena la divulgación responsable.',
  'steps': ['Dejas de probar y no lo compartes', 'Buscas su canal oficial (security.txt, correo o programa)', 'Reportas pasos, impacto y evidencia mínima', 'Das un plazo razonable antes de hablar en público'],
  'explanation': 'Primero paras, luego avisas por el canal oficial con evidencia mínima y por último das tiempo para arreglarlo.'},
 mcq(f'{L}-m9', O4, 'aplicar', 'En una prueba autorizada, un fallo te permite leer la ficha de un cliente real. ¿Qué haces?',
     [('Descargo toda la tabla de clientes para demostrar lo grave que es', 'Te llevarías datos personales reales sin necesidad.'), ('Sigo explorando otras tablas para ver hasta dónde llego', 'Te sales del permiso y aumentas el riesgo.'), ('Captura con datos tapados, paro y lo reporto', None), ('Lo publico en redes para presionar a que lo arreglen', 'Avisas también a los atacantes antes de que se arregle.')], 2,
     'Se demuestra el riesgo con el mínimo daño: una evidencia y parar.'),
 mcq(f'{L}-m10', O4, 'aplicar', 'Terminó la ventana acordada y te queda una prueba pendiente. ¿Qué haces?',
     [('Pido una ampliación por escrito', None), ('La hago igual, porque el cliente quería que se probara todo el sistema', 'La intención del cliente no sustituye una ampliación firmada.'), ('La hago de madrugada para que nadie lo note en el sistema', 'Fuera de la ventana no hay permiso, y ocultarlo lo empeora.'), ('La dejo sin comentar al cliente y entrego el informe', 'El cliente debe saber qué quedó sin revisar.')], 0,
     'El permiso tiene ventana: fuera de ella vuelves a no estar autorizado. Se amplía por escrito.'),
]

readiness = [
 mcq(f'{L}-r1', O1, 'recordar', '¿Dónde está guardada una página web para que cualquiera pueda abrirla?',
     [('En cada computadora que la visita', 'Cada visitante solo la ve; no la guarda para los demás.'), ('En un servidor: una computadora siempre encendida y conectada a internet', None), ('En el teléfono de quien la creó', 'Si fuera así, la página caería al apagar el teléfono.'), ('En el cable de internet de la casa', 'El cable solo transporta datos; no guarda nada.')], 1,
     'Una web vive en un servidor, una computadora que está siempre encendida y conectada.'),
 mcq(f'{L}-r2', O2, 'recordar', 'En la dirección `citas.ejemplo.com`, ¿qué es `citas.ejemplo.com`?',
     [('El nombre con el que se encuentra la página en internet', None), ('La contraseña de la página', 'Una contraseña es secreta; una dirección es pública.'), ('El nombre del programador', 'No identifica a una persona, sino a un sitio.'), ('El número de visitantes', 'Una dirección no cuenta visitantes.')], 0,
     'Es el nombre (dominio) con el que se llega a la página.'),
 mcq(f'{L}-r3', O1, 'comprender', 'En la dirección `/facturas/1043`, el número `1043` suele ser…',
     [('Un identificador que señala una factura concreta', None), ('La hora a la que se emitió la factura', 'Una hora no tendría ese formato de identificador.'), ('La cantidad de dinero de la factura', 'El importe va dentro de la factura, no en la dirección.'), ('Una contraseña temporal', 'Una contraseña nunca va visible en la dirección.')], 0,
     'Suele ser el número de identificación de un registro en la base de datos.'),
]
remedial = [{'refresher': 'Una página web vive en un servidor: una computadora siempre encendida y conectada a internet. Su nombre público (por ejemplo citas.ejemplo.com) se llama dominio. En una dirección como /facturas/1043, el número suele identificar un registro concreto (esa factura) guardado en una base de datos. Con eso es suficiente para esta clase: no hace falta saber programar.'}]

review = [
 mcq(f'{L}-v1', O1, 'comprender', '¿Qué distingue a un hacker ético de un atacante?',
     [('Las herramientas que usa', 'Usan técnicas parecidas; no es la diferencia.'), ('El permiso del dueño del sistema', None), ('Que sea más experto', 'La experiencia no define la ética.'), ('Que solo mire y no toque nada', 'Mirar sin permiso sigue siendo acceso no autorizado.')], 1,
     'Las técnicas son las mismas: lo que cambia es la autorización del dueño.'),
 {'id': f'{L}-v2', 'type': 'fill', 'objective': O3, 'bloom': 'comprender', 'prompt': 'Completa con el término correcto.', 'template': 'La ___ de pruebas fija los días y las horas en que sí se puede probar.', 'blanks': [{'accept': ['ventana']}],
  'explanation': 'La ventana limita el cuándo; fuera de ella no hay permiso.'},
 mcq(f'{L}-v3', O4, 'comprender', '¿Qué es la divulgación responsable?',
     [('Publicar el fallo para que la empresa reaccione', 'Eso avisa también a los atacantes antes de la corrección.'), ('Avisar en privado a quien puede arreglarlo y darle tiempo antes de hablar en público', None), ('Cobrar por contar el fallo', 'Pedir dinero puede interpretarse como extorsión.'), ('Probar más para estar seguro antes de avisar', 'Seguir probando sin permiso es el error que se evita.')], 1,
     'Es avisar en privado, dar un plazo y no hablar en público antes.'),
]


lesson = {
 'id': L, 'title': 'Ética, permiso y alcance', 'minutes': 45,
 'objectives': [
  {'id': O1, 'bloom': 'comprender', 'text': 'Podrás explicar por qué probar un sistema sin permiso es delito aunque no robes nada, y qué lo vuelve legal.'},
  {'id': O2, 'bloom': 'aplicar', 'text': 'Podrás decidir de quién es cada pieza de un sistema y qué entra y qué queda fuera del alcance.'},
  {'id': O3, 'bloom': 'crear', 'text': 'Podrás redactar un acuerdo de pruebas de una página con sus siete apartados y sin frases ambiguas.'},
  {'id': O4, 'bloom': 'aplicar', 'text': 'Podrás decidir qué hacer ante un hallazgo que sale del alcance o que aparece sin buscarlo.'}],
 'requires': [],
 'teaches': [g['id'] for g in glossary],
 'modelsArtifacts': ['acuerdo-pruebas'],
 'realCase': realCase,
 'readiness': readiness, 'remedial': remedial,
 'hook': hook, 'parts': [p for p, _ in PARTS],
 'practice': [exA, exB, exC],
 'mastery': {'items': mastery, 'passPct': 80},
 'wrapup': {
  'keyIdeas': ['El permiso por escrito separa a un hacker ético de un delincuente.', 'Un buen acuerdo tiene siete piezas y ninguna frase ambigua.', 'Solo el dueño de cada pieza puede autorizar su prueba.', 'Si algo sale del plan: detente, documenta, avisa.', 'Demuestra el riesgo con la evidencia mínima.'],
  'cheatSheet': '**Las 7 piezas del acuerdo**\n\n1. Alcance (qué sí, con nombres)\n2. Fuera de alcance (qué no, con nombres)\n3. Ventana (días, horas, zona horaria)\n4. Técnicas prohibidas (concretas)\n5. Contacto de emergencia (nombre, teléfono, 24 h)\n6. Datos (qué haces con lo que veas)\n7. Informe (formato, a quién, plazo)\n\n**Si algo sale del plan**: detente → documenta → avisa.\n\n**Prueba de la frase**: si alguien ajeno puede leerla de dos maneras, reescríbela.',
  'commonMistakes': [
   {'mistake': 'Meter el hosting o la pasarela en el alcance', 'fix': 'Pregunta de quién es cada pieza y deja fuera lo de terceros, con su nombre'},
   {'mistake': 'Seguir probando «un poco más» tras un hallazgo fuera de plan', 'fix': 'Detente, documenta cómo llegaste y avisa al cliente'},
   {'mistake': 'Llevarte tablas completas para demostrar el fallo', 'fix': 'Usa evidencia mínima: un registro con datos tapados y los pasos'}],
  'nextLesson': 'sec-l15'},
 'review': review,
 'resources': [
  {'kind': 'doc', 'title': 'OWASP: Vulnerability Disclosure Cheat Sheet', 'url': 'https://cheatsheetseries.owasp.org/cheatsheets/Vulnerability_Disclosure_Cheat_Sheet.html'},
  {'kind': 'doc', 'title': 'OWASP Web Security Testing Guide', 'url': 'https://owasp.org/www-project-web-security-testing-guide/'}],
 'verify': ['Las leyes de delitos informáticos varían por país: la clase lo dice y remite a la ley local; no se cita ninguna norma concreta.', 'El plazo de 90 días de divulgación es la práctica habitual, no una obligación legal.', 'Los detalles del caso de Iowa vienen de prensa especializada y difieren en cifras de fianza: la clase no las usa.', 'El importe de 600.000 dólares viene de SC Media, que fecha el inicio del caso en 2015 por error evidente (fue 2019); la clase usa 2019.'],
}

for part, micro in PARTS:
    titles = {s['title'] for s in part['scenes']}
    for t in micro:
        assert t in titles, f'micro sin escena: {t}'
    for sc in part['scenes']:
        if sc['title'] in micro:
            sc['micro'] = micro[sc['title']]

sample = {'schema': 2, 'kind': 'lesson-sample', 'courseId': 'seguridad-web', 'glossary': glossary, 'lesson': lesson}
out = sys.argv[1] if len(sys.argv) > 1 else 'muestra-oro-sec-l1.v2.json'
json.dump(sample, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', out)
