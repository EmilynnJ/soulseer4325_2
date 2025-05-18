import { Link } from "wouter";
import { PATHS } from "@/lib/constants";
import { Instagram, Facebook, Twitter, Youtube, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CelestialButton } from "@/components/ui/celestial-button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function Footer() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();
  
  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    // In a real app, this would send the email to a backend service
    toast({
      title: "Thank you for subscribing!",
      description: "You'll now receive our mystical newsletter."
    });
    
    setEmail("");
  };
  
  return (
    <footer className="bg-primary-dark/80 backdrop-blur-lg border-t border-accent-gold/30 pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo & Description */}
          <div className="md:col-span-1">
            <Link href={PATHS.HOME} className="inline-block mb-4">
              <span className="text-3xl font-alexbrush text-accent">SoulSeer</span>
            </Link>
            <p className="text-light/70 mb-4 font-playfair">
              Connecting souls through ethical spiritual guidance and authentic psychic readings.
            </p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-light/70 hover:text-accent transition duration-300"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="text-light/70 hover:text-accent transition duration-300"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="text-light/70 hover:text-accent transition duration-300"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="text-light/70 hover:text-accent transition duration-300"
                aria-label="YouTube"
              >
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="text-secondary font-cinzel text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2 font-playfair">
              <li>
                <Link
                  href={PATHS.READERS}
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  Readers
                </Link>
              </li>
              <li>
                <Link
                  href={PATHS.LIVE}
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  Live Streams
                </Link>
              </li>
              <li>
                <Link
                  href={PATHS.SHOP}
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  Shop
                </Link>
              </li>
              <li>
                <Link
                  href={PATHS.COMMUNITY}
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  Community
                </Link>
              </li>
              <li>
                <Link
                  href={PATHS.ABOUT}
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  About Us
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Support */}
          <div>
            <h3 className="text-secondary font-cinzel text-lg mb-4">Support</h3>
            <ul className="space-y-2 font-playfair">
              <li>
                <Link
                  href={PATHS.HELP}
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href={PATHS.POLICIES}
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  Policies
                </Link>
              </li>
              <li>
                <Link
                  href={`${PATHS.POLICIES}#privacy`}
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href={`${PATHS.POLICIES}#terms`}
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="mailto:contact@soulseer.com"
                  className="text-light/70 hover:text-accent transition duration-300"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
          
          {/* Newsletter */}
          <div>
            <h3 className="text-secondary font-cinzel text-lg mb-4">Join Our Newsletter</h3>
            <p className="text-light/70 mb-4 font-playfair">
              Stay updated with the latest spiritual guidance and offers.
            </p>
            <form className="mb-4" onSubmit={handleNewsletterSubmit}>
              <div className="flex">
                <Input
                  type="email"
                  placeholder="Your email"
                  className="bg-primary-light border border-accent-gold/30 text-light rounded-l-full py-2 px-4 w-full focus:outline-none focus:ring-1 focus:ring-accent rounded-r-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <CelestialButton
                  type="submit"
                  variant="primary"
                  className="rounded-l-none rounded-r-full"
                  aria-label="Subscribe"
                >
                  <Mail className="h-4 w-4" />
                </CelestialButton>
              </div>
            </form>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="pt-6 border-t border-accent-gold/10 text-center">
          <p className="text-light/50 text-sm font-playfair">
            &copy; {new Date().getFullYear()} SoulSeer. All rights reserved. Made with 💜 for spiritual seekers everywhere.
          </p>
        </div>
      </div>
    </footer>
  );
}
