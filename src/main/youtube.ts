import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import youtubeDl from 'youtube-dl-exec'

const execAsync = promisify(exec)

async function getYtDlpVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('yt-dlp --version')
    return stdout.trim()
  } catch {}
  return null
}

export async function checkAndInstallYtDlp(win: BrowserWindow): Promise<void> {
  const send = (status: string, extra?: object) =>
    win.webContents.send('ytdlp:status', { status, ...extra })

  send('checking')

  const version = await getYtDlpVersion()
  if (version) {
    send('available', { version })
    return
  }

  // Not found — try auto-install
  send('installing')
  try {
    if (process.platform === 'darwin') {
      await execAsync('brew install yt-dlp')
    } else if (process.platform === 'linux') {
      // Try pip3, then pip
      try {
        await execAsync('pip3 install -U yt-dlp')
      } catch {
        await execAsync('pip install -U yt-dlp')
      }
    } else {
      send('unavailable', { message: 'Instale o yt-dlp manualmente.' })
      return
    }

    const newVersion = await getYtDlpVersion()
    if (newVersion) {
      send('available', { version: newVersion })
    } else {
      send('unavailable', { message: 'Instalação concluída mas yt-dlp não encontrado no PATH.' })
    }
  } catch (err: any) {
    send('unavailable', { message: err.message })
  }
}

export function registerYouTubeHandlers(): void {
  ipcMain.handle('youtube:download', async (event, { url, outputDir }: { url: string; outputDir: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)

    try {
      await mkdir(outputDir, { recursive: true })

      // Get playlist info first
      const info = await youtubeDl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCallHome: true,
        preferFreeFormats: true,
        youtubeSkipDashManifest: true,
        flatPlaylist: true
      }) as any

      const totalItems = info.entries ? info.entries.length : 1
      win?.webContents.send('youtube:progress', { status: 'starting', total: totalItems, current: 0 })

      // Download audio
      await youtubeDl(url, {
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: 0,
        output: join(outputDir, '%(title)s.%(ext)s'),
        noWarnings: true,
        preferFreeFormats: true,
        addMetadata: true,
        embedThumbnail: true
      })

      win?.webContents.send('youtube:progress', { status: 'done', total: totalItems, current: totalItems })

      return { success: true, outputDir }
    } catch (err: any) {
      console.error('YouTube download error:', err)
      win?.webContents.send('youtube:progress', { status: 'error', message: err.message })
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('youtube:info', async (_, url: string) => {
    try {
      const info = await youtubeDl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        flatPlaylist: true
      }) as any

      return {
        title: info.title,
        uploader: info.uploader,
        count: info.entries ? info.entries.length : 1,
        isPlaylist: !!info.entries
      }
    } catch (err: any) {
      return { error: err.message }
    }
  })
}
