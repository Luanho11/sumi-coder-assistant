/** Los errores de ipcRenderer.invoke llegan como "Error invoking remote method 'x': Error: mensaje". */
export function cleanIpcError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
