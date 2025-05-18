import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { account, ID } from "../lib/appwrite";

type AuthContextType = {
  user: User | null;
  appwriteUser: any | null;
  idToken: string | null;
  isLoading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<User>;
};

type RegisterData = {
  email: string;
  password: string;
  fullName: string;
  role?: "client" | "reader";
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [appwriteUser, setAppwriteUser] = useState<any | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Check for Appwrite session on mount
  useEffect(() => {
    const checkSession = async () => {
      setIsLoading(true);
      try {
        // Get current session
        const session = await account.getSession('current');
        if (session) {
          // Get current user
          const awUser = await account.get();
          setAppwriteUser(awUser);
          
          // Get JWT token for API requests
          const jwt = await account.createJWT();
          setIdToken(jwt.jwt);
          
          // Fetch the user profile from our API
          const res = await apiRequest("GET", "/api/user");
          const userData = await res.json();
          setUser(userData);
        } else {
          setIdToken(null);
          setAppwriteUser(null);
          setUser(null);
        }
      } catch (err) {
        // If error is 401 Unauthorized, user is not logged in
        if (err instanceof Error && err.message.includes('401')) {
          setIdToken(null);
          setAppwriteUser(null);
          setUser(null);
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      // Login with Appwrite
      const session = await account.createEmailSession(email, password);
      
      // Get current user
      const awUser = await account.get();
      setAppwriteUser(awUser);
      
      // Get JWT token for API requests
      const jwt = await account.createJWT();
      setIdToken(jwt.jwt);
      
      // Fetch user profile
      const res = await apiRequest("GET", "/api/user");
      const userData = await res.json();
      setUser(userData);
      
      toast({
        title: "Welcome back!",
        description: `You're now logged in as ${userData.fullName}`,
      });
      
      return userData;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const register = async (userData: RegisterData): Promise<User> => {
    try {
      // Create Appwrite user
      const awUser = await account.create(
        ID.unique(),
        userData.email,
        userData.password,
        userData.fullName
      );
      
      // Login after registration
      await account.createEmailSession(userData.email, userData.password);
      setAppwriteUser(awUser);
      
      // Get JWT token for API requests
      const jwt = await account.createJWT();
      setIdToken(jwt.jwt);
      
      // Create user profile in our backend
      const res = await apiRequest("POST", "/api/register", {
        fullName: userData.fullName,
        email: userData.email,
        role: userData.role || "client",
        appwriteUid: awUser.$id
      });
      
      const createdUser = await res.json();
      setUser(createdUser);
      
      toast({
        title: "Registration successful!",
        description: `Welcome to SoulSeer, ${createdUser.fullName}`,
      });
      
      return createdUser;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Delete all sessions
      await account.deleteSessions();
      setIdToken(null);
      setAppwriteUser(null);
      setUser(null);
      
      // Clear any cached data
      queryClient.clear();
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        appwriteUser,
        idToken,
        isLoading,
        error,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
