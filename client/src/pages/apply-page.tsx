import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CelestialButton } from "@/components/ui/celestial-button";
import { GlowCard } from "@/components/ui/glow-card";
import { useToast } from "@/hooks/use-toast";

export default function ApplyPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [experience, setExperience] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, experience }),
      });
      if (res.ok) {
        toast({
          title: "Application submitted",
          description: "We'll review your information and reach out soon.",
        });
        setFullName("");
        setEmail("");
        setExperience("");
      } else {
        toast({
          title: "Submission failed",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Submission failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 min-h-screen flex items-center justify-center">
      <GlowCard className="max-w-lg w-full p-6 cosmic-bg">
        <h1 className="text-4xl font-alex mb-6 text-center text-secondary">Apply to Be a Reader</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-light mb-1 font-playfair">Full Name</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="bg-primary-light/30 border-accent-gold/30 text-gray-800 w-full"
            />
          </div>
          <div>
            <label className="block text-light mb-1 font-playfair">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-primary-light/30 border-accent-gold/30 text-gray-800 w-full"
            />
          </div>
          <div>
            <label className="block text-light mb-1 font-playfair">Experience</label>
            <Textarea
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              rows={4}
              className="bg-primary-light/30 border-accent-gold/30 text-gray-800 w-full"
            />
          </div>
          <CelestialButton type="submit" variant="primary" className="w-full">
            Submit Application
          </CelestialButton>
        </form>
      </GlowCard>
    </div>
  );
}
