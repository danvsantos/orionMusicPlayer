import React, { useCallback } from 'react'
import { usePlayerStore } from '../../store/playerStore'
import { useEqualizerStore } from '../../store/equalizerStore'
import { formatTime } from '../../utils/time'
import { Visualizer } from '../Visualizer/Visualizer'

interface PlayerProps {
  seek: (time: number) => void
  getAnalyser: () => AnalyserNode | null
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M8 5v14l11-7z"/>
  </svg>
)

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
)

const NextIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
  </svg>
)

const PrevIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
  </svg>
)

const ShuffleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
  </svg>
)

const RepeatIcon = ({ mode }: { mode: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    {mode === 'repeat-one' ? (
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/>
    ) : (
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
    )}
  </svg>
)

const VolumeIcon = ({ muted, volume }: { muted: boolean; volume: number }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    {muted || volume === 0 ? (
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
    ) : volume < 0.5 ? (
      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
    ) : (
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    )}
  </svg>
)

export function Player({ seek, getAnalyser }: PlayerProps) {
  const {
    currentTrack, isPlaying, currentTime, duration, volume, isMuted, playMode,
    setIsPlaying, setVolume, setIsMuted, setPlayMode, playNext, playPrevious,
    setActivePanel, activePanel
  } = usePlayerStore()

  const { isEnabled, setEnabled } = useEqualizerStore()

  const togglePlay = useCallback(() => {
    if (!currentTrack) return
    setIsPlaying(!isPlaying)
  }, [isPlaying, currentTrack])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value))
  }, [seek])

  const handleVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value))
    if (isMuted) setIsMuted(false)
  }, [isMuted])

  const cyclePlayMode = useCallback(() => {
    const modes: Array<'normal' | 'shuffle' | 'repeat-one' | 'repeat-all'> = ['normal', 'shuffle', 'repeat-all', 'repeat-one']
    const current = modes.indexOf(playMode)
    setPlayMode(modes[(current + 1) % modes.length])
  }, [playMode])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex flex-col h-full">
      {/* Cover Art + Track Info */}
      <div className="flex items-center gap-4 p-4">
        <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#1a1a26] border border-[#2a2a3e]">
          {currentTrack?.coverArt ? (
            <img
              src={currentTrack.coverArt}
              alt="Cover"
              className={`w-full h-full object-cover ${isPlaying ? 'vinyl-spin' : 'vinyl-spin vinyl-spin-paused'}`}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${isPlaying ? 'vinyl-spin' : ''}`}>
              <div className="w-12 h-12 rounded-full border-2 border-violet-600 flex items-center justify-center bg-[#0a0a0f]">
                <div className="w-3 h-3 rounded-full bg-violet-500" />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">
            {currentTrack?.title || 'No Track Selected'}
          </div>
          <div className="text-xs text-violet-400 truncate mt-0.5">
            {currentTrack?.artist || '---'}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {currentTrack?.album || '---'}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-600 font-mono">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-slate-700">/</span>
            <span className="text-[10px] text-slate-600 font-mono">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Visualizer */}
      <div className="px-4 pb-2">
        <Visualizer getAnalyser={getAnalyser} isPlaying={isPlaying} />
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full no-drag"
          style={{
            background: `linear-gradient(to right, #7c3aed ${progress}%, #2a2a3e ${progress}%)`
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={cyclePlayMode}
            className={`p-1.5 rounded transition-colors no-drag ${
              playMode !== 'normal'
                ? 'text-violet-400 bg-violet-900/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={`Mode: ${playMode}`}
          >
            {playMode === 'shuffle' ? <ShuffleIcon /> : <RepeatIcon mode={playMode} />}
          </button>
        </div>

        <div className="flex items-center gap-2 no-drag">
          <button
            onClick={playPrevious}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <PrevIcon />
          </button>
          <button
            onClick={togglePlay}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all no-drag ${
              isPlaying
                ? 'bg-violet-600 hover:bg-violet-500 text-white glow-active'
                : 'bg-[#1a1a26] hover:bg-[#2a2a3e] text-violet-400 border border-violet-700'
            }`}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            onClick={playNext}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <NextIcon />
          </button>
        </div>

        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <VolumeIcon muted={isMuted} volume={volume} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={handleVolume}
            className="w-16 no-drag"
            style={{
              background: `linear-gradient(to right, #7c3aed ${(isMuted ? 0 : volume) * 100}%, #2a2a3e ${(isMuted ? 0 : volume) * 100}%)`
            }}
          />
        </div>
      </div>

      {/* Panel Tabs */}
      <div className="flex border-t border-[#2a2a3e] no-drag">
        {(['player', 'equalizer', 'youtube'] as const).map(panel => (
          <button
            key={panel}
            onClick={() => setActivePanel(panel)}
            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activePanel === panel
                ? 'text-violet-400 bg-violet-900/20 border-t border-violet-600'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            {panel === 'youtube' ? 'YouTube' : panel === 'equalizer' ? 'EQ' : 'Playlist'}
          </button>
        ))}
      </div>
    </div>
  )
}
