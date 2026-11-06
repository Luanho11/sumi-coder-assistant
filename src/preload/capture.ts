import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('captura', {
  alRecibirImagen: (cb: (dataUrl: string) => void) => {
    ipcRenderer.once('capture:image', (_e: IpcRendererEvent, dataUrl: string) => cb(dataUrl))
  },
  terminar: (region: { x: number; y: number; w: number; h: number } | null) => ipcRenderer.send('capture:done', region)
})
