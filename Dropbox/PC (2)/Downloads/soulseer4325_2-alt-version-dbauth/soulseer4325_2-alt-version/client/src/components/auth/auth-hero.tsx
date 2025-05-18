import { SoulSeerLogo } from "@/assets/svg/logo";
import { StarField } from "@/components/ui/star-field";

export function AuthHero() {
  return (
    <div className="hidden md:flex flex-col items-center justify-center text-center z-10 relative">
      <StarField />
      
      <div className="w-40 h-40 mb-6">
        <SoulSeerLogo className="w-full h-full" />
      </div>
      
      <h1 className="text-5xl font-alex mb-4">
        <span className="text-accent">Soul</span>
        <span className="text-secondary">Seer</span>
      </h1>
      
      <p className="text-xl text-light/80 mb-6 font-playfair">A Community of Gifted Psychics</p>
      
      <div className="max-w-md mx-auto">
        <ul className="space-y-4 text-left">
          <li className="flex items-center">
            <div className="w-6 h-6 mr-3 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-secondary">✓</span>
            </div>
            <span className="text-light/90 font-playfair">Connect with gifted psychics for spiritual guidance</span>
          </li>
          <li className="flex items-center">
            <div className="w-6 h-6 mr-3 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-secondary">✓</span>
            </div>
            <span className="text-light/90 font-playfair">Access on-demand readings and live streams</span>
          </li>
          <li className="flex items-center">
            <div className="w-6 h-6 mr-3 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-secondary">✓</span>
            </div>
            <span className="text-light/90 font-playfair">Join a community of spiritual seekers</span>
          </li>
          <li className="flex items-center">
            <div className="w-6 h-6 mr-3 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-secondary">✓</span>
            </div>
            <span className="text-light/90 font-playfair">Shop for mystical products and spiritual tools</span>
          </li>
        </ul>
      </div>
      
      <div className="mt-8 text-light/60 max-w-md">
        <p className="font-playfair italic">
          "SoulSeer has transformed my spiritual practice. The readings I've received have provided
          clarity and guidance during challenging times."
        </p>
        <p className="mt-2 text-accent font-playfair">— Sarah K., Member since 2024</p>
      </div>
    </div>
  );
}
