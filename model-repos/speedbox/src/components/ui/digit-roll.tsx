import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

interface DigitRollProps {
  value: number
  decimals?: number
  className?: string
  /** Character height in px. Controls column size. */
  size?: number
  formatter?: (value: number) => string
}

/**
 * DigitRoll — mechanical odometer. Each digit is its own vertical strip of
 * 0–9 that springs to the target position. Decimal separator + minus sign
 * rendered statically. Designed for large display numerics.
 */
export function DigitRoll({
  value,
  decimals = 1,
  className,
  size = 56,
  formatter,
}: DigitRollProps) {
  const text = formatter ? formatter(value) : value.toFixed(decimals)
  return (
    <span
      className={cn("inline-flex items-center tabular-nums", className)}
      style={{ height: size, lineHeight: `${size}px` }}
      aria-label={text}
    >
      {text.split("").map((ch, i) => {
        if (/[0-9]/.test(ch)) {
          return <Column key={i} digit={Number(ch)} size={size} index={i} />
        }
        return (
          <span
            key={i}
            style={{ height: size, lineHeight: `${size}px` }}
            className="inline-block"
          >
            {ch}
          </span>
        )
      })}
    </span>
  )
}

function Column({
  digit,
  size,
  index,
}: {
  digit: number
  size: number
  index: number
}) {
  return (
    <span
      className="relative inline-block overflow-hidden align-top"
      style={{ height: size, width: size * 0.6 }}
    >
      <motion.span
        className="block"
        initial={false}
        animate={{ y: -digit * size }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 28,
          delay: index * 0.02,
        }}
      >
        {Array.from({ length: 10 }).map((_, n) => (
          <span
            key={n}
            className="block text-center"
            style={{ height: size, lineHeight: `${size}px` }}
          >
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}
