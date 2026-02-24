import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // File dialogs
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  scanFolder: (path: string) => ipcRenderer.invoke('folder:scan', path),
  getMetadata: (path: string) => ipcRenderer.invoke('audio:metadata', path),

  // YouTube
  youtubeDownload: (url: string, outputDir: string) =>
    ipcRenderer.invoke('youtube:download', { url, outputDir }),
  youtubeInfo: (url: string) => ipcRenderer.invoke('youtube:info', url),
  onYoutubeProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('youtube:progress', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('youtube:progress')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
