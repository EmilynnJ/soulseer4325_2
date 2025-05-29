import * as React from "react"
import { VariantProps, cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const celestialButtonVariants = cva(
  "celestial-button relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-accent/20 text-accent hover:bg-accent/30 border border-accent/40 backdrop-blur-sm",
        secondary: "bg-primary-dark/30 text-light hover:bg-primary-dark/40 border border-light/20 backdrop-blur-sm",
        destructive: "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/40 backdrop-blur-sm",
        outline: "border border-input bg-transparent hover:bg-accent/10 text-light hover:text-accent",
        ghost: "bg-transparent hover:bg-accent/10 text-accent hover:text-accent",
        link: "text-accent underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface CelestialButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof celestialButtonVariants> {
  asChild?: boolean
}

const CelestialButton = React.forwardRef<HTMLButtonElement, CelestialButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <Button
        className={cn(celestialButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)

CelestialButton.displayName = "CelestialButton"

export { CelestialButton, celestialButtonVariants }