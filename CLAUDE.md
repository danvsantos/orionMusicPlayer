# OrionPlayer — Contexto para Claude

Este arquivo descreve a arquitetura, convenções e decisões de design do projeto para que o Claude possa trabalhar com contexto completo em novas sessões.

---

## Visão geral

Player de música desktop cross-platform inspirado no Winamp. Electron 28 + React 18 + TypeScript. Interface frameless com tema escuro espacial (roxo/violeta, fundo `#0a0a0f`).

**Versão atual:** ver `"version"` em `package.json`

---

## Comandos essenciais

```bash
npm run dev              # Dev com HMR
npm run build            # Build de produção (sem empacotar)
npm run package:mac      # Gera dist/mac/OrionPlayer-x.x.x-arm64.dmg
npm run package:linux    # Gera dist/linux/ (AppImage + DEB)
npm run package:win      # Gera dist/windows/OrionPlayer Setup x.x.x.exe
npm run create-icon      # Regenera PNGs do ícone a partir de resources/icon.svg
```

---

## Estrutura de arquivos críticos

```
src/main/
  index.ts           BrowserWindow, registra IPC e YouTube handlers, checkAndInstallYtDlp na startup
  ipc-handlers.ts    Handlers: diálogo pasta/arquivos, scan, metadados (music-metadata), volume sistema
  youtube.ts         yt-dlp + ffmpeg: find/install, downloadWithProgress (spawn+stdout), sanitizeFilename

src/preload/
  index.ts           contextBridge → window.api (ver seção IPC abaixo)

src/renderer/src/
  App.tsx            Layout root: TitleBar + coluna esquerda (Player) + painel direito + footer de versão
  store/
    playerStore.ts   Zustand: Track[], currentIndex, isPlaying, volume, playMode, activePanel
    equalizerStore.ts Zustand: EQBand[10], presets, preampGain, isEnabled
  hooks/
    useAudioEngine.ts Web Audio: AudioContext, GainNode→GainNode(preamp)→BiquadFilter[10]→AnalyserNode
  components/
    Player/Player.tsx        Controles playback, progress bar (seek), cover art, vinyle spin, volume
    Playlist/Playlist.tsx    Lista de faixas, botões abrir pasta/arquivos, sort, remove, clear
    Equalizer/Equalizer.tsx  10 sliders verticais EQ + preamp slider + botões preset
    Visualizer/Visualizer.tsx Canvas requestAnimationFrame com AnalyserNode.getByteFrequencyData
    YouTube/YouTubeDownloader.tsx URL input, info fetch, progress bar, status banner yt-dlp+ffmpeg
    TitleBar/TitleBar.tsx    Frameless titlebar; macOS=traffic lights (paddingLeft 80), Win/Linux=botões SVG
    Marquee.tsx              Canvas measureText para detectar overflow; CSS animation marquee-scroll

scripts/
  build.mjs          electron-builder Node API com output dir por plataforma
  create-icon.mjs    @resvg/resvg-js SVG→PNG em múltiplos tamanhos

electron.vite.config.ts   define: { __APP_VERSION__: pkg.version } injetado no renderer
```

---

## Arquitetura de áudio

```
HTMLAudioElement → MediaElementSourceNode
  → GainNode (volume: 0–1, isMuted)
    → GainNode (preamp: Math.pow(10, preampGain/20))
      → BiquadFilter[0]  60Hz   type=lowshelf
      → BiquadFilter[1]  170Hz  type=peaking   Q=1.4
      → ...
      → BiquadFilter[9]  16kHz  type=highshelf
        → AnalyserNode (fftSize=256, smoothing=0.8)
          → AudioContext.destination
```

**Problema resolvido:** `playMode` e `playNext` usam refs (`playModeRef`, `playNextRef`) dentro do listener `ended` para evitar stale closures.

**File URL no Windows:** `audio.src` converte backslashes e usa triple-slash para drive letters:
```typescript
const p = path.replace(/\\/g, '/')
audio.src = /^[a-zA-Z]:/.test(p) ? `file:///${p}` : `file://${p}`
```

---

## Tray e Dock Menu

**Tray** (`src/main/index.ts`):
- Criado em `setupTray()` chamado em `app.whenReady()` — referência mantida em `let tray: Tray | null` (evita GC)
- Ícone: `resources/icon.png` redimensionado para 16×16 via `nativeImage`
- Menu rebuilt em `refreshTrayMenu()` toda vez que o renderer envia `tray:update`
- Windows/Linux: clique no ícone mostra/foca a janela; botão direito abre o menu
- macOS: clique esquerdo abre o menu (comportamento padrão de menu bar)

**Dock menu (macOS)**: `app.dock.setMenu()` com itens estáticos (Reproduzir/Pausar, Anterior, Próxima, Parar)

**Fluxo de comunicação:**
```
Tray/Dock click → main: sendControl(action) → webContents.send('player:control', action)
                → renderer: onPlayerControl → usePlayerStore.getState().setIsPlaying / playNext / playPrevious
Renderer state change (isPlaying/currentTrack) → ipcRenderer.send('tray:update', state)
                → main: ipcMain.on('tray:update') → refreshTrayMenu()
```

**Ações suportadas:** `toggle`, `next`, `previous`, `stop`

## IPC — window.api (preload/index.ts)

| Método | IPC channel | Direção |
|---|---|---|
| `openFolder()` | `dialog:openFolder` | invoke |
| `openFiles()` | `dialog:openFiles` | invoke |
| `scanFolder(path)` | `folder:scan` | invoke |
| `getMetadata(path)` | `audio:metadata` | invoke |
| `getSystemVolume()` | `volume:getSystem` | invoke |
| `setSystemVolume(v)` | `volume:setSystem` | invoke |
| `youtubeInfo(url)` | `youtube:info` | invoke |
| `youtubeDownload(url, dir, name)` | `youtube:download` | invoke |
| `onYoutubeProgress(cb)` | `youtube:progress` | on (main→renderer) |
| `onYtdlpStatus(cb)` | `ytdlp:status` | on (main→renderer) |
| `updateTray(state)` | `tray:update` | send (renderer→main) |
| `onPlayerControl(cb)` | `player:control` | on (main→renderer) |
| `minimize/maximize/close()` | `window:minimize/maximize/close` | send |

---

## youtube.ts — decisões importantes

**Fluxo de download:**
1. `findYtDlp()` — verifica candidatos absolutos (Homebrew, pip, WinGet, etc.) antes de depender do PATH
2. `findFfmpeg()` — idem para ffmpeg (necessário para conversão MP3)
3. `checkAndInstallYtDlp()` — chamado na startup; tenta `brew install` / `pip install` / `winget install` automaticamente
4. `downloadWithProgress()` — usa `spawn` diretamente (não `youtube-dl-exec`) para capturar stdout linha a linha e emitir progresso em tempo real
5. Passa `--ffmpeg-location <bin>` para garantir que o yt-dlp encontre o ffmpeg independente do PATH do Electron
6. `sanitizeFilesInDir()` — após download, renomeia arquivos com `sanitizeFilename()`

**sanitizeFilename:**
- Remove conteúdo em `[...]` (ruído do YouTube: `[Official MV]`, `[4K]`, IDs)
- Remove todos os blocos emoji Unicode
- Mantém apenas: `\p{L}` `\p{N}` espaços `-` `_` `.` `,` `(` `)`
- Trata colisões de nome com sufixo `(2)`, `(3)`, etc.

**Por que spawn em vez de youtube-dl-exec para o download?**
`youtubeDl(url, options)` só resolve ao terminar — não dá para capturar progresso. O `spawn` permite ler stdout linha a linha.

**STATUS events (ytdlp:status):**
```typescript
{ status: 'checking' | 'installing' | 'available' | 'unavailable', version?, message?, ffmpegMissing? }
```

---

## Estado global (Zustand)

### playerStore

```typescript
tracks: Track[]          // playlist
currentIndex: number     // -1 = nenhum
currentTrack: Track | null
isPlaying: boolean
volume: number           // 0–1
isMuted: boolean
playMode: 'normal' | 'shuffle' | 'repeat-one' | 'repeat-all'
activePanel: 'player' | 'equalizer' | 'youtube'
```

Track deduplicação em `addTracks` por `id`. O `id` de faixas locais é o path; YouTube usa `yt_${path}`.

### equalizerStore

```typescript
bands: EQBand[10]        // frequências: 60, 170, 310, 600, 1K, 3K, 6K, 12K, 14K, 16K
isEnabled: boolean
currentPreset: string    // 'Custom' quando slider é movido manualmente
preampGain: number       // -12 a +12 dB
```

Presets: Normal, Rock, Jazz, Pop, Electronic, Classical, Hip-Hop, Bass Boost

---

## Janela e TitleBar

**Configuração BrowserWindow:**
```typescript
titleBarStyle: 'hidden'          // funciona em todas as plataformas
trafficLightPosition: { x:14, y:14 }  // macOS apenas (ignorado em outros SOs)
// SEM frame: false — isso duplicava os botões no Mac
```

**TitleBar.tsx:**
- Detecta plataforma via `window.electron?.process?.platform`
- macOS: `paddingLeft: 80` para não sobrepor traffic lights, sem botões custom
- Windows/Linux: botões SVG customizados (min/max/close) com `WebkitAppRegion: 'no-drag'`

**Classe `.drag-region`** em `index.css`: define `-webkit-app-region: drag`

---

## Estilo e tema

- Fundo principal: `#0a0a0f`
- Fundo painel esquerdo: `#0d0d15`
- Bordas/cards: `#2a2a3e`
- Acento primário: violet/purple (`violet-600`, `violet-400`)
- Fonte tamanhos: `text-xs` (12px), `text-[10px]`, `text-[9px]` (footer)

**Range inputs** (progress/volume/EQ): reestilizados via pseudo-elementos `-webkit-slider-thumb` e `-webkit-slider-runnable-track` em `index.css`

**Marquee:** usa `Canvas 2D ctx.measureText()` com a fonte real do elemento (via `getComputedStyle`) para medir overflow com precisão. `span.scrollWidth` falha dentro de `overflow:hidden`.

---

## Versionamento

- Versão em `package.json` → injetada via `define: { __APP_VERSION__ }` no `electron.vite.config.ts`
- Exibida em `App.tsx` no footer: `v{__APP_VERSION__}`
- Declaração TypeScript: `declare const __APP_VERSION__: string` em App.tsx
- Bumpar `package.json` e rodar os scripts de build para nova versão

---

## Dependências críticas e pegadinhas

| Pacote | Versão | Motivo da restrição |
|---|---|---|
| `music-metadata` | `7.14.0` | v9+ é ESM apenas — incompatível com Electron main process CJS |
| `youtube-dl-exec` | `^3.0.4` | Wrapper para yt-dlp; usado apenas para `dumpSingleJson` (info) |
| `@resvg/resvg-js` | `^2.6.2` | SVG→PNG sem precisar de rsvg-convert/Inkscape no sistema |

**electron-builder cross-platform:**
- Linux e Windows podem ser compilados a partir do macOS
- Windows NSIS usa Wine embutido do electron-builder (não precisa instalar Wine separado)
- Linux DEB requer `maintainer` no config (definido em `scripts/build.mjs`)

---

## Problemas conhecidos e soluções aplicadas

| Problema | Causa | Solução |
|---|---|---|
| Slider não clicável | `h-1` (4px) pequeno demais | CSS thumb com dimensões explícitas + `margin-top: -5px` |
| Botões duplos no Mac | `frame:false` + `titleBarStyle:hidden` simultâneos | Remover `frame:false`, manter só `titleBarStyle:hidden` |
| Marquee não funcionava | `scrollWidth` retorna largura clipped em overflow:hidden | Canvas `measureText()` com fonte real |
| Progresso YouTube não aparecia | `youtubeDl()` só resolve no final | Reescrito com `spawn()` + parse stdout linha a linha |
| Ícone do dock (macOS dev) | `BrowserWindow.icon` não atualiza o dock em dev | `app.dock.setIcon(path)` explícito em `whenReady` |
| Stale closure em `ended` | playMode/playNext capturados na criação do listener | `playModeRef` / `playNextRef` atualizados via useEffect |
| webm em vez de mp3 | ffmpeg não encontrado pelo yt-dlp no env do Electron | `findFfmpeg()` + `--ffmpeg-location` passado explicitamente |
| Colchetes nos nomes | `[Official MV]` mantido pelo sanitize anterior | `sanitizeFilename` agora remove todo conteúdo `[...]` |
| Caminhos Windows | `C:\Music\song.mp3` → URL inválida | `file:///` + forward slashes para drive letters |
