import React from 'react'

declare global {
  interface Window {
    api: any
    electron: any
  }
}

const isMac = window.electron?.process?.platform === 'darwin'

export function TitleBar() {
  return (
    <div
      className="drag-region flex items-center h-9 bg-[#0a0a0f] border-b border-[#2a2a3e]"
      style={{ paddingLeft: isMac ? 80 : 12 }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center flex-shrink-0">
          <span className="text-[8px] font-bold text-white">O</span>
        </div>
        <span className="text-[11px] font-bold text-violet-400 tracking-widest uppercase">
          Orion Player
        </span>
      </div>

      {!isMac && (
        <div className="flex items-center h-full">
          <button
            onClick={() => window.api.minimize()}
            className="w-11 h-full flex items-center justify-center text-slate-500 hover:bg-[#1e1e2e] hover:text-slate-300 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Minimizar"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
              <rect width="10" height="1" />
            </svg>
          </button>
          <button
            onClick={() => window.api.maximize()}
            className="w-11 h-full flex items-center justify-center text-slate-500 hover:bg-[#1e1e2e] hover:text-slate-300 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Maximizar"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          </button>
          <button
            onClick={() => window.api.close()}
            className="w-11 h-full flex items-center justify-center text-slate-500 hover:bg-red-700 hover:text-white transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Fechar"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <line x1="0" y1="0" x2="10" y2="10" />
              <line x1="10" y1="0" x2="0" y2="10" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
