import { create } from 'zustand'

export interface Track {
  id: string
  path: string
  filename: string
  title: string
  artist: string
  album: string
  duration: number
  coverArt?: string
  format: string
}

export type PlayMode = 'normal' | 'shuffle' | 'repeat-one' | 'repeat-all'

interface PlayerState {
  // Playlist
  tracks: Track[]
  currentIndex: number
  currentTrack: Track | null
  
  // Playback
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playMode: PlayMode
  
  // UI State
  activePanel: 'player' | 'equalizer' | 'youtube'
  isLoading: boolean
  
  // Actions
  setTracks: (tracks: Track[]) => void
  addTracks: (tracks: Track[]) => void
  removeTrack: (id: string) => void
  clearPlaylist: () => void
  setCurrentIndex: (index: number) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setIsMuted: (muted: boolean) => void
  setPlayMode: (mode: PlayMode) => void
  setActivePanel: (panel: 'player' | 'equalizer' | 'youtube') => void
  setIsLoading: (loading: boolean) => void
  
  // Computed actions
  playNext: () => void
  playPrevious: () => void
  sortByTitle: () => void
  sortByArtist: () => void
  sortByFilename: () => void
  shuffle: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  tracks: [],
  currentIndex: -1,
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  playMode: 'normal',
  activePanel: 'player',
  isLoading: false,

  setTracks: (tracks) => set({ tracks, currentIndex: tracks.length > 0 ? 0 : -1, currentTrack: tracks[0] || null }),
  
  addTracks: (newTracks) => set((state) => {
    const existingIds = new Set(state.tracks.map(t => t.id))
    const filtered = newTracks.filter(t => !existingIds.has(t.id))
    const tracks = [...state.tracks, ...filtered]
    return {
      tracks,
      currentIndex: state.currentIndex === -1 && tracks.length > 0 ? 0 : state.currentIndex,
      currentTrack: state.currentTrack || tracks[0] || null
    }
  }),

  removeTrack: (id) => set((state) => {
    const tracks = state.tracks.filter(t => t.id !== id)
    const removedIndex = state.tracks.findIndex(t => t.id === id)
    let currentIndex = state.currentIndex
    if (removedIndex < currentIndex) currentIndex--
    else if (removedIndex === currentIndex) currentIndex = Math.min(currentIndex, tracks.length - 1)
    return { tracks, currentIndex, currentTrack: tracks[currentIndex] || null }
  }),

  clearPlaylist: () => set({ tracks: [], currentIndex: -1, currentTrack: null, isPlaying: false }),

  setCurrentIndex: (index) => set((state) => ({
    currentIndex: index,
    currentTrack: state.tracks[index] || null
  })),

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setPlayMode: (playMode) => set({ playMode }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setIsLoading: (isLoading) => set({ isLoading }),

  playNext: () => {
    const { tracks, currentIndex, playMode } = get()
    if (tracks.length === 0) return
    let next: number
    if (playMode === 'shuffle') {
      next = Math.floor(Math.random() * tracks.length)
    } else if (playMode === 'repeat-one') {
      next = currentIndex
    } else {
      next = (currentIndex + 1) % tracks.length
    }
    set({ currentIndex: next, currentTrack: tracks[next] })
  },

  playPrevious: () => {
    const { tracks, currentIndex } = get()
    if (tracks.length === 0) return
    const prev = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1
    set({ currentIndex: prev, currentTrack: tracks[prev] })
  },

  sortByTitle: () => set((state) => {
    const sorted = [...state.tracks].sort((a, b) => a.title.localeCompare(b.title))
    const currentTrack = state.currentTrack
    const newIndex = currentTrack ? sorted.findIndex(t => t.id === currentTrack.id) : -1
    return { tracks: sorted, currentIndex: newIndex }
  }),

  sortByArtist: () => set((state) => {
    const sorted = [...state.tracks].sort((a, b) => a.artist.localeCompare(b.artist))
    const currentTrack = state.currentTrack
    const newIndex = currentTrack ? sorted.findIndex(t => t.id === currentTrack.id) : -1
    return { tracks: sorted, currentIndex: newIndex }
  }),

  sortByFilename: () => set((state) => {
    const sorted = [...state.tracks].sort((a, b) => a.filename.localeCompare(b.filename))
    const currentTrack = state.currentTrack
    const newIndex = currentTrack ? sorted.findIndex(t => t.id === currentTrack.id) : -1
    return { tracks: sorted, currentIndex: newIndex }
  }),

  shuffle: () => set((state) => {
    const shuffled = [...state.tracks]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const currentTrack = state.currentTrack
    const newIndex = currentTrack ? shuffled.findIndex(t => t.id === currentTrack.id) : -1
    return { tracks: shuffled, currentIndex: newIndex }
  })
}))
