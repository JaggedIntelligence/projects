import { useEffect } from "react"
import { animate, motion, useMotionValue, useTransform } from "framer-motion"

interface CountUpProps {
  value: number
  decimals?: number
  duration?: number
  className?: string
  formatter?: (value: number) => string
}

/**
 * CountUp — animates a number from its previous value to the new one using a
 * strong ease-out curve. Respects prefers-reduced-motion by snapping instantly.
 */
export function CountUp({
  value,
  decimals = 1,
  duration = 0.9,
  className,
  formatter,
}: CountUpProps) {
  const mv = useMotionValue(value)
  const display = useTransform(mv, (v) =>
    formatter ? formatter(v) : v.toFixed(decimals)
  )

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.23, 1, 0.32, 1],
    })
    return () => controls.stop()
  }, [value, duration, mv])

  return <motion.span className={className}>{display}</motion.span>
}
