import { create } from 'zustand'

export interface EQBand {
  frequency: number
  gain: number
  label: string
}

export interface EQPreset {
  name: string
  gains: number[]
}

export const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]
export const EQ_LABELS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K']

export const EQ_PRESETS: EQPreset[] = [
  { name: 'Normal', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Rock', gains: [4, 3, 2, 0, -1, -1, 2, 4, 5, 5] },
  { name: 'Jazz', gains: [3, 2, 1, 2, -2, -1, 0, 1, 2, 3] },
  { name: 'Pop', gains: [-1, 2, 4, 4, 2, 0, -1, -2, -2, -2] },
  { name: 'Electronic', gains: [5, 4, 1, -2, -2, 2, 1, 4, 5, 5] },
  { name: 'Classical', gains: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4] },
  { name: 'Hip-Hop', gains: [5, 4, 1, 3, -1, -1, 2, -1, 2, 3] },
  { name: 'Bass Boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
]

interface EqualizerState {
  bands: EQBand[]
  isEnabled: boolean
  currentPreset: string
  preampGain: number

  setBandGain: (index: number, gain: number) => void
  setEnabled: (enabled: boolean) => void
  applyPreset: (presetName: string) => void
  setPreampGain: (gain: number) => void
  resetEQ: () => void
}

const defaultBands: EQBand[] = EQ_FREQUENCIES.map((freq, i) => ({
  frequency: freq,
  gain: 0,
  label: EQ_LABELS[i]
}))

export const useEqualizerStore = create<EqualizerState>((set) => ({
  bands: defaultBands,
  isEnabled: true,
  currentPreset: 'Normal',
  preampGain: 0,

  setBandGain: (index, gain) => set((state) => {
    const bands = [...state.bands]
    bands[index] = { ...bands[index], gain: Math.max(-12, Math.min(12, gain)) }
    return { bands, currentPreset: 'Custom' }
  }),

  setEnabled: (isEnabled) => set({ isEnabled }),

  applyPreset: (presetName) => {
    const preset = EQ_PRESETS.find(p => p.name === presetName)
    if (!preset) return
    set((state) => ({
      bands: state.bands.map((band, i) => ({ ...band, gain: preset.gains[i] })),
      currentPreset: presetName
    }))
  },

  setPreampGain: (preampGain) => set({ preampGain: Math.max(-12, Math.min(12, preampGain)) }),

  resetEQ: () => set((state) => ({
    bands: state.bands.map(b => ({ ...b, gain: 0 })),
    currentPreset: 'Normal',
    preampGain: 0
  }))
}))
