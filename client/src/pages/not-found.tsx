import { Card, CardContent } from "@/components/ui/card";
import { Stars, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center cosmic-bg">
      <Card className="w-full max-w-md mx-4 bg-dark/80 border-accent/30 backdrop-blur-md">
        <CardContent className="pt-6 text-center">
          <div className="flex flex-col items-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Sparkles className="h-6 w-6 text-accent" />
              <Stars className="h-8 w-8 text-secondary" />
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <h1 className="text-4xl font-alex text-accent mb-2">404</h1>
            <h2 className="text-2xl font-cinzel text-secondary">Page Not Found</h2>
          </div>

          <p className="mt-6 font-playfair text-light/80">
            The mystical path you seek is beyond our realm.
          </p>
          
          <div className="mt-8 mb-2">
            <Link href="/">
              <Button className="font-playfair bg-dark hover:bg-dark/70 text-accent border border-accent/50">
                Return to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
