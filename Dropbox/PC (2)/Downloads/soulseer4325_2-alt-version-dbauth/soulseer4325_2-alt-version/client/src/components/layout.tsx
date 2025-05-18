import { ReactNode } from "react";
import { Header } from "@/components/navigation/header";
import { Footer } from "@/components/navigation/footer";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col cosmic-bg">
      <Header />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
