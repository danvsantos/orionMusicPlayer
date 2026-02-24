import { useEffect, useRef, useState } from 'react'

interface MarqueeProps {
  text: string
  speed?: number // px/s
  className?: string
}

export function Marquee({ text, speed = 42, className = '' }: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldScroll, setShouldScroll] = useState(false)
  const [duration, setDuration] = useState(10)

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current
      if (!container || !text) {
        setShouldScroll(false)
        return
      }

      // Use Canvas measureText for accurate width regardless of overflow clipping
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const styles = window.getComputedStyle(container)
      ctx.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`
      const textWidth = ctx.measureText(text).width
      const containerWidth = container.clientWidth

      if (textWidth > containerWidth) {
        setShouldScroll(true)
        // duration = travel distance (text + gap) divided by speed
        setDuration((textWidth + 64) / speed)
      } else {
        setShouldScroll(false)
      }
    }

    // rAF ensures layout is complete before measuring
    const raf = requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [text, speed])

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      {shouldScroll ? (
        <div
          className="marquee-track"
          style={{ '--marquee-dur': `${duration}s` } as React.CSSProperties}
        >
          <span className="pr-16 whitespace-nowrap">{text}</span>
          <span className="pr-16 whitespace-nowrap" aria-hidden>{text}</span>
        </div>
      ) : (
        <span className="whitespace-nowrap">{text}</span>
      )}
    </div>
  )
}
