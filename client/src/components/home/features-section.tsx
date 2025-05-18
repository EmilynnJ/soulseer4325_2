import { GlowCard } from "@/components/ui/glow-card";
import { Link } from "wouter";
import { PATHS } from "@/lib/constants";
import { Users, MonitorPlay, Store, MessagesSquare } from "lucide-react";

const features = [
  {
    icon: <Users className="text-lg" />,
    title: "Readers",
    description: "Connect with gifted psychics specializing in tarot, astrology, and more.",
    link: PATHS.READERS,
    linkText: "Browse",
    delay: 0
  },
  {
    icon: <MonitorPlay className="text-lg" />,
    title: "Live Streams",
    description: "Join live events featuring psychic readings and spiritual healing.",
    link: PATHS.LIVE,
    linkText: "Watch",
    delay: 0.3
  },
  {
    icon: <Store className="text-lg" />,
    title: "Shop",
    description: "Discover mystical products and tools for your spiritual journey.",
    link: PATHS.SHOP,
    linkText: "Shop",
    delay: 0.1
  },
  {
    icon: <MessagesSquare className="text-lg" />,
    title: "Community",
    description: "Connect with like-minded spiritual seekers in our forum.",
    link: PATHS.COMMUNITY,
    linkText: "Join",
    delay: 0.2
  }
];

export function FeaturesSection() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
      {features.map((feature, index) => (
        <GlowCard
          key={index}
          floating={true}
          delay={feature.delay}
          className="rounded-lg p-3"
        >
          <div className="flex flex-col items-center text-center mb-1.5">
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-accent/10 text-accent mb-1.5">
              {feature.icon}
            </div>
            <h3 className="text-base font-cinzel text-secondary leading-tight">{feature.title}</h3>
          </div>
          
          <p className="text-light/70 mb-2 text-xs text-center font-playfair line-clamp-2">{feature.description}</p>
          
          <div className="text-center">
            <Link href={feature.link}>
              <span className="inline-flex items-center text-accent hover:text-accent-dark transition duration-300 text-xs">
                {feature.linkText}
                <svg
                  className="ml-0.5 h-2.5 w-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </span>
            </Link>
          </div>
        </GlowCard>
      ))}
    </div>
  );
}
