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
  message?: string
}

export function YouTubeDownloader() {
  const [url, setUrl] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [info, setInfo] = useState<PlaylistInfo | null>(null)
  const [infoError, setInfoError] = useState('')
  const [isFetchingInfo, setIsFetchingInfo] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)

  const { addTracks } = usePlayerStore()

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
    }
  }, [url])

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await window.api.openFolder()
    if (dir) setOutputDir(dir)
  }, [])

  const handleDownload = useCallback(async () => {
    if (!url.trim() || !outputDir) return
    setIsDownloading(true)
    setProgress({ status: 'starting', total: info?.count || 0, current: 0 })

    const result = await window.api.youtubeDownload(url.trim(), outputDir)

    if (result.success) {
      // Auto-load downloaded files
      const files = await window.api.scanFolder(outputDir)
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
  }, [url, outputDir, info])

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
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
            onChange={(e) => { setUrl(e.target.value); setInfo(null); setInfoError('') }}
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

      {/* Output Directory */}
      <div className="space-y-2">
        <label className="text-[10px] text-slate-500 uppercase">Pasta de destino</label>
        <div className="flex gap-2">
          <div
            className="flex-1 bg-[#1a1a26] border border-[#2a2a3e] rounded px-3 py-2 text-xs text-slate-500 truncate cursor-pointer hover:border-violet-700 transition-colors"
            onClick={handleSelectOutputDir}
          >
            {outputDir || 'Clique para selecionar pasta...'}
          </div>
          <button
            onClick={handleSelectOutputDir}
            className="px-3 py-2 text-[10px] bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-300 rounded transition-colors font-bold"
          >
            PASTA
          </button>
        </div>
      </div>

      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={!url.trim() || !outputDir || isDownloading}
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
            <span>{progress.status === 'done' ? 'Download concluido!' : progress.status === 'error' ? 'Erro no download' : 'Baixando...'}</span>
            {progress.total > 0 && <span>{progress.current}/{progress.total}</span>}
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

      {/* Instructions */}
      <div className="mt-auto bg-[#1a1a26] rounded p-3 space-y-1">
        <p className="text-[10px] text-slate-500 font-bold">REQUISITO</p>
        <p className="text-[10px] text-slate-600">
          O <span className="text-slate-500">yt-dlp</span> precisa estar instalado no sistema:
        </p>
        <code className="text-[10px] text-violet-400 block">brew install yt-dlp</code>
        <code className="text-[10px] text-violet-400 block">pip install yt-dlp</code>
      </div>
    </div>
  )
}
