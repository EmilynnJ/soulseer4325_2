import { useAuth } from "@/hooks/use-auth";
import { ClientDashboard } from "./client-dashboard";
import { ReaderDashboard } from "./reader-dashboard";
import { AdminDashboard } from "./admin-dashboard";
import { Loader2 } from "lucide-react";

export function Dashboard() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return null; // The protected route component will handle redirection
  }
  
  // Render the appropriate dashboard based on user role
  switch (user.role) {
    case "admin":
      return <AdminDashboard />;
    case "reader":
      return <ReaderDashboard />;
    case "client":
    default:
      return <ClientDashboard />;
  }
}