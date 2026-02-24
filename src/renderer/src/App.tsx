import React from 'react'
import { TitleBar } from './components/TitleBar/TitleBar'
import { Player } from './components/Player/Player'
import { Playlist } from './components/Playlist/Playlist'
import { Equalizer } from './components/Equalizer/Equalizer'
import { YouTubeDownloader } from './components/YouTube/YouTubeDownloader'
import { usePlayerStore } from './store/playerStore'
import { useAudioEngine } from './hooks/useAudioEngine'

export default function App() {
  const { activePanel } = usePlayerStore()
  const { seek, getAnalyser } = useAudioEngine()

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-white overflow-hidden">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Player controls */}
        <div className="w-80 flex-shrink-0 flex flex-col border-r border-[#2a2a3e] bg-[#0d0d15]">
          <Player seek={seek} getAnalyser={getAnalyser} />
        </div>

        {/* Right: Dynamic panel */}
        <div className="flex-1 overflow-hidden bg-[#0a0a0f]">
          {activePanel === 'player' && <Playlist />}
          {activePanel === 'equalizer' && <Equalizer />}
          {activePanel === 'youtube' && <YouTubeDownloader />}
        </div>
      </div>
    </div>
  )
}
