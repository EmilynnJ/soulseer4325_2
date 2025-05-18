import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Star {
  id: number;
  top: string;
  left: string;
  size: number;
  animationDuration: number;
  animationDelay: number;
}

interface StarFieldProps {
  count?: number;
  className?: string;
}

export function StarField({ count = 50, className }: StarFieldProps) {
  const [stars, setStars] = useState<Star[]>([]);
  
  useEffect(() => {
    const generateStars = () => {
      const starArray: Star[] = [];
      
      for (let i = 0; i < count; i++) {
        starArray.push({
          id: i,
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          size: Math.random() * 3 + 1, // 1-4px
          animationDuration: Math.random() * 3 + 2, // 2-5s
          animationDelay: Math.random() * 5, // 0-5s
        });
      }
      
      setStars(starArray);
    };
    
    generateStars();
  }, [count]);
  
  return (
    <div className={cn("absolute inset-0 z-0 overflow-hidden pointer-events-none", className)}>
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute bg-white rounded-full opacity-0 animate-sparkle"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDuration: `${star.animationDuration}s`,
            animationDelay: `${star.animationDelay}s`,
            boxShadow: `0 0 ${star.size}px #fff, 0 0 ${star.size * 2}px #fff`
          }}
        />
      ))}
    </div>
  );
}
