import React, { useEffect } from 'react'
import { TitleBar } from './components/TitleBar/TitleBar'
import { Player } from './components/Player/Player'
import { Playlist } from './components/Playlist/Playlist'
import { Equalizer } from './components/Equalizer/Equalizer'
import { YouTubeDownloader } from './components/YouTube/YouTubeDownloader'
import { usePlayerStore } from './store/playerStore'
import { useAudioEngine } from './hooks/useAudioEngine'

declare const __APP_VERSION__: string

export default function App() {
  const { activePanel, isPlaying, currentTrack, setIsPlaying, playNext, playPrevious } = usePlayerStore()
  const { seek, getAnalyser, outputDevices, currentDeviceId, setOutputDevice } = useAudioEngine()

  // Receive playback commands from tray / dock menu
  useEffect(() => {
    const cleanup = window.api.onPlayerControl((action: string) => {
      const state = usePlayerStore.getState()
      switch (action) {
        case 'toggle':   state.setIsPlaying(!state.isPlaying); break
        case 'next':     state.playNext(); break
        case 'previous': state.playPrevious(); break
        case 'stop':
          state.setIsPlaying(false)
          seek(0)
          break
      }
    })
    return cleanup
  }, [])

  // Keep tray menu in sync with current playback state
  useEffect(() => {
    window.api.updateTray({
      isPlaying,
      title: currentTrack?.title ?? 'Nenhuma faixa',
      artist: currentTrack?.artist ?? ''
    })
  }, [isPlaying, currentTrack])

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-white overflow-hidden">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Player controls */}
        <div className="w-80 flex-shrink-0 flex flex-col border-r border-[#2a2a3e] bg-[#0d0d15]">
          <Player
            seek={seek}
            getAnalyser={getAnalyser}
            outputDevices={outputDevices}
            currentDeviceId={currentDeviceId}
            setOutputDevice={setOutputDevice}
          />
        </div>

        {/* Right: Dynamic panel */}
        <div className="flex-1 overflow-hidden bg-[#0a0a0f]">
          {activePanel === 'player' && <Playlist />}
          {activePanel === 'equalizer' && <Equalizer />}
          {activePanel === 'youtube' && <YouTubeDownloader />}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 h-6 bg-[#07070e] border-t border-[#1a1a26] flex-shrink-0">
        <span className="text-[9px] text-slate-700 uppercase tracking-widest">Orion Player</span>
        <span className="text-[9px] text-slate-700">v{__APP_VERSION__}</span>
      </div>
    </div>
  )
}
