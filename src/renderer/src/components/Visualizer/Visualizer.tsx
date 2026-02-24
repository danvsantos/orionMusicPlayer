import React, { useEffect, useRef } from 'react'

interface VisualizerProps {
  getAnalyser: () => AnalyserNode | null
  isPlaying: boolean
}

export function Visualizer({ getAnalyser, isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const draw = () => {
      const analyser = getAnalyser()
      const W = canvas.width
      const H = canvas.height

      if (!analyser || !isPlaying) {
        ctx.fillStyle = '#0a0a0f'
        ctx.fillRect(0, 0, W, H)
        // Draw flat line
        ctx.beginPath()
        ctx.strokeStyle = '#2a2a3e'
        ctx.lineWidth = 1
        ctx.moveTo(0, H / 2)
        ctx.lineTo(W, H / 2)
        ctx.stroke()
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, W, H)

      const barWidth = (W / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * H
        const ratio = i / bufferLength
        const r = Math.floor(124 + ratio * 80)
        const g = Math.floor(58 - ratio * 30)
        const b = Math.floor(237 - ratio * 80)

        const gradient = ctx.createLinearGradient(x, H - barHeight, x, H)
        gradient.addColorStop(0, `rgba(${r},${g},${b},0.9)`)
        gradient.addColorStop(1, `rgba(${r},${g},${b},0.2)`)

        ctx.fillStyle = gradient
        ctx.fillRect(x, H - barHeight, barWidth - 1, barHeight)
        x += barWidth + 1
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [getAnalyser, isPlaying])

  return (
    <canvas
      ref={canvasRef}
      width={340}
      height={60}
      className="w-full rounded"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
