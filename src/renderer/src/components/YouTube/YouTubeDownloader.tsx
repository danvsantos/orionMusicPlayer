import React, { useState, useEffect, useCallback } from 'react'
import { usePlayerStore } from '../../store/playerStore'

declare global {
  interface Window {
    api: any
  }
}

interface PlaylistInfo {
  title: string
  uploader: string
  count: number
  isPlaylist: boolean
}

interface DownloadProgress {
  status: 'starting' | 'downloading' | 'done' | 'error'
  total: number
  current: number
  percent?: number
  message?: string
}

type YtdlpStatus = 'checking' | 'installing' | 'available' | 'unavailable'

export function YouTubeDownloader() {
  const [url, setUrl] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [folderName, setFolderName] = useState('')
  const [info, setInfo] = useState<PlaylistInfo | null>(null)
  const [infoError, setInfoError] = useState('')
  const [isFetchingInfo, setIsFetchingInfo] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [ytdlpStatus, setYtdlpStatus] = useState<YtdlpStatus>('checking')
  const [ytdlpVersion, setYtdlpVersion] = useState('')
  const [ytdlpMessage, setYtdlpMessage] = useState('')
  const [ffmpegMissing, setFfmpegMissing] = useState(false)

  const { addTracks } = usePlayerStore()

  // Listen for yt-dlp status emitted by main process on startup
  useEffect(() => {
    const cleanup = window.api.onYtdlpStatus(
      (data: { status: YtdlpStatus; version?: string; message?: string; ffmpegMissing?: boolean }) => {
        setYtdlpStatus(data.status)
        if (data.version) setYtdlpVersion(data.version)
        if (data.message) setYtdlpMessage(data.message)
        if (data.ffmpegMissing !== undefined) setFfmpegMissing(data.ffmpegMissing)
      }
    )
    return cleanup
  }, [])

  // Listen to download progress
  useEffect(() => {
    const cleanup = window.api.onYoutubeProgress((data: DownloadProgress) => {
      setProgress(data)
      if (data.status === 'done' || data.status === 'error') {
        setIsDownloading(false)
      }
    })
    return cleanup
  }, [])

  const handleFetchInfo = useCallback(async () => {
    if (!url.trim()) return
    setIsFetchingInfo(true)
    setInfoError('')
    setInfo(null)

    const result = await window.api.youtubeInfo(url.trim())
    setIsFetchingInfo(false)

    if (result.error) {
      setInfoError(`Erro: ${result.error}. Certifique-se que yt-dlp esta instalado.`)
    } else {
      setInfo(result)
      // Auto-fill folder name from playlist/video title (only if user hasn't typed one)
      if (!folderName) setFolderName(result.title || '')
    }
  }, [url, folderName])

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await window.api.openFolder()
    if (dir) setOutputDir(dir)
  }, [])

  const handleDownload = useCallback(async () => {
    if (!url.trim() || !outputDir || !folderName.trim()) return
    setIsDownloading(true)
    setProgress({ status: 'starting', total: info?.count || 0, current: 0 })

    const result = await window.api.youtubeDownload(url.trim(), outputDir, folderName.trim())

    if (result.success) {
      // Auto-load from the actual subfolder created
      const files = await window.api.scanFolder(result.outputDir)
      if (files.length > 0) {
        // Load metadata and add to playlist
        const tracks = files.map((path: string) => {
          const filename = path.split('/').pop() || path
          const ext = filename.split('.').pop()?.toLowerCase() || ''
          return {
            id: `yt_${path}`,
            path,
            filename,
            title: filename.replace(/\.[^/.]+$/, ''),
            artist: info?.uploader || 'YouTube',
            album: info?.title || 'YouTube Playlist',
            duration: 0,
            format: ext
          }
        })

        usePlayerStore.getState().addTracks(tracks)

        // Load metadata in background
        for (const track of tracks) {
          const meta = await window.api.getMetadata(track.path)
          usePlayerStore.setState((state) => ({
            tracks: state.tracks.map(t =>
              t.id === track.id ? { ...t, ...meta } : t
            )
          }))
        }
      }
    }
  }, [url, outputDir, folderName, info])

  // Overall progress = item progress + within-item percentage
  const progressPercent = progress
    ? progress.status === 'done'
      ? 100
      : progress.total > 1
        ? Math.round(((progress.current - 1) / progress.total) * 100 + (progress.percent ?? 0) / progress.total)
        : Math.round(progress.percent ?? 0)
    : 0

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div>
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
          YouTube Downloader
        </h2>
        <p className="text-[10px] text-slate-600">
          Cole a URL de uma playlist ou video do YouTube
        </p>
      </div>

      {/* URL Input */}
      <div className="space-y-2">
        <label className="text-[10px] text-slate-500 uppercase">URL do YouTube</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setInfo(null); setInfoError(''); setFolderName('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchInfo()}
            placeholder="https://youtube.com/playlist?list=..."
            className="flex-1 bg-[#1a1a26] border border-[#2a2a3e] rounded px-3 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-violet-600 transition-colors"
            style={{ WebkitUserSelect: 'text', userSelect: 'text' } as React.CSSProperties}
          />
          <button
            onClick={handleFetchInfo}
            disabled={!url.trim() || isFetchingInfo}
            className="px-3 py-2 text-[10px] bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-300 rounded transition-colors disabled:opacity-50 font-bold"
          >
            {isFetchingInfo ? '...' : 'INFO'}
          </button>
        </div>
      </div>

      {/* Info Display */}
      {infoError && (
        <div className="bg-red-900/20 border border-red-800/40 rounded p-3">
          <p className="text-[10px] text-red-400">{infoError}</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Instale o yt-dlp: <span className="text-slate-500">brew install yt-dlp</span> (Mac) ou <span className="text-slate-500">pip install yt-dlp</span> (Linux)
          </p>
        </div>
      )}

      {info && (
        <div className="bg-violet-900/20 border border-violet-800/40 rounded p-3 space-y-1">
          <p className="text-xs text-white font-medium">{info.title}</p>
          <p className="text-[10px] text-slate-400">{info.uploader}</p>
          <p className="text-[10px] text-violet-400">
            {info.isPlaylist ? `${info.count} videos na playlist` : '1 video'}
          </p>
        </div>
      )}

      {/* Folder name */}
      <div className="space-y-2">
        <label className="text-[10px] text-slate-500 uppercase">Nome da pasta</label>
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="Ex: Minhas Músicas do YouTube"
          className="w-full bg-[#1a1a26] border border-[#2a2a3e] rounded px-3 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-violet-600 transition-colors"
          style={{ WebkitUserSelect: 'text', userSelect: 'text' } as React.CSSProperties}
        />
      </div>

      {/* Output Directory */}
      <div className="space-y-2">
        <label className="text-[10px] text-slate-500 uppercase">Salvar em</label>
        <div className="flex gap-2">
          <div
            className="flex-1 bg-[#1a1a26] border border-[#2a2a3e] rounded px-3 py-2 text-xs truncate cursor-pointer hover:border-violet-700 transition-colors"
            onClick={handleSelectOutputDir}
          >
            {outputDir ? (
              <span className="text-slate-300">
                {outputDir}
                {folderName.trim() && (
                  <span className="text-violet-400"> / {folderName.trim()}</span>
                )}
              </span>
            ) : (
              <span className="text-slate-600">Clique para selecionar pasta...</span>
            )}
          </div>
          <button
            onClick={handleSelectOutputDir}
            className="px-3 py-2 text-[10px] bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-300 rounded transition-colors font-bold flex-shrink-0"
          >
            PASTA
          </button>
        </div>
      </div>

      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={!url.trim() || !outputDir || !folderName.trim() || isDownloading}
        className={`py-3 rounded text-sm font-bold transition-all ${
          !url.trim() || !outputDir || isDownloading
            ? 'bg-[#1a1a26] text-slate-700 cursor-not-allowed'
            : 'bg-violet-600 hover:bg-violet-500 text-white'
        }`}
      >
        {isDownloading ? 'BAIXANDO...' : 'BAIXAR E REPRODUZIR'}
      </button>

      {/* Progress */}
      {progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span className="truncate flex-1 pr-2">
              {progress.status === 'done'  ? 'Download concluído!' :
               progress.status === 'error' ? 'Erro no download' :
               progress.message || 'Baixando...'}
            </span>
            {progress.total > 0 && (
              <span className="flex-shrink-0 text-violet-400">
                {progress.current}/{progress.total}
              </span>
            )}
          </div>
          <div className="h-1.5 bg-[#2a2a3e] rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all duration-300 ${
                progress.status === 'error' ? 'bg-red-500' :
                progress.status === 'done' ? 'bg-green-500' : 'bg-violet-500'
              }`}
              style={{ width: progress.status === 'done' ? '100%' : `${progressPercent}%` }}
            />
          </div>
          {progress.status === 'done' && (
            <p className="text-[10px] text-green-400 text-center">
              Musicas adicionadas a playlist automaticamente!
            </p>
          )}
        </div>
      )}

      {/* yt-dlp status banner */}
      <div className={`mt-auto rounded p-3 flex items-start gap-2 ${
        ytdlpStatus === 'available'   ? 'bg-green-900/20 border border-green-800/40' :
        ytdlpStatus === 'unavailable' ? 'bg-red-900/20 border border-red-800/40' :
        'bg-[#1a1a26] border border-[#2a2a3e]'
      }`}>
        {/* icon */}
        <span className="text-sm mt-0.5">
          {ytdlpStatus === 'checking'    && '🔍'}
          {ytdlpStatus === 'installing'  && '⏳'}
          {ytdlpStatus === 'available'   && '✅'}
          {ytdlpStatus === 'unavailable' && '❌'}
        </span>
        <div className="space-y-0.5">
          {ytdlpStatus === 'checking' && (
            <p className="text-[10px] text-slate-400">Verificando yt-dlp...</p>
          )}
          {ytdlpStatus === 'installing' && (
            <p className="text-[10px] text-amber-400">{ytdlpMessage || 'Instalando yt-dlp automaticamente...'}</p>
          )}
          {ytdlpStatus === 'available' && (
            <>
              <p className="text-[10px] text-green-400 font-bold">yt-dlp disponível</p>
              {ytdlpVersion && <p className="text-[10px] text-slate-500">v{ytdlpVersion}</p>}
              {ffmpegMissing && (
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-[10px] text-amber-400 font-bold">ffmpeg não encontrado</p>
                  <p className="text-[10px] text-slate-500">Downloads ficarão no formato original sem converter para MP3.</p>
                  <code className="text-[10px] text-violet-400 block mt-0.5">brew install ffmpeg</code>
                </div>
              )}
            </>
          )}
          {ytdlpStatus === 'unavailable' && (
            <>
              <p className="text-[10px] text-red-400 font-bold">yt-dlp não encontrado</p>
              {ytdlpMessage && <p className="text-[10px] text-slate-600">{ytdlpMessage}</p>}
              <p className="text-[10px] text-slate-500 mt-1">Instale manualmente:</p>
              <code className="text-[10px] text-violet-400 block">brew install yt-dlp</code>
              <code className="text-[10px] text-violet-400 block">pip install yt-dlp</code>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
