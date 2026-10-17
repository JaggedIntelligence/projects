import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ButtonProps = React.ComponentProps<typeof Button>

/**
 * JuicyButton — a Button wrapper with:
 *  - breathing gradient halo behind the button
 *  - diagonal shine sweep on hover
 *  - exaggerated squish press
 *
 * Props forwarded to the underlying shadcn Button.
 */
export function JuicyButton({
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <span className="group/juicy relative isolate inline-flex">
      {/* Halo */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-1.5 rounded-[2.5rem] bg-[conic-gradient(from_0deg,var(--color-primary),var(--color-chart-2),var(--color-chart-4),var(--color-primary))] opacity-0 blur-lg transition-opacity duration-300",
          !disabled && "juicy-halo group-hover/juicy:opacity-90"
        )}
      />
      <Button
        {...props}
        disabled={disabled}
        className={cn(
          "relative z-10 overflow-hidden",
          // shine sweep
          "before:pointer-events-none before:absolute before:inset-y-0 before:-left-1/3 before:w-1/3 before:-skew-x-12 before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent before:opacity-0 before:transition-[transform,opacity] before:duration-700 before:ease-[cubic-bezier(0.23,1,0.32,1)] hover:before:translate-x-[400%] hover:before:opacity-100",
          // squish press — override base active:scale
          "active:not-aria-[haspopup]:scale-[0.94]",
          className
        )}
      >
        {children}
      </Button>
    </span>
  )
}
