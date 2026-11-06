import type { Area, Difficulty, QuizQuestion } from './types'

type Raw = [Difficulty, string, string[], number, string]

// Banco propio del examen de nivel. Las opciones se escriben con la correcta donde resulte cómodo y
// luego se rotan según el id, para que su posición no siga un patrón.
const RAW: Record<Area, Raw[]> = {
  fundamentos: [
    [
      'principiante',
      '¿Qué devuelve `[1, 2, 3].map(x => x * 2)` en JavaScript?',
      ['6', '[2, 4, 6]', '[1, 2, 3]', 'undefined'],
      1,
      'map crea un array nuevo aplicando la función a cada elemento.'
    ],
    [
      'principiante',
      '¿Qué diferencia hay entre `let` y `const`?',
      ['Ninguna', '`const` no permite reasignar la variable', '`let` es global', '`const` hace el objeto inmutable'],
      1,
      'const impide reasignar la referencia, pero un objeto const se puede modificar por dentro.'
    ],
    [
      'intermedio',
      '¿Cuál es la complejidad de buscar un elemento en un array no ordenado?',
      ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
      2,
      'Hay que recorrerlo en el peor caso.'
    ],
    [
      'intermedio',
      '¿Qué imprime `console.log(0.1 + 0.2 === 0.3)`?',
      ['true', 'false', 'Error', 'NaN'],
      1,
      'Los números de coma flotante binaria no representan 0,1 exactamente.'
    ],
    [
      'avanzado',
      'En Node.js, ¿qué se ejecuta antes: un `Promise.then` o un `setTimeout(fn, 0)` programados a la vez?',
      ['setTimeout', 'Promise.then', 'Depende del sistema operativo', 'Se ejecutan en paralelo'],
      1,
      'Las microtareas (promesas) se vacían antes de pasar a la siguiente fase de temporizadores.'
    ],
    [
      'avanzado',
      'Necesitas comprobar muchas veces si un id está en una lista de 1 millón. ¿Qué estructura usas?',
      ['Array con includes', 'Set', 'Lista enlazada', 'Array ordenado con indexOf'],
      1,
      'Set ofrece búsquedas en tiempo constante medio.'
    ]
  ],
  frontend: [
    [
      'principiante',
      '¿Qué etiqueta HTML es la más adecuada para el menú de navegación principal?',
      ['<div>', '<nav>', '<section>', '<menu-bar>'],
      1,
      'nav es semántica y ayuda a la accesibilidad.'
    ],
    [
      'principiante',
      'En React, ¿qué provoca que un componente se vuelva a renderizar?',
      ['Cambiar una variable local', 'Cambiar su estado o sus props', 'Llamar a console.log', 'Nada, se renderiza una vez'],
      1,
      'React vuelve a renderizar cuando cambian el estado o las props.'
    ],
    [
      'intermedio',
      '¿Para qué sirve la prop `key` al renderizar listas en React?',
      ['Para estilos', 'Para que React identifique cada elemento entre renders', 'Para ordenar la lista', 'Es obligatoria solo en TypeScript'],
      1,
      'Una key estable evita reutilizar el estado del elemento equivocado.'
    ],
    [
      'intermedio',
      'Un `useEffect` que hace fetch tiene el array de dependencias vacío pero usa la prop `id`. ¿Qué pasa si `id` cambia?',
      ['Se vuelve a ejecutar', 'No se vuelve a ejecutar y muestra datos antiguos', 'React lanza un error', 'Se ejecuta dos veces'],
      1,
      'Con [] solo se ejecuta al montar.'
    ],
    [
      'avanzado',
      '¿Qué métrica de Core Web Vitals mide la respuesta a la interacción del usuario?',
      ['LCP', 'CLS', 'INP', 'TTFB'],
      2,
      'INP (Interaction to Next Paint) sustituyó a FID.'
    ],
    [
      'avanzado',
      'Al cambiar rápidamente de usuario seleccionado, a veces se muestra el perfil anterior. ¿Causa más probable?',
      ['Falta de memo', 'Condición de carrera entre peticiones sin cancelar', 'CSS', 'Falta de key en el componente raíz'],
      1,
      'Una respuesta antigua llega después de la nueva y la sobrescribe.'
    ]
  ],
  backend: [
    ['principiante', '¿Qué código HTTP indica que un recurso se creó correctamente?', ['200', '201', '204', '302'], 1, '201 Created.'],
    [
      'principiante',
      '¿Qué método HTTP se usa normalmente para obtener datos sin modificarlos?',
      ['POST', 'GET', 'DELETE', 'PATCH'],
      1,
      'GET debe ser seguro e idempotente.'
    ],
    [
      'intermedio',
      '¿Qué significa que una operación sea idempotente?',
      ['Que es rápida', 'Que repetirla tiene el mismo efecto que hacerla una vez', 'Que no usa base de datos', 'Que requiere autenticación'],
      1,
      'PUT y DELETE deberían ser idempotentes.'
    ],
    [
      'intermedio',
      'Diferencia entre 401 y 403:',
      ['Son iguales', '401: no autenticado; 403: autenticado sin permiso', '401: sin permiso; 403: no encontrado', '403 es un error del servidor'],
      1,
      '401 pide credenciales; 403 las tiene pero no basta.'
    ],
    [
      'avanzado',
      'Un endpoint de pagos recibe reintentos del cliente por timeouts y cobra dos veces. ¿Mejor solución?',
      ['Aumentar el timeout', 'Clave de idempotencia por operación', 'Pedir al usuario que no pulse dos veces', 'Usar GET'],
      1,
      'La clave de idempotencia permite detectar y devolver el resultado del primer intento.'
    ],
    [
      'avanzado',
      'Una tarea pesada bloquea el event loop de Node y la API deja de responder. ¿Qué haces?',
      ['Más memoria', 'Moverla a un worker thread o a una cola de trabajos', 'Usar async en la función', 'Reiniciar el servidor cada hora'],
      1,
      'async no evita el bloqueo de CPU; hay que sacarla del hilo principal.'
    ]
  ],
  datos: [
    [
      'principiante',
      '¿Qué cláusula SQL filtra filas antes de agrupar?',
      ['HAVING', 'WHERE', 'ORDER BY', 'GROUP BY'],
      1,
      'WHERE filtra filas; HAVING filtra grupos.'
    ],
    [
      'principiante',
      '¿Qué hace un INNER JOIN?',
      [
        'Devuelve todas las filas de ambas tablas',
        'Devuelve solo las filas con coincidencia en ambas tablas',
        'Borra duplicados',
        'Une columnas sin condición'
      ],
      1,
      'Solo combina filas que cumplen la condición.'
    ],
    [
      'intermedio',
      'Una consulta filtra por `email` en una tabla de 10 millones de filas y es lenta. ¿Primera medida?',
      ['Más RAM', 'Revisar el plan de ejecución y crear un índice en email', 'Cambiar de base de datos', 'Usar SELECT *'],
      1,
      'EXPLAIN muestra si hay un recorrido completo de la tabla.'
    ],
    [
      'intermedio',
      '¿Qué problema evita una transacción?',
      ['Consultas lentas', 'Que una operación de varios pasos quede a medias', 'La inyección SQL', 'Los índices duplicados'],
      1,
      'Atomicidad: todo o nada.'
    ],
    [
      'avanzado',
      'Obtienes 100 pedidos y luego haces una consulta por pedido para sus líneas. ¿Cómo se llama y cómo se arregla?',
      ['Deadlock; con bloqueos', 'Problema N+1; con JOIN o una consulta con IN', 'Desnormalización; con vistas', 'Sharding; con réplicas'],
      1,
      'N+1 multiplica las idas y vueltas a la base de datos.'
    ],
    [
      'avanzado',
      '¿Para qué sirve una CTE recursiva?',
      ['Para crear índices', 'Para recorrer jerarquías como árboles de categorías', 'Para cifrar columnas', 'Para hacer copias de seguridad'],
      1,
      'WITH RECURSIVE recorre estructuras jerárquicas.'
    ]
  ],
  calidad: [
    [
      'principiante',
      '¿Qué prueba comprueba una función aislada del resto del sistema?',
      ['End-to-end', 'Unitaria', 'De carga', 'Manual exploratoria'],
      1,
      'Las pruebas unitarias aíslan una unidad.'
    ],
    [
      'principiante',
      '¿Qué es un caso límite?',
      ['Un caso muy frecuente', 'Un valor en el borde del rango válido o fuera de él', 'Un caso imposible', 'Una prueba lenta'],
      1,
      'Ejemplos: vacío, cero, máximo.'
    ],
    [
      'intermedio',
      'Tienes 95 % de cobertura y aun así hay bugs en producción. ¿Explicación más probable?',
      [
        'La herramienta de cobertura falla',
        'Las pruebas ejecutan el código pero no comprueban bien los resultados',
        'Faltan pruebas manuales',
        'El 5 % restante es la causa siempre'
      ],
      1,
      'Cobertura mide ejecución, no verificación.'
    ],
    [
      'intermedio',
      '¿Cuándo es mejor una prueba end-to-end que una unitaria?',
      ['Siempre', 'Para validar un flujo crítico completo del usuario', 'Para lógica matemática', 'Nunca'],
      1,
      'La pirámide: muchas unitarias, pocas E2E en flujos críticos.'
    ],
    [
      'avanzado',
      '¿Qué mide el mutation testing?',
      ['La velocidad', 'Si las pruebas fallan cuando se introducen cambios en el código', 'La cobertura de ramas', 'La seguridad'],
      1,
      'Un mutante que sobrevive revela una prueba débil.'
    ],
    [
      'avanzado',
      'Una prueba falla 1 de cada 20 ejecuciones en CI. ¿Mejor enfoque?',
      ['Reintentarla automáticamente siempre', 'Investigar la causa (tiempos, orden, estado compartido) y arreglarla', 'Borrarla', 'Ignorarla en CI'],
      1,
      'Las pruebas inestables ocultan fallos reales.'
    ]
  ],
  seguridad: [
    [
      'principiante',
      '¿Dónde no deberías guardar nunca una clave API?',
      ['En un gestor de secretos', 'En el código subido a un repositorio', 'En variables de entorno del servidor', 'En un almacén cifrado'],
      1,
      'Los repositorios se clonan y filtran.'
    ],
    [
      'principiante',
      '¿Qué ataque se evita usando consultas parametrizadas?',
      ['XSS', 'Inyección SQL', 'DDoS', 'Phishing'],
      1,
      'Los parámetros nunca se interpretan como SQL.'
    ],
    [
      'intermedio',
      'Mostrar en una página HTML un comentario de usuario sin escapar permite...',
      ['Inyección SQL', 'XSS', 'CSRF', 'Nada'],
      1,
      'El navegador ejecutaría el script inyectado.'
    ],
    [
      'intermedio',
      '¿Qué es un IDOR?',
      ['Un tipo de cifrado', 'Acceder a recursos de otros cambiando un identificador en la petición', 'Un error de red', 'Un ataque al DNS'],
      1,
      'Falla la autorización a nivel de objeto.'
    ],
    [
      'avanzado',
      'Un agente de IA lee correos y puede enviar emails. Un correo contiene instrucciones ocultas. ¿Riesgo?',
      ['Ninguno si el modelo es bueno', 'Inyección de prompt indirecta con exfiltración de datos', 'Solo spam', 'Sobrecoste'],
      1,
      'El contenido externo puede actuar como instrucciones.'
    ],
    [
      'avanzado',
      '¿Cómo guardas contraseñas de usuarios?',
      ['Cifradas con AES', 'Con un hash lento y sal (bcrypt, scrypt o Argon2)', 'En texto plano en una tabla protegida', 'Con MD5'],
      1,
      'Un hash lento con sal resiste ataques de diccionario.'
    ]
  ],
  devops: [
    [
      'principiante',
      '¿Qué hace `git commit`?',
      ['Sube cambios al servidor', 'Guarda un punto en el historial local con los cambios preparados', 'Descarga cambios', 'Crea una rama'],
      1,
      'push es lo que sube al remoto.'
    ],
    [
      'principiante',
      '¿Para qué sirve una rama en Git?',
      ['Para borrar código', 'Para trabajar en cambios aislados sin afectar a la principal', 'Para comprimir el repositorio', 'Para dar permisos'],
      1,
      ''
    ],
    [
      'intermedio',
      '¿Qué aporta la integración continua (CI)?',
      [
        'Despliega siempre en producción',
        'Ejecuta compilación y pruebas automáticamente en cada cambio',
        'Sustituye la revisión de código',
        'Hace copias de seguridad'
      ],
      1,
      ''
    ],
    [
      'intermedio',
      'Has subido por error un archivo con una contraseña a GitHub. ¿Qué es lo primero?',
      ['Borrar el archivo en un nuevo commit', 'Revocar o rotar la credencial', 'Hacer el repositorio privado', 'Nada si nadie lo vio'],
      1,
      'El historial ya la contiene; la credencial debe invalidarse.'
    ],
    [
      'avanzado',
      '¿Qué es un despliegue canary?',
      [
        'Desplegar de noche',
        'Enviar el cambio a un pequeño porcentaje de usuarios y ampliar si las métricas van bien',
        'Desplegar sin pruebas',
        'Usar dos bases de datos'
      ],
      1,
      ''
    ],
    [
      'avanzado',
      '¿Qué diferencia hay entre métricas, logs y trazas?',
      [
        'Ninguna',
        'Métricas: números agregados; logs: eventos; trazas: recorrido de una petición entre servicios',
        'Las trazas son logs más largos',
        'Las métricas solo sirven en desarrollo'
      ],
      1,
      'Son los tres pilares de la observabilidad.'
    ]
  ],
  ia: [
    [
      'principiante',
      'Un LLM te da una función que usa un método que no existe en la librería. ¿Cómo se llama?',
      ['Overfitting', 'Alucinación', 'Sesgo', 'Latencia'],
      1,
      'El modelo genera algo plausible pero falso.'
    ],
    [
      'principiante',
      '¿Qué mejora más una respuesta de un asistente de código?',
      [
        'Escribir en mayúsculas',
        'Dar contexto concreto: objetivo, código relevante, restricciones y cómo verificar',
        'Pedir que sea muy inteligente',
        'Escribir el prompt más largo posible'
      ],
      1,
      ''
    ],
    [
      'intermedio',
      '¿Qué es RAG?',
      ['Un tipo de GPU', 'Recuperar documentos relevantes y dárselos al modelo como contexto para responder', 'Reentrenar el modelo', 'Una librería de React'],
      1,
      'Retrieval-Augmented Generation.'
    ],
    [
      'intermedio',
      '¿Qué es un "eval" en una aplicación con LLM?',
      [
        'Un benchmark público',
        'Un conjunto de casos con criterios para medir la calidad del sistema y detectar regresiones',
        'La función eval de JavaScript',
        'Una métrica de coste'
      ],
      1,
      ''
    ],
    [
      'avanzado',
      '¿Qué es MCP (Model Context Protocol)?',
      [
        'Un modelo de Google',
        'Un protocolo abierto para conectar asistentes de IA con herramientas y datos externos',
        'Un formato de imagen',
        'Una técnica de entrenamiento'
      ],
      1,
      ''
    ],
    [
      'avanzado',
      'Para bajar el coste de una feature con LLM sin perder calidad, ¿qué es más razonable primero?',
      [
        'Usar siempre el modelo más barato',
        'Medir con evals y aplicar caché, recorte de contexto o un modelo menor donde las evals lo permitan',
        'Quitar las pruebas',
        'Subir la temperatura'
      ],
      1,
      'Sin evals no sabes si el ahorro rompe la calidad.'
    ]
  ],
  analisis: [
    [
      'principiante',
      '¿Qué describe un requisito funcional?',
      ['Cuánto tarda el sistema', 'Qué debe hacer el sistema', 'El lenguaje de programación', 'El coste del proyecto'],
      1,
      'Los no funcionales describen cómo (rendimiento, seguridad...).'
    ],
    [
      'principiante',
      '¿Qué es una historia de usuario?',
      ['Un manual', 'Una necesidad expresada desde el punto de vista del usuario con su objetivo', 'Un diagrama de base de datos', 'Un informe de bugs'],
      1,
      'Como [rol], quiero [acción], para [beneficio].'
    ],
    [
      'intermedio',
      '¿Qué hace bueno a un criterio de aceptación?',
      ['Que sea largo', 'Que sea verificable sin ambigüedad', 'Que lo escriba el desarrollador', 'Que use lenguaje técnico'],
      1,
      'Formato Dado/Cuando/Entonces ayuda.'
    ],
    ['intermedio', '¿Qué diagrama UML muestra la interacción entre objetos en el tiempo?', ['Clases', 'Secuencia', 'Casos de uso', 'Despliegue'], 1, ''],
    [
      'avanzado',
      'Producto pide "que la app sea rápida". ¿Qué haces?',
      ['Aceptarlo', 'Convertirlo en requisitos medibles (p. ej. p95 < 300 ms en la búsqueda con 500 usuarios)', 'Rechazarlo', 'Pedir más servidores'],
      1,
      ''
    ],
    [
      'avanzado',
      'Dos áreas piden requisitos contradictorios. ¿Mejor enfoque?',
      [
        'Implementar ambos',
        'Hacer visible el conflicto con datos, opciones y trade-offs, y que decida quien tiene la responsabilidad',
        'Elegir el del jefe más alto',
        'Ignorar ambos'
      ],
      1,
      ''
    ]
  ]
}

export const PLACEMENT_BANK: QuizQuestion[] = Object.entries(RAW).flatMap(([area, rows]) =>
  rows.map(([difficulty, question, options, correctIndex, explanation], i) => {
    const shift = (i * 7 + area.length) % options.length
    return {
      id: `nivel-${area}-${i + 1}`,
      area: area as Area,
      difficulty,
      question,
      options: [...options.slice(shift), ...options.slice(0, shift)],
      correctIndex: (correctIndex - shift + options.length) % options.length,
      ...(explanation ? { explanation } : {})
    }
  })
)

/** Preguntas abiertas de la parte práctica: las corrige el modelo con una rúbrica. */
export const PRACTICAL_TASKS = [
  {
    id: 'practica-1',
    title: 'Encuentra y corrige el bug',
    prompt: `Esta función debería devolver el promedio de las notas aprobadas (>= 5). Explica qué falla y escribe la versión corregida.

\`\`\`js
function promedioAprobados(notas) {
  let suma = 0
  for (let i = 0; i <= notas.length; i++) {
    if (notas[i] > 5) suma += notas[i]
  }
  return suma / notas.length
}
\`\`\``,
    rubric: [
      'Detecta el índice fuera de rango (<=)',
      'Detecta que 5 debe contar (>=)',
      'Divide por el número de aprobados, no por el total',
      'Trata el caso sin aprobados o array vacío'
    ]
  },
  {
    id: 'practica-2',
    title: 'Diseña un endpoint',
    prompt:
      'Diseña el endpoint para que un usuario autenticado busque en SUS facturas por texto y fecha, con paginación. Indica método, ruta, parámetros, respuesta, códigos de error y qué cuidarías en seguridad y rendimiento.',
    rubric: [
      'Método y ruta coherentes (GET con query)',
      'Paginación definida',
      'Autorización a partir de la sesión (no de un id del cliente)',
      'Validación de parámetros y códigos de error correctos',
      'Rendimiento: índices o límites'
    ]
  },
  {
    id: 'practica-3',
    title: 'Revisa una respuesta de IA',
    prompt:
      'Una IA te propone guardar el token de sesión en localStorage "porque es lo más sencillo y seguro". ¿Estás de acuerdo? Justifica y propone una alternativa.',
    rubric: [
      'Explica el riesgo de XSS con localStorage',
      'Propone cookies HttpOnly, Secure y SameSite',
      'Menciona CSRF al usar cookies y su mitigación',
      'No acepta la afirmación de la IA sin comprobarla'
    ]
  }
]
