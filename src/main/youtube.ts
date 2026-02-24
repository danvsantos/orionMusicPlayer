import { ipcMain, BrowserWindow, WebContents } from 'electron'
import { join, extname, basename } from 'path'
import { homedir } from 'os'
import { mkdir, readdir, rename, access } from 'fs/promises'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import youtubeDl from 'youtube-dl-exec'

const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.webm'])

function sanitizeFilename(name: string): string {
  return (
    name
      // Remove content inside square brackets entirely (YouTube noise: [Official MV], [4K], [ID], etc.)
      .replace(/\[.*?\]/g, '')
      // Remove emojis — all known Unicode emoji/symbol blocks
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{2300}-\u{23FF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/\u{200D}/gu, '')
      .replace(/\u{20E3}/gu, '')
      // Keep only: letters (all scripts/accents), digits, spaces, hyphens, underscores, dots, parentheses, commas
      .replace(/[^\p{L}\p{N}\s\-_.,()]/gu, '')
      // Normalize whitespace and strip leading/trailing hyphens or spaces
      .replace(/\s{2,}/g, ' ')
      .trim()
      .replace(/^[\s\-]+|[\s\-]+$/g, '')
  ) || 'audio'
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

async function sanitizeFilesInDir(dir: string): Promise<void> {
  const files = await readdir(dir)

  for (const file of files) {
    const ext = extname(file).toLowerCase()
    if (!AUDIO_EXTS.has(ext)) continue

    const nameWithoutExt = basename(file, ext)
    const cleanName = sanitizeFilename(nameWithoutExt)
    if (cleanName === nameWithoutExt) continue

    const oldPath = join(dir, file)
    let newPath = join(dir, cleanName + ext)

    if (await fileExists(newPath)) {
      let i = 2
      while (await fileExists(join(dir, `${cleanName} (${i})${ext}`))) i++
      newPath = join(dir, `${cleanName} (${i})${ext}`)
    }

    await rename(oldPath, newPath)
    console.log(`Renamed: "${file}" → "${basename(newPath)}"`)
  }
}

const execAsync = promisify(exec)

// ── yt-dlp ──────────────────────────────────────────────────────────────────

const YTDLP_CANDIDATES = [
  '/opt/homebrew/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  join(homedir(), '.local/bin/yt-dlp'),
  // Windows
  join(homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
  join(homedir(), 'AppData', 'Roaming', 'Python', 'Scripts', 'yt-dlp.exe'),
  join(homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
  join(homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
  join(homedir(), 'scoop', 'shims', 'yt-dlp.exe'),
  'C:\\ProgramData\\chocolatey\\bin\\yt-dlp.exe'
]

async function findYtDlp(): Promise<string> {
  for (const bin of YTDLP_CANDIDATES) {
    try { await execAsync(`"${bin}" --version`); return bin } catch {}
  }
  for (const cmd of ['yt-dlp', 'yt-dlp.exe']) {
    try { await execAsync(`"${cmd}" --version`); return cmd } catch {}
  }
  throw new Error('yt-dlp não encontrado. Instale com: brew install yt-dlp (Mac) / winget install yt-dlp.yt-dlp (Windows)')
}

async function getYtDlpVersion(): Promise<string | null> {
  try {
    const bin = await findYtDlp()
    const { stdout } = await execAsync(`"${bin}" --version`)
    return stdout.trim()
  } catch {}
  return null
}

// ── ffmpeg ───────────────────────────────────────────────────────────────────

const FFMPEG_CANDIDATES = [
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/usr/bin/ffmpeg',
  join(homedir(), '.local/bin/ffmpeg'),
  // Windows
  join(homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
  join(homedir(), 'scoop', 'shims', 'ffmpeg.exe'),
  'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
  'C:\\ffmpeg\\bin\\ffmpeg.exe'
]

async function findFfmpeg(): Promise<string | null> {
  for (const bin of FFMPEG_CANDIDATES) {
    try { await execAsync(`"${bin}" -version`); return bin } catch {}
  }
  for (const cmd of ['ffmpeg', 'ffmpeg.exe']) {
    try { await execAsync(`"${cmd}" -version`); return cmd } catch {}
  }
  return null
}

async function installFfmpeg(): Promise<string | null> {
  try {
    if (process.platform === 'darwin') {
      await execAsync('brew install ffmpeg')
    } else if (process.platform === 'win32') {
      await execAsync('winget install Gyan.FFmpeg --accept-source-agreements --accept-package-agreements')
    } else {
      return null // Linux: needs sudo, skip auto-install
    }
    return findFfmpeg()
  } catch {
    return null
  }
}

// ── startup check ────────────────────────────────────────────────────────────

export async function checkAndInstallYtDlp(win: BrowserWindow): Promise<void> {
  const send = (status: string, extra?: object) =>
    win.webContents.send('ytdlp:status', { status, ...extra })

  send('checking')

  // 1. yt-dlp
  let version = await getYtDlpVersion()
  if (!version) {
    send('installing')
    try {
      if (process.platform === 'darwin') {
        await execAsync('brew install yt-dlp')
      } else if (process.platform === 'linux') {
        try { await execAsync('pip3 install -U yt-dlp') }
        catch { await execAsync('pip install -U yt-dlp') }
      } else if (process.platform === 'win32') {
        try {
          await execAsync('winget install --id yt-dlp.yt-dlp --accept-source-agreements --accept-package-agreements')
        } catch {
          try { await execAsync('pip install -U yt-dlp') }
          catch { await execAsync('pip3 install -U yt-dlp') }
        }
      } else {
        send('unavailable', { message: 'Instale o yt-dlp manualmente.' })
        return
      }
      version = await getYtDlpVersion()
    } catch (err: any) {
      send('unavailable', { message: err.message })
      return
    }

    if (!version) {
      send('unavailable', { message: 'yt-dlp instalado mas não encontrado no PATH.' })
      return
    }
  }

  // 2. ffmpeg (needed for MP3 conversion)
  let ffmpegBin = await findFfmpeg()
  if (!ffmpegBin) {
    send('installing', { message: 'Instalando ffmpeg para conversão MP3...' })
    ffmpegBin = await installFfmpeg()
  }

  send('available', {
    version,
    ffmpegMissing: !ffmpegBin,
    message: ffmpegBin ? undefined : 'ffmpeg não encontrado — downloads ficarão no formato original. Instale: brew install ffmpeg'
  })
}

// ── download ─────────────────────────────────────────────────────────────────

function downloadWithProgress(
  binary: string,
  url: string,
  outputDir: string,
  total: number,
  sender: WebContents,
  ffmpegBin: string | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      ...(ffmpegBin ? ['--ffmpeg-location', ffmpegBin] : []),
      '--output', join(outputDir, '%(title)s.%(ext)s'),
      '--add-metadata',
      '--newline',
      '--no-playlist-reverse',
      url
    ]

    const isWin = process.platform === 'win32'
    const proc = spawn(binary, args, {
      shell: isWin,
      env: isWin
        ? { ...process.env }
        : {
            ...process.env,
            PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
          }
    })

    let current = 0
    let lineBuffer = ''

    const handleLine = (line: string) => {
      if (!line.trim()) return

      // "[download] Playlist ...: Downloading X of Y"
      const itemMatch = line.match(/Downloading\s+(\d+)\s+of\s+(\d+)/)
      if (itemMatch) {
        current = parseInt(itemMatch[1])
        sender.send('youtube:progress', {
          status: 'downloading',
          current,
          total,
          percent: 0,
          message: `Faixa ${current} de ${total}`
        })
        return
      }

      // "[download]  XX.X% of N.NNMiB at N.NNMiB/s ETA MM:SS"
      const percentMatch = line.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+\s*\S+)/)
      if (percentMatch) {
        sender.send('youtube:progress', {
          status: 'downloading',
          current: current || 1,
          total,
          percent: parseFloat(percentMatch[1]),
          message: `${percentMatch[1]}% · ${percentMatch[2]}`
        })
      }
    }

    proc.stdout!.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''
      lines.forEach(handleLine)
    })

    proc.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      if (text.toLowerCase().includes('error')) {
        console.error('[yt-dlp stderr]', text.trim())
      }
    })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`yt-dlp saiu com código ${code}`))
    })

    proc.on('error', reject)
  })
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

export function registerYouTubeHandlers(): void {
  ipcMain.handle('youtube:download', async (event, { url, outputDir, folderName }: { url: string; outputDir: string; folderName: string }) => {
    const sender = event.sender

    try {
      const binary = await findYtDlp()
      const ffmpegBin = await findFfmpeg()

      const info = await youtubeDl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        flatPlaylist: true
      }) as any

      const total = info.entries ? info.entries.length : 1

      const rawName = folderName.trim() || sanitizeFilename(info.title || 'YouTube Download')
      const finalDir = join(outputDir, sanitizeFilename(rawName))
      await mkdir(finalDir, { recursive: true })

      sender.send('youtube:progress', { status: 'downloading', total, current: 0, percent: 0, message: 'Iniciando...' })

      await downloadWithProgress(binary, url, finalDir, total, sender, ffmpegBin)

      sender.send('youtube:progress', { status: 'downloading', total, current: total, percent: 99, message: 'Limpando nomes de arquivo...' })
      await sanitizeFilesInDir(finalDir)

      sender.send('youtube:progress', { status: 'done', total, current: total, percent: 100 })
      return { success: true, outputDir: finalDir }
    } catch (err: any) {
      console.error('YouTube download error:', err)
      sender.send('youtube:progress', { status: 'error', message: err.message })
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
