import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { useEqualizerStore } from '../store/equalizerStore'

export function useAudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const preampRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const eqFiltersRef = useRef<BiquadFilterNode[]>([])
  const isConnectedRef = useRef(false)

  const {
    currentTrack, isPlaying, volume, isMuted, playMode,
    setIsPlaying, setCurrentTime, setDuration, setIsLoading,
    playNext
  } = usePlayerStore()

  // Refs to avoid stale closures in event listeners
  const playModeRef = useRef(playMode)
  const playNextRef = useRef(playNext)
  useEffect(() => { playModeRef.current = playMode }, [playMode])
  useEffect(() => { playNextRef.current = playNext }, [playNext])

  const { bands, isEnabled, preampGain } = useEqualizerStore()

  // Initialize audio context and nodes
  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return

    const ctx = new AudioContext()
    audioContextRef.current = ctx

    // Create nodes
    const gainNode = ctx.createGain()
    const preamp = ctx.createGain()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8

    gainNodeRef.current = gainNode
    preampRef.current = preamp
    analyserRef.current = analyser

    // Create 10-band EQ
    const filters = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000].map((freq, i) => {
      const filter = ctx.createBiquadFilter()
      filter.type = i === 0 ? 'lowshelf' : i === 9 ? 'highshelf' : 'peaking'
      filter.frequency.value = freq
      filter.gain.value = 0
      filter.Q.value = 1.4
      return filter
    })
    eqFiltersRef.current = filters

    // Connect chain: gain -> preamp -> eq filters -> analyser -> destination
    gainNode.connect(preamp)
    preamp.connect(filters[0])
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1])
    }
    filters[filters.length - 1].connect(analyser)
    analyser.connect(ctx.destination)
  }, [])

  // Connect audio element to context
  const connectAudio = useCallback((audio: HTMLAudioElement) => {
    if (!audioContextRef.current || isConnectedRef.current) return
    const ctx = audioContextRef.current

    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const source = ctx.createMediaElementSource(audio)
    sourceRef.current = source
    source.connect(gainNodeRef.current!)
    isConnectedRef.current = true
  }, [])

  // Setup audio element
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime))
    audio.addEventListener('durationchange', () => setDuration(audio.duration))
    audio.addEventListener('ended', () => {
      if (playModeRef.current === 'repeat-one') {
        audio.currentTime = 0
        audio.play()
      } else {
        playNextRef.current()
      }
    })
    audio.addEventListener('loadstart', () => setIsLoading(true))
    audio.addEventListener('canplay', () => setIsLoading(false))
    audio.addEventListener('error', () => {
      setIsLoading(false)
      setIsPlaying(false)
    })

    initAudioContext()

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Load track when it changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return
    const audio = audioRef.current

    // Normalize Windows backslashes and add triple-slash for drive letters (C:\...)
    const p = currentTrack.path.replace(/\\/g, '/')
    audio.src = /^[a-zA-Z]:/.test(p) ? `file:///${p}` : `file://${p}`
    audio.load()

    if (isPlaying) {
      // Resume AudioContext if suspended (browser policy)
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume()
      }
      audio.play().catch(console.error)
    }
  }, [currentTrack])

  // Play/pause
  useEffect(() => {
    if (!audioRef.current) return
    const audio = audioRef.current

    if (isPlaying) {
      // Connect to audio context on first play
      if (!isConnectedRef.current) {
        initAudioContext()
        connectAudio(audio)
      }
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume()
      }
      audio.play().catch(console.error)
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // EQ bands
  useEffect(() => {
    eqFiltersRef.current.forEach((filter, i) => {
      filter.gain.value = isEnabled ? bands[i].gain : 0
    })
  }, [bands, isEnabled])

  // Preamp
  useEffect(() => {
    if (preampRef.current) {
      const gainValue = isEnabled ? Math.pow(10, preampGain / 20) : 1
      preampRef.current.gain.value = gainValue
    }
  }, [preampGain, isEnabled])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }, [])

  const getAnalyser = useCallback(() => analyserRef.current, [])

  return { seek, getAnalyser, audioRef }
}
