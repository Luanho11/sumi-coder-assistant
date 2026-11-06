// Rutas que ya se pueden estudiar de principio a fin, en el orden en que se ofrecen. Las demás salen «En construcción».
export const RUTAS_ACTIVAS = ['seguridad-web', 'javascript', 'prompt-engineering', 'oficio', 'datos-sql', 'qa-testing', 'ingenieria-ia']

export const rutaActiva = (id: string) => RUTAS_ACTIVAS.includes(id)
