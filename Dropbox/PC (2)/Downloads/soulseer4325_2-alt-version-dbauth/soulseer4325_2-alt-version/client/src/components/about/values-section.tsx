import { GlowCard } from "@/components/ui/glow-card";
import { Heart, Scale, User } from "lucide-react";

const values = [
  {
    icon: <Heart className="text-3xl" />,
    title: "Authenticity",
    description: "We believe in genuine connections and truthful guidance, never manipulating or exploiting those seeking help.",
    delay: 0
  },
  {
    icon: <Scale className="text-3xl" />,
    title: "Ethical Practice",
    description: "We uphold the highest ethical standards in all readings, communications, and business practices.",
    delay: 0.5
  },
  {
    icon: <User className="text-3xl" />,
    title: "Empowerment",
    description: "We aim to empower both our clients and readers, fostering growth, independence, and positive change.",
    delay: 1
  }
];

export function ValuesSection() {
  return (
    <div className="mb-20">
      <h2 className="text-3xl font-cinzel text-secondary text-center mb-10">Our Values</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {values.map((value, index) => (
          <GlowCard 
            key={index} 
            className="p-6 text-center"
            floating={true}
            delay={value.delay}
          >
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-accent/20 text-accent glow-circle">
              {value.icon}
            </div>
            <h3 className="text-xl font-cinzel text-secondary mb-3">{value.title}</h3>
            <p className="text-light/80">{value.description}</p>
          </GlowCard>
        ))}
      </div>
    </div>
  );
}
