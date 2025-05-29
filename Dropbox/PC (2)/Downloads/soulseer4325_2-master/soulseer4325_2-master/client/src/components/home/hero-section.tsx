import { Link } from "wouter";
import { PATHS } from "@/lib/constants";
import { CelestialButton } from "@/components/ui/celestial-button";
import { StarField } from "@/components/ui/star-field";

export function HeroSection() {
  return (
    <div className="flex flex-col items-center text-center py-8 md:py-12 mb-12 md:mb-20 relative overflow-hidden px-4">
      <StarField />
      
      {/* Content overlay */}
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-alex-brush mb-4 text-glow">
          <span className="text-accent">Soul</span>
          <span className="text-secondary">Seer</span>
        </h1>
        
        {/* Hero image between header and tagline */}
        <div className="flex justify-center mb-4">
          <img 
            src="/assets/images/soul-seer-logo.jpg" 
            alt="SoulSeer Logo" 
            className="w-48 md:w-60 rounded-full border-2 border-accent/40 shadow-glow"
          />
        </div>
        
        <p className="text-xl md:text-2xl font-playfair text-white mb-10 max-w-2xl mx-auto">
          A Community of Gifted Psychics
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
          <Link href={PATHS.READERS}>
            <CelestialButton variant="default" size="default" className="w-full">
              Readers
            </CelestialButton>
          </Link>
          
          <Link href={PATHS.LIVE}>
            <CelestialButton variant="secondary" size="default" className="w-full">
              Live Streams
            </CelestialButton>
          </Link>
          
          <Link href={PATHS.SHOP}>
            <CelestialButton variant="default" size="default" className="w-full">
              Shop
            </CelestialButton>
          </Link>
          
          <Link href={PATHS.COMMUNITY}>
            <CelestialButton variant="secondary" size="default" className="w-full">
              Community
            </CelestialButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
