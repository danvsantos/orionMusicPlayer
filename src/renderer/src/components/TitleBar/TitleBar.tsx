import React from 'react'

declare global {
  interface Window {
    api: any
  }
}

export function TitleBar() {
  return (
    <div className="drag-region flex items-center h-9 bg-[#0a0a0f] border-b border-[#2a2a3e]" style={{ paddingLeft: 80 }}>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
          <span className="text-[8px] font-bold text-white">O</span>
        </div>
        <span className="text-[11px] font-bold text-violet-400 tracking-widest uppercase">
          Orion Player
        </span>
      </div>
    </div>
  )
}
