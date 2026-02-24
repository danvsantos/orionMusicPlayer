import { useEffect, useRef, useState } from 'react'

interface MarqueeProps {
  text: string
  speed?: number // px/s
  className?: string
}

export function Marquee({ text, speed = 45, className = '' }: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [shouldScroll, setShouldScroll] = useState(false)
  const [duration, setDuration] = useState(10)

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current
      const span = textRef.current
      if (!container || !span) return
      const overflow = span.scrollWidth > container.clientWidth
      setShouldScroll(overflow)
      if (overflow) {
        // total travel = text width + gap (gap is 48px via pr-12)
        setDuration((span.scrollWidth + 48) / speed)
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [text, speed])

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      {shouldScroll ? (
        <div
          className="marquee-track"
          style={{ '--marquee-dur': `${duration}s` } as React.CSSProperties}
        >
          <span ref={textRef} className="pr-12 whitespace-nowrap">{text}</span>
          <span className="pr-12 whitespace-nowrap" aria-hidden>{text}</span>
        </div>
      ) : (
        <span ref={textRef} className="whitespace-nowrap">{text}</span>
      )}
    </div>
  )
}
