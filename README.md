# OrionPlayer

Um player de música cross-platform inspirado no Winamp, construído com Electron + React + TypeScript. Suporta reprodução local de áudio, equalizador gráfico de 10 bandas, visualizador de frequências e download de playlists do YouTube.

---

## Funcionalidades

- Reprodução de MP3, AAC, M4A, FLAC, WAV, OGG, Opus, WebM
- Carregamento por pasta ou seleção de arquivos individuais
- Modos de reprodução: Normal, Aleatório, Repetir uma, Repetir todas
- Ordenação da playlist: por título, artista, nome do arquivo ou embaralhar
- Equalizador gráfico de 10 bandas (60Hz–16kHz) com preamp e 8 presets
- Visualizador de frequências em canvas
- Efeito marquee no nome da música quando o texto transborda
- Download de playlists e vídeos do YouTube (converte para MP3 via yt-dlp + ffmpeg)
- Interface frameless com controles nativos no macOS (traffic lights) e personalizados no Windows/Linux
- Sincronização de volume com o sistema operacional (macOS e Linux)
- Cross-platform: macOS, Linux, Windows

---

## Pré-requisitos

### Desenvolvimento
- [Node.js](https://nodejs.org/) 18 ou superior
- npm (incluso no Node.js)

### Funcionalidade de Download YouTube
- **yt-dlp** — baixado e instalado automaticamente pelo app na primeira execução
- **ffmpeg** — necessário para conversão para MP3, também instalado automaticamente

Instalação manual caso necessário:

```bash
# macOS
brew install yt-dlp ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg
pip3 install yt-dlp

# Windows
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

---

## Rodar em desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar o app em modo de desenvolvimento (com HMR)
npm run dev
```

O comando sobe o processo Electron + servidor Vite com Hot Module Replacement. Alterações nos arquivos do renderer são refletidas instantaneamente.

---

## Gerar ícones

O ícone do app é gerado a partir de `resources/icon.svg` via script:

```bash
npm run create-icon
```

Gera os arquivos PNG em `resources/icons/` (16×16 até 1024×1024) e `resources/icon.png`. Execute este comando antes de compilar se modificar o SVG.

---

## Compilar e gerar instaladores

Cada plataforma tem seu próprio script. Os instaladores são gerados em subpastas separadas dentro de `dist/`.

### macOS — DMG (arm64)

```bash
npm run package:mac
# Saída: dist/mac/OrionPlayer-x.x.x-arm64.dmg
```

> Requer macOS. Assina com certificado disponível no Keychain.

### Linux — AppImage + DEB (Ubuntu/Debian)

```bash
npm run package:linux
# Saída:
#   dist/linux/OrionPlayer-x.x.x.AppImage
#   dist/linux/orion-player_x.x.x_amd64.deb
```

> Pode ser executado a partir do macOS via cross-compilation.

### Windows — Instalador NSIS (.exe)

```bash
npm run package:win
# Saída: dist/windows/OrionPlayer Setup x.x.x.exe
```

> electron-builder usa Wine embutido para compilação cross-platform a partir do macOS/Linux. O instalador NSIS permite escolher o diretório de instalação e cria atalhos no Desktop e Menu Iniciar.

### Compilação completa (sequencial)

```bash
npm run package:mac && npm run package:linux && npm run package:win
```

---

## Versionamento

A versão é definida em `package.json` e injetada automaticamente no bundle do renderer via `electron.vite.config.ts` (`__APP_VERSION__`). É exibida no rodapé da aplicação.

Para lançar uma nova versão:

1. Atualizar `"version"` em `package.json` (segue [semver](https://semver.org/))
2. Rodar os scripts de build desejados

---

## Estrutura do projeto

```
orionMusicPlayer/
├── src/
│   ├── main/                       # Processo principal Electron (Node.js)
│   │   ├── index.ts                # Entry point: cria BrowserWindow, registra IPC
│   │   ├── ipc-handlers.ts         # Handlers: diálogos, scan de pasta, metadados, volume
│   │   └── youtube.ts              # Download YouTube: yt-dlp + ffmpeg, sanitize filenames
│   ├── preload/
│   │   └── index.ts                # contextBridge: expõe window.api para o renderer
│   └── renderer/src/
│       ├── App.tsx                 # Root: layout TitleBar + Player + painel dinâmico + footer
│       ├── store/
│       │   ├── playerStore.ts      # Zustand: tracks, playback, playMode, activePanel
│       │   └── equalizerStore.ts   # Zustand: 10 bandas EQ, presets, preamp
│       ├── hooks/
│       │   └── useAudioEngine.ts   # Web Audio API: cadeia de áudio completa
│       ├── components/
│       │   ├── Player/             # Controles, progress bar, cover art, animação vinil
│       │   ├── Playlist/           # Lista de faixas, ordenação, remoção
│       │   ├── Equalizer/          # 10 sliders verticais + preamp + presets
│       │   ├── Visualizer/         # Canvas com barras de frequência (AnalyserNode)
│       │   ├── YouTube/            # Downloader: URL, info, progresso, status yt-dlp/ffmpeg
│       │   ├── TitleBar/           # Barra de título frameless (traffic lights no Mac)
│       │   └── Marquee.tsx         # Animação de texto com measureText para overflow preciso
│       └── index.css               # Tailwind + animação marquee + estilos de range input
├── scripts/
│   ├── build.mjs                   # Build script por plataforma (electron-builder API)
│   └── create-icon.mjs             # Gera PNGs do ícone a partir do SVG (@resvg/resvg-js)
├── resources/
│   ├── icon.svg                    # Ícone fonte (tema espacial, Orion's Belt)
│   ├── icon.png                    # PNG 512×512 gerado
│   └── icons/                      # PNGs em múltiplos tamanhos (16 a 1024)
├── electron.vite.config.ts         # Config Vite: aliases, define __APP_VERSION__
├── package.json                    # Dependências + config electron-builder
└── dist/                           # Instaladores gerados (não versionado)
    ├── mac/
    ├── linux/
    └── windows/
```

---

## Detalhes técnicos

### Stack

| Camada | Tecnologia |
|---|---|
| Desktop runtime | Electron 28 |
| Build tool | electron-vite + Vite 5 |
| UI | React 18 + TypeScript |
| Estado | Zustand 4 |
| Estilo | Tailwind CSS 3 |
| Áudio | Web Audio API nativa do navegador |
| Metadados | music-metadata 7.14.0 (CJS — v9+ é ESM apenas) |
| Download YouTube | youtube-dl-exec + spawn yt-dlp direto |
| Ícone | @resvg/resvg-js (SVG → PNG sem ferramentas nativas) |
| Packaging | electron-builder 24 |

### Cadeia de áudio (Web Audio API)

```
HTMLAudioElement
    └─► MediaElementSourceNode
            └─► GainNode (volume)
                    └─► GainNode (preamp)
                            └─► BiquadFilter[0]  60Hz   lowshelf
                                └─► BiquadFilter[1]  170Hz  peaking
                                    └─► ...
                                        └─► BiquadFilter[9]  16kHz  highshelf
                                                └─► AnalyserNode (visualizador)
                                                        └─► AudioContext.destination
```

### IPC (window.api)

| Método | Descrição |
|---|---|
| `openFolder()` | Diálogo para selecionar pasta, retorna caminho |
| `openFiles()` | Diálogo para selecionar arquivos de áudio |
| `scanFolder(path)` | Lista arquivos de áudio em um diretório |
| `getMetadata(path)` | Lê tags ID3/Vorbis via music-metadata |
| `getSystemVolume()` | Volume do sistema (0–1), null no Windows |
| `setSystemVolume(v)` | Define volume do sistema (macOS/Linux) |
| `youtubeInfo(url)` | Retorna título, uploader, count da playlist |
| `youtubeDownload(url, dir, name)` | Inicia download com progresso via eventos |
| `onYoutubeProgress(cb)` | Escuta eventos de progresso do download |
| `onYtdlpStatus(cb)` | Escuta status do yt-dlp/ffmpeg na inicialização |

### Formatos de áudio suportados

`.mp3` `.aac` `.m4a` `.flac` `.wav` `.ogg` `.opus` `.wma` `.webm`

### Presets do equalizador

Normal, Rock, Jazz, Pop, Electronic, Classical, Hip-Hop, Bass Boost

---

## Observações de compatibilidade

- **macOS**: `titleBarStyle: 'hidden'` com `trafficLightPosition` para os botões nativos
- **Windows/Linux**: botões de janela customizados (min/max/fechar) renderizados no TitleBar
- **Caminhos de arquivo Windows**: URLs do tipo `file:///C:/...` geradas automaticamente
- **Volume**: sincroniza com sistema no macOS (osascript) e Linux (pactl); no Windows usa apenas o controle interno (GainNode)
- **yt-dlp PATH**: o app procura em caminhos absolutos conhecidos antes de depender do PATH do shell, pois o Electron pode não heritar o PATH completo do usuário
