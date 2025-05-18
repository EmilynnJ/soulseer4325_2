import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthHero } from "@/components/auth/auth-hero";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { StarField } from "@/components/ui/star-field";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("login");

  // If the user is already logged in, redirect to the homepage
  if (user && !isLoading) {
    return <Redirect to="/" />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center cosmic-bg">
        <div className="p-8 rounded-lg bg-dark/30 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] cosmic-bg relative flex flex-col items-center justify-center py-12 px-4 md:px-0">
      <StarField />
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Auth Forms Section */}
        <div className="z-10">
          <Tabs
            defaultValue="login"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full max-w-md mx-auto"
          >
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login" className="text-lg font-cinzel">Login</TabsTrigger>
              <TabsTrigger value="register" className="text-lg font-cinzel">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm onSuccess={() => {}} />
              <div className="text-center mt-4">
                <p className="text-light/70 font-playfair">
                  Don't have an account?{" "}
                  <button
                    onClick={() => setActiveTab("register")}
                    className="text-accent hover:text-accent-dark underline transition-colors font-playfair"
                  >
                    Register here
                  </button>
                </p>
              </div>
            </TabsContent>
            <TabsContent value="register">
              <RegisterForm onSuccess={() => {}} />
              <div className="text-center mt-4">
                <p className="text-light/70 font-playfair">
                  Already have an account?{" "}
                  <button
                    onClick={() => setActiveTab("login")}
                    className="text-accent hover:text-accent-dark underline transition-colors font-playfair"
                  >
                    Login here
                  </button>
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Hero Section */}
        <AuthHero />
      </div>
    </div>
  );
}
