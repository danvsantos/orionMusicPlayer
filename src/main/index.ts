import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc-handlers'
import { registerYouTubeHandlers, checkAndInstallYtDlp } from './youtube'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ── Tray ─────────────────────────────────────────────────────────────────────

interface TrayState {
  isPlaying: boolean
  title: string
  artist: string
}

let trayState: TrayState = { isPlaying: false, title: 'Nenhuma faixa', artist: '' }

function sendControl(action: string): void {
  mainWindow?.webContents.send('player:control', action)
}

function buildTrayMenu(): Electron.Menu {
  const trackLabel = trayState.title !== 'Nenhuma faixa'
    ? `${trayState.title}${trayState.artist ? ' — ' + trayState.artist : ''}`
    : 'Nenhuma faixa'

  return Menu.buildFromTemplate([
    { label: trackLabel, enabled: false },
    { type: 'separator' },
    {
      label: trayState.isPlaying ? 'Pausar' : 'Reproduzir',
      accelerator: 'Space',
      click: () => sendControl('toggle')
    },
    {
      label: 'Faixa anterior',
      click: () => sendControl('previous')
    },
    {
      label: 'Próxima faixa',
      click: () => sendControl('next')
    },
    {
      label: 'Parar',
      click: () => sendControl('stop')
    },
    { type: 'separator' },
    {
      label: 'Mostrar OrionPlayer',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    {
      label: 'Sair',
      click: () => app.quit()
    }
  ])
}

function setupTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('OrionPlayer')
  tray.setContextMenu(buildTrayMenu())

  // Windows/Linux: click on tray icon shows/focuses the window
  tray.on('click', () => {
    if (process.platform !== 'darwin') {
      if (mainWindow?.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow?.show()
      }
    }
  })
}

function refreshTrayMenu(): void {
  if (!tray) return
  tray.setContextMenu(buildTrayMenu())
  tray.setToolTip(
    trayState.title !== 'Nenhuma faixa'
      ? `OrionPlayer — ${trayState.title}`
      : 'OrionPlayer'
  )
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: join(__dirname, '../../resources/icon.png'),
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    checkAndInstallYtDlp(mainWindow!)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  // Tray state update from renderer
  ipcMain.on('tray:update', (_, state: TrayState) => {
    trayState = state
    refreshTrayMenu()
  })

  registerIpcHandlers()
  registerYouTubeHandlers()
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.orionplayer')

  const iconPath = join(__dirname, '../../resources/icon.png')

  // macOS dock
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath)
    app.dock.setMenu(Menu.buildFromTemplate([
      { label: 'Reproduzir / Pausar', click: () => sendControl('toggle') },
      { label: 'Faixa anterior',      click: () => sendControl('previous') },
      { label: 'Próxima faixa',       click: () => sendControl('next') },
      { label: 'Parar',               click: () => sendControl('stop') }
    ]))
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  setupTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
