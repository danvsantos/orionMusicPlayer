import { ipcMain, dialog } from 'electron'
import { readdir } from 'fs/promises'
import { join, extname, basename } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { parseFile } from 'music-metadata'

const execAsync = promisify(exec)

const SUPPORTED_FORMATS = ['.mp3', '.aac', '.m4a', '.flac', '.wav', '.ogg', '.opus', '.wma', '.webm']

export interface AudioTrack {
  id: string
  path: string
  filename: string
  title: string
  artist: string
  album: string
  duration: number
  coverArt?: string
  format: string
}

export function registerIpcHandlers(): void {
  // Open folder dialog
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Music Folder'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // Open file dialog
  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Select Audio Files',
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'aac', 'm4a', 'flac', 'wav', 'ogg', 'opus', 'webm'] }
      ]
    })
    if (result.canceled) return []
    return result.filePaths
  })

  // Scan folder for audio files
  ipcMain.handle('folder:scan', async (_, folderPath: string) => {
    try {
      const files = await readdir(folderPath)
      const audioFiles = files
        .filter(f => SUPPORTED_FORMATS.includes(extname(f).toLowerCase()))
        .map(f => join(folderPath, f))
      return audioFiles
    } catch (err) {
      console.error('Error scanning folder:', err)
      return []
    }
  })

  // System volume: get (returns 0–1) or null if unsupported
  ipcMain.handle('volume:getSystem', async () => {
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync('osascript -e "output volume of (get volume settings)"')
        return parseInt(stdout.trim(), 10) / 100
      } else if (process.platform === 'linux') {
        const { stdout } = await execAsync(
          "pactl get-sink-volume @DEFAULT_SINK@ | awk '/Volume:/ {gsub(/%/,\"\"); print $5; exit}'"
        )
        return parseInt(stdout.trim(), 10) / 100
      }
      // Windows: system volume sync not implemented; app uses internal gain node
    } catch {}
    return null
  })

  // System volume: set (0–1)
  ipcMain.handle('volume:setSystem', async (_, volume: number) => {
    const vol = Math.round(Math.max(0, Math.min(1, volume)) * 100)
    try {
      if (process.platform === 'darwin') {
        await execAsync(`osascript -e "set volume output volume ${vol}"`)
      } else if (process.platform === 'linux') {
        await execAsync(`pactl set-sink-volume @DEFAULT_SINK@ ${vol}%`)
      }
      // Windows: system volume sync not supported; app uses internal gain node
    } catch {}
  })

  // Read audio metadata
  ipcMain.handle('audio:metadata', async (_, filePath: string) => {
    try {
      const metadata = await parseFile(filePath, { duration: true })
      const { common, format } = metadata

      let coverArt: string | undefined
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0]
        const base64 = Buffer.from(pic.data).toString('base64')
        coverArt = `data:${pic.format};base64,${base64}`
      }

      return {
        title: common.title || basename(filePath, extname(filePath)),
        artist: common.artist || common.albumartist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
        duration: format.duration || 0,
        coverArt
      }
    } catch (err) {
      console.error('Error reading metadata for:', filePath, err)
      return {
        title: basename(filePath, extname(filePath)),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 0
      }
    }
  })
}
