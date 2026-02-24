import React from 'react'
import { useEqualizerStore, EQ_PRESETS } from '../../store/equalizerStore'

export function Equalizer() {
  const { bands, isEnabled, currentPreset, preampGain, setBandGain, setEnabled, applyPreset, setPreampGain, resetEQ } = useEqualizerStore()

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Equalizador</span>
          <button
            onClick={() => setEnabled(!isEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${isEnabled ? 'bg-violet-600' : 'bg-[#2a2a3e]'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <button onClick={resetEQ} className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
          RESET
        </button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1 mb-4">
        {EQ_PRESETS.map(preset => (
          <button
            key={preset.name}
            onClick={() => applyPreset(preset.name)}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors font-medium ${
              currentPreset === preset.name
                ? 'bg-violet-600 text-white'
                : 'bg-[#1a1a26] text-slate-500 hover:text-slate-300 hover:bg-[#2a2a3e]'
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* EQ Bands */}
      <div className="flex gap-2 flex-1 items-end justify-center">
        {/* Preamp */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] text-violet-400 font-mono">
            {preampGain > 0 ? '+' : ''}{preampGain.toFixed(0)}
          </span>
          <div className="relative h-32 flex items-center justify-center">
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={preampGain}
              onChange={(e) => setPreampGain(parseFloat(e.target.value))}
              disabled={!isEnabled}
              className="h-28 cursor-pointer disabled:opacity-30"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                WebkitAppearance: 'slider-vertical',
                width: '20px'
              } as React.CSSProperties}
            />
          </div>
          <div className="w-px h-3 bg-violet-600 mx-auto" />
          <span className="text-[9px] text-violet-400 font-bold">PRE</span>
        </div>

        <div className="w-px h-32 bg-[#2a2a3e] self-center" />

        {/* 10 bands */}
        {bands.map((band, index) => (
          <div key={band.frequency} className="flex flex-col items-center gap-1">
            <span className={`text-[9px] font-mono ${band.gain > 0 ? 'text-violet-400' : band.gain < 0 ? 'text-amber-500' : 'text-slate-600'}`}>
              {band.gain > 0 ? '+' : ''}{band.gain.toFixed(0)}
            </span>
            <div className="relative h-32 flex items-center justify-center">
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={band.gain}
                onChange={(e) => setBandGain(index, parseFloat(e.target.value))}
                disabled={!isEnabled}
                className="h-28 cursor-pointer disabled:opacity-30"
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  WebkitAppearance: 'slider-vertical',
                  width: '20px'
                } as React.CSSProperties}
              />
            </div>
            <span className="text-[9px] text-slate-600">{band.label}</span>
          </div>
        ))}
      </div>

      <div className="text-center mt-2">
        <span className="text-[10px] text-slate-700">-12dB to +12dB</span>
      </div>
    </div>
  )
}
