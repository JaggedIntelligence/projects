import * as React from "react"
import { cn } from "@/lib/utils"

interface Button3DProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "primary" | "danger"
}

type Palette = {
  face: string
  faceHover: string
  base: string
  border: string
  text: string
  lift: string
}

const PALETTES: Record<NonNullable<Button3DProps["tone"]>, Palette> = {
  primary: {
    face: "#fbbf24",
    faceHover: "#fcd34d",
    base: "#f59e0b",
    border: "#18181b",
    text: "#18181b",
    lift: "#f97316",
  },
  danger: {
    face: "#ef4444",
    faceHover: "#f87171",
    base: "#dc2626",
    border: "#18181b",
    text: "#fff7ed",
    lift: "#b91c1c",
  },
}

/**
 * Pushable 3D button. The ::before layer sits behind the face and carries a
 * double box-shadow (border ring + offset "lift"). Hover drops the face 0.25em
 * and shrinks the lift; active slams it flush so the button feels pressed.
 */
export const Button3D = React.forwardRef<HTMLButtonElement, Button3DProps>(
  (
    { className, children, tone = "primary", disabled, style, ...props },
    ref
  ) => {
    const p = PALETTES[tone]

    const cssVars: React.CSSProperties = {
      ["--face" as string]: p.face,
      ["--face-hover" as string]: p.faceHover,
      ["--base" as string]: p.base,
      ["--border" as string]: p.border,
      ["--lift" as string]: p.lift,
      color: p.text,
      WebkitTapHighlightColor: "transparent",
      ...style,
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        style={cssVars}
        className={cn(
          "btn3d relative inline-flex cursor-pointer items-center justify-center select-none",
          "rounded-[0.75em] border-[3px] px-8 py-4",
          "font-heading text-base font-extrabold tracking-[0.08em] uppercase outline-none",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-60",
          className
        )}
        {...props}
      >
        <span aria-hidden className="btn3d-sheen-wrap" />
        <span className="relative z-10">{children}</span>
      </button>
    )
  }
)
Button3D.displayName = "Button3D"
