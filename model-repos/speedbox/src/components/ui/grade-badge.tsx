import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

export type Grade = "A+" | "A" | "B" | "C"

export function gradeForMbps(mbps: number): Grade {
  if (mbps > 500) return "A+"
  if (mbps > 200) return "A"
  if (mbps > 50) return "B"
  return "C"
}

const GRADE_STYLES: Record<Grade, string> = {
  "A+": "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  A: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  B: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  C: "border-destructive/40 bg-destructive/10 text-destructive",
}

export function GradeBadge({
  grade,
  className,
}: {
  grade: Grade
  className?: string
}) {
  return (
    <motion.span
      key={grade}
      initial={{ scale: 0, rotate: -20, opacity: 0 }}
      animate={{ scale: [0, 1.25, 1], rotate: [-20, 6, 0], opacity: 1 }}
      transition={{
        duration: 0.55,
        ease: [0.23, 1, 0.32, 1],
        times: [0, 0.6, 1],
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border-2 px-3 py-0.5 font-heading text-sm font-bold tracking-wide shadow-sm",
        GRADE_STYLES[grade],
        className
      )}
    >
      {grade}
    </motion.span>
  )
}
