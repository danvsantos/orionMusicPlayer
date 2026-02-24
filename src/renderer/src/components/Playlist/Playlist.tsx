import React, { useCallback, useEffect } from 'react'
import { usePlayerStore, Track } from '../../store/playerStore'
import { formatTime } from '../../utils/time'

declare global {
  interface Window {
    api: any
  }
}

function generateId(path: string): string {
  let hash = 0
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `track_${Math.abs(hash)}_${path.split('/').pop()}`
}

export function Playlist() {
  const {
    tracks, currentIndex, isPlaying,
    setCurrentIndex, setIsPlaying, addTracks, clearPlaylist,
    sortByTitle, sortByArtist, sortByFilename, shuffle, removeTrack
  } = usePlayerStore()

  const loadMetadata = useCallback(async (filePaths: string[]) => {
    const newTracks: Track[] = []

    for (const path of filePaths) {
      const filename = path.split('/').pop() || path
      const ext = filename.split('.').pop()?.toLowerCase() || ''
      const id = generateId(path)

      // Quick add with filename first
      newTracks.push({
        id,
        path,
        filename,
        title: filename.replace(/\.[^/.]+$/, ''),
        artist: 'Loading...',
        album: '',
        duration: 0,
        format: ext
      })
    }

    addTracks(newTracks)

    // Load metadata in background
    for (const track of newTracks) {
      try {
        const meta = await window.api.getMetadata(track.path)
        usePlayerStore.setState((state) => ({
          tracks: state.tracks.map(t =>
            t.id === track.id
              ? { ...t, title: meta.title || t.title, artist: meta.artist || t.artist, album: meta.album || t.album, duration: meta.duration || t.duration, coverArt: meta.coverArt }
              : t
          )
        }))
      } catch (e) {
        console.error('Metadata error:', e)
      }
    }
  }, [addTracks])

  const handleOpenFolder = useCallback(async () => {
    const folderPath = await window.api.openFolder()
    if (!folderPath) return
    const filePaths = await window.api.scanFolder(folderPath)
    if (filePaths.length > 0) {
      await loadMetadata(filePaths)
    }
  }, [loadMetadata])

  const handleOpenFiles = useCallback(async () => {
    const filePaths = await window.api.openFiles()
    if (filePaths.length > 0) {
      await loadMetadata(filePaths)
    }
  }, [loadMetadata])

  const handleTrackClick = useCallback((index: number) => {
    if (currentIndex === index) {
      setIsPlaying(!isPlaying)
    } else {
      setCurrentIndex(index)
      setIsPlaying(true)
    }
  }, [currentIndex, isPlaying, setCurrentIndex, setIsPlaying])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        usePlayerStore.getState().setIsPlaying(!usePlayerStore.getState().isPlaying)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#2a2a3e] flex-wrap">
        <button
          onClick={handleOpenFolder}
          className="px-2 py-1 text-[10px] bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors font-bold"
        >
          + PASTA
        </button>
        <button
          onClick={handleOpenFiles}
          className="px-2 py-1 text-[10px] bg-[#2a2a3e] hover:bg-[#3a3a4e] text-slate-300 rounded transition-colors"
        >
          + FILES
        </button>
        <div className="flex-1" />
        <select
          onChange={(e) => {
            switch (e.target.value) {
              case 'title': sortByTitle(); break
              case 'artist': sortByArtist(); break
              case 'filename': sortByFilename(); break
              case 'shuffle': shuffle(); break
            }
            e.target.value = ''
          }}
          defaultValue=""
          className="text-[10px] bg-[#1a1a26] border border-[#2a2a3e] text-slate-400 rounded px-1 py-1 cursor-pointer"
        >
          <option value="" disabled>SORT</option>
          <option value="title">Por Título</option>
          <option value="artist">Por Artista</option>
          <option value="filename">Por Arquivo</option>
          <option value="shuffle">Aleatório</option>
        </select>
        <button
          onClick={clearPlaylist}
          className="px-2 py-1 text-[10px] bg-red-900/40 hover:bg-red-800/60 text-red-400 rounded transition-colors"
        >
          LIMPAR
        </button>
      </div>

      {/* Track count */}
      {tracks.length > 0 && (
        <div className="px-3 py-1 text-[10px] text-slate-600 border-b border-[#1a1a26]">
          {tracks.length} faixa{tracks.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full border-2 border-[#2a2a3e] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-[#2a2a3e]">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Nenhuma música carregada</p>
              <p className="text-slate-700 text-[10px] mt-1">Clique em "+ PASTA" ou "+ FILES"</p>
            </div>
          </div>
        ) : (
          tracks.map((track, index) => (
            <PlaylistItem
              key={track.id}
              track={track}
              index={index}
              isActive={index === currentIndex}
              isPlaying={isPlaying && index === currentIndex}
              onClick={() => handleTrackClick(index)}
              onRemove={() => removeTrack(track.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface PlaylistItemProps {
  track: Track
  index: number
  isActive: boolean
  isPlaying: boolean
  onClick: () => void
  onRemove: () => void
}

function PlaylistItem({ track, index, isActive, isPlaying, onClick, onRemove }: PlaylistItemProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer group border-b border-[#12121a] transition-colors ${
        isActive
          ? 'bg-violet-900/30 border-b-violet-900/20'
          : 'hover:bg-[#1a1a26]'
      }`}
      onClick={onClick}
    >
      <div className="w-6 text-center flex-shrink-0">
        {isPlaying ? (
          <div className="flex items-end justify-center gap-0.5 h-4">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1 bg-violet-500 rounded-sm animate-bounce"
                style={{ animationDelay: `${i * 0.15}s`, height: `${60 + i * 20}%` }}
              />
            ))}
          </div>
        ) : (
          <span className={`text-[10px] ${isActive ? 'text-violet-400' : 'text-slate-600'}`}>
            {index + 1}
          </span>
        )}
      </div>

      {track.coverArt && (
        <img src={track.coverArt} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className={`text-xs truncate ${isActive ? 'text-white font-medium' : 'text-slate-300'}`}>
          {track.title}
        </div>
        <div className="text-[10px] text-slate-600 truncate">{track.artist}</div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-slate-600 font-mono">{formatTime(track.duration)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all text-xs"
        >
          x
        </button>
      </div>
    </div>
  )
}
