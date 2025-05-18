import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface GlowCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  floating?: boolean;
  delay?: number;
}

const GlowCard = forwardRef<HTMLDivElement, GlowCardProps>(
  ({ className, children, hover = true, floating = false, delay = 0, ...props }, ref) => {
    const floatingStyle = floating
      ? { animationDelay: `${delay}s` }
      : {};
    
    return (
      <div
        ref={ref}
        className={cn(
          "glow-card rounded-2xl p-6",
          hover && "hover:shadow-lg hover:shadow-accent/50 hover:border-secondary/60",
          floating && "float-animation",
          className
        )}
        style={floatingStyle}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlowCard.displayName = "GlowCard";

export { GlowCard };
