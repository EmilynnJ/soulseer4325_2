export function SoulSeerLogo({ className }: { className?: string }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="logoGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#FF69B4" />
          <stop offset="100%" stopColor="#FF1493" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Circle */}
      <circle cx="100" cy="100" r="80" fill="url(#logoGradient)" filter="url(#glow)" />
      
      {/* Lotus/spiritual symbol */}
      <path
        d="M100 40 C120 60, 150 60, 150 100 C150 140, 120 160, 100 160 C80 160, 50 140, 50 100 C50 60, 80 60, 100 40"
        fill="none"
        stroke="#F5CB5C"
        strokeWidth="2"
      />
      <path
        d="M70 80 C80 60, 120 60, 130 80 C140 100, 120 140, 100 140 C80 140, 60 100, 70 80"
        fill="none"
        stroke="#F5CB5C"
        strokeWidth="2"
      />
      
      {/* Central star */}
      <circle cx="100" cy="100" r="15" fill="#FFFFFF" filter="url(#glow)" />
      
      {/* Decorative dots */}
      <circle cx="100" cy="60" r="5" fill="#F5CB5C" />
      <circle cx="140" cy="100" r="5" fill="#F5CB5C" />
      <circle cx="100" cy="140" r="5" fill="#F5CB5C" />
      <circle cx="60" cy="100" r="5" fill="#F5CB5C" />
    </svg>
  );
}
