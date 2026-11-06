import { BrowserWindow, desktopCapturer, ipcMain, screen, type NativeImage } from 'electron'
import path from 'node:path'
import { signatureFromBgra } from '../core/observer'
import type { ImageAttachment } from '../core/types'

export async function captureScreen(): Promise<NativeImage> {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.size
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * display.scaleFactor), height: Math.round(height * display.scaleFactor) }
  })
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source || source.thumbnail.isEmpty()) throw new Error('No se pudo capturar la pantalla. Revisa los permisos de captura del sistema.')
  return source.thumbnail
}

/** JPEG reducido: suficiente para leer código y gasta muchos menos tokens que la captura original. */
export function toAttachment(img: NativeImage, maxWidth = 1600): ImageAttachment {
  const resized = img.getSize().width > maxWidth ? img.resize({ width: maxWidth, quality: 'good' }) : img
  return { mimeType: 'image/jpeg', data: resized.toJPEG(80).toString('base64') }
}

export function screenSignature(img: NativeImage): number[] {
  return signatureFromBgra(img.resize({ width: 32, height: 18 }).toBitmap())
}

interface Region {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Muestra la captura a pantalla completa para que el usuario recorte una zona.
 * Devuelve la zona recortada o null si cancela. La región llega en fracciones (0-1) del tamaño de la imagen.
 */
export function selectRegion(img: NativeImage, rendererUrl: string | undefined): Promise<NativeImage | null> {
  const { bounds } = screen.getPrimaryDisplay()
  const overlay = new BrowserWindow({
    ...bounds,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/capture.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: NativeImage | null) => {
      if (settled) return
      settled = true
      ipcMain.removeListener('capture:done', onDone)
      if (!overlay.isDestroyed()) overlay.close()
      resolve(result)
    }
    const onDone = (e: Electron.IpcMainEvent, region: Region | null) => {
      if (e.sender !== overlay.webContents) return
      if (!region || !(region.w > 0 && region.h > 0)) return finish(null)
      const size = img.getSize()
      const rect = {
        x: Math.max(0, Math.round(region.x * size.width)),
        y: Math.max(0, Math.round(region.y * size.height)),
        width: Math.min(size.width, Math.round(region.w * size.width)),
        height: Math.min(size.height, Math.round(region.h * size.height))
      }
      if (rect.width < 4 || rect.height < 4) return finish(null)
      finish(img.crop(rect))
    }
    ipcMain.on('capture:done', onDone)
    overlay.on('closed', () => finish(null))
    overlay.webContents.once('did-finish-load', () => {
      overlay.webContents.send('capture:image', img.toDataURL())
      overlay.show()
      overlay.focus()
    })
    if (rendererUrl) void overlay.loadURL(`${rendererUrl}/capture.html`)
    else void overlay.loadFile(path.join(__dirname, '../renderer/capture.html'))
  })
}
