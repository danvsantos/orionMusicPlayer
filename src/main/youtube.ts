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
      // Remove emojis — all known Unicode emoji/symbol blocks
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // Supplemental symbols, emoticons, etc.
      .replace(/[\u{2600}-\u{27BF}]/gu, '')       // Misc symbols, dingbats
      .replace(/[\u{2300}-\u{23FF}]/gu, '')       // Misc technical
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')       // Variation selectors
      .replace(/\u{200D}/gu, '')                  // Zero-width joiner (used in compound emojis)
      .replace(/\u{20E3}/gu, '')                  // Combining enclosing keycap
      // Remove characters that are invalid or problematic in filenames
      // Keep: letters (all scripts), digits, spaces, hyphens, underscores, dots, parentheses, commas, brackets, ampersand
      .replace(/[^\p{L}\p{N}\s\-_.,()[\]&]/gu, '')
      // Normalize whitespace
      .trim()
      .replace(/\s{2,}/g, ' ')
  ) || 'audio'  // fallback if name becomes empty
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

    // Avoid overwriting an existing file
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

// Known yt-dlp binary locations
const YTDLP_CANDIDATES = [
  '/opt/homebrew/bin/yt-dlp',          // Apple Silicon Homebrew
  '/usr/local/bin/yt-dlp',             // Intel Mac Homebrew
  '/usr/bin/yt-dlp',                   // Linux system
  join(homedir(), '.local/bin/yt-dlp') // pip --user install
]

async function findYtDlp(): Promise<string> {
  for (const bin of YTDLP_CANDIDATES) {
    try {
      await execAsync(`"${bin}" --version`)
      return bin
    } catch {}
  }
  // Last resort: rely on PATH
  try {
    await execAsync('yt-dlp --version')
    return 'yt-dlp'
  } catch {}
  throw new Error('yt-dlp não encontrado. Instale com: brew install yt-dlp')
}

async function getYtDlpVersion(): Promise<string | null> {
  try {
    const bin = await findYtDlp()
    const { stdout } = await execAsync(`"${bin}" --version`)
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

  send('installing')
  try {
    if (process.platform === 'darwin') {
      await execAsync('brew install yt-dlp')
    } else if (process.platform === 'linux') {
      try { await execAsync('pip3 install -U yt-dlp') }
      catch { await execAsync('pip install -U yt-dlp') }
    } else {
      send('unavailable', { message: 'Instale o yt-dlp manualmente.' })
      return
    }

    const newVersion = await getYtDlpVersion()
    if (newVersion) {
      send('available', { version: newVersion })
    } else {
      send('unavailable', { message: 'Instalado mas não encontrado no PATH.' })
    }
  } catch (err: any) {
    send('unavailable', { message: err.message })
  }
}

// Spawn yt-dlp and stream stdout line-by-line with progress events
function downloadWithProgress(
  binary: string,
  url: string,
  outputDir: string,
  total: number,
  sender: WebContents
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--output', join(outputDir, '%(title)s.%(ext)s'),
      '--add-metadata',
      '--newline',           // one progress line per update (easier to parse)
      '--no-playlist-reverse',
      url
    ]

    const proc = spawn(binary, args, {
      env: {
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
      const line = chunk.toString()
      if (line.toLowerCase().includes('error')) {
        console.error('[yt-dlp stderr]', line.trim())
      }
    })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`yt-dlp saiu com código ${code}`))
    })

    proc.on('error', reject)
  })
}

export function registerYouTubeHandlers(): void {
  ipcMain.handle('youtube:download', async (event, { url, outputDir, folderName }: { url: string; outputDir: string; folderName: string }) => {
    const sender = event.sender

    try {
      const binary = await findYtDlp()

      // Get playlist/video info for total count
      const info = await youtubeDl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        flatPlaylist: true
      }) as any

      const total = info.entries ? info.entries.length : 1

      // Create named subfolder — use provided folderName or fall back to sanitized playlist title
      const rawName = folderName.trim() || sanitizeFilename(info.title || 'YouTube Download')
      const finalDir = join(outputDir, sanitizeFilename(rawName))
      await mkdir(finalDir, { recursive: true })

      sender.send('youtube:progress', { status: 'downloading', total, current: 0, percent: 0, message: 'Iniciando...' })

      await downloadWithProgress(binary, url, finalDir, total, sender)

      // Clean up emojis and special characters from downloaded filenames
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
