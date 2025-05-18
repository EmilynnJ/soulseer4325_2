import { FounderSection } from "@/components/about/founder-section";
import { ValuesSection } from "@/components/about/values-section";
import { StarField } from "@/components/ui/star-field";

export default function AboutPage() {
  return (
    <div className="py-16 cosmic-bg relative min-h-screen">
      <StarField />
      <div className="container mx-auto px-4">
        <FounderSection />
        <ValuesSection />
      </div>
    </div>
  );
}
