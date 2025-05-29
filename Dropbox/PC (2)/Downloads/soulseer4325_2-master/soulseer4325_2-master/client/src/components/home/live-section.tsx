import { useQuery } from "@tanstack/react-query";
import { Livestream } from "@shared/schema";
import { Link } from "wouter";
import { PATHS } from "@/lib/constants";
import { GlowCard } from "@/components/ui/glow-card";
import { MonitorPlay, Users } from "lucide-react";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Skeleton } from "@/components/ui/skeleton";

export function LiveSection() {
  const { data: livestreams, isLoading } = useQuery<Livestream[]>({
    queryKey: ["/api/livestreams"],
  });
  
  const activeLivestreams = livestreams?.filter(stream => stream.status === "live") || [];
  
  return (
    <div className="mb-20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-alex-brush text-secondary">Live Now</h2>
        <Link href={PATHS.LIVE} className="text-accent hover:text-accent-dark transition duration-300 flex items-center font-playfair">
          View All
          <svg
            className="ml-1 h-4 w-4"
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
        </Link>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, index) => (
            <GlowCard key={index}>
              <div className="relative">
                <Skeleton className="w-full h-48" />
              </div>
              <div className="p-4">
                <Skeleton className="h-6 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-10 w-full rounded-full" />
              </div>
            </GlowCard>
          ))}
        </div>
      ) : activeLivestreams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeLivestreams.slice(0, 3).map((livestream) => (
            <GlowCard key={livestream.id} className="rounded-2xl overflow-hidden p-0">
              <div className="relative">
                <img
                  src={livestream.thumbnailUrl}
                  alt={livestream.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
                  <MonitorPlay className="mr-1 h-3 w-3" />
                  <span>LIVE</span>
                </div>
                <div className="absolute top-2 right-2 bg-dark/70 text-white text-xs px-2 py-1 rounded-full flex items-center">
                  <Users className="mr-1 h-3 w-3" />
                  <span>{livestream.viewerCount} Viewers</span>
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="text-lg font-cinzel text-secondary mb-1">{livestream.title}</h3>
                <p className="text-accent text-sm mb-2 font-playfair">with {livestream.userId}</p>
                
                <Link href={`${PATHS.LIVE}/${livestream.id}`}>
                  <CelestialButton
                    variant="primary"
                    className="w-full bg-accent/80 hover:bg-accent"
                    size="sm"
                  >
                    Join Stream
                  </CelestialButton>
                </Link>
              </div>
            </GlowCard>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-light/70 font-playfair">No live streams at the moment. Check back later or browse scheduled events.</p>
          
          <Link href={PATHS.LIVE} className="mt-4 inline-block">
            <CelestialButton variant="secondary">
              See Upcoming Streams
            </CelestialButton>
          </Link>
        </div>
      )}
    </div>
  );
}
