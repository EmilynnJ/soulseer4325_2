import { ReactNode } from "react";
import { StarField } from "@/components/ui/star-field";

interface DashboardLayoutProps {
  title: string;
  children: ReactNode;
}

export function DashboardLayout({ title, children }: DashboardLayoutProps) {
  return (
    <div className="cosmic-bg min-h-screen relative pb-16">
      <StarField />
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6 text-center">{title}</h1>
        {children}
      </div>
    </div>
  );
}