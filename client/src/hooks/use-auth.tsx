import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User as FirebaseUser, UserCredential, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { auth } from "../lib/firebase";

type AuthContextType = {
  user: User | null;
  firebaseUser: FirebaseUser | null;
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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setIsLoading(true);
      try {
        if (fbUser) {
          // Get the ID token
          const token = await fbUser.getIdToken();
          setIdToken(token);
          setFirebaseUser(fbUser);
          
          // Fetch the user profile from our API
          const res = await apiRequest("GET", "/api/user");
          const userData = await res.json();
          setUser(userData);
        } else {
          setIdToken(null);
          setFirebaseUser(null);
          setUser(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      setIdToken(token);
      
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
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        userData.email, 
        userData.password
      );
      
      const token = await userCredential.user.getIdToken();
      setIdToken(token);
      
      // Create user profile in our backend
      const res = await apiRequest("POST", "/api/register", {
        fullName: userData.fullName,
        email: userData.email,
        role: userData.role || "client",
        firebaseUid: userCredential.user.uid
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
      await signOut(auth);
      setIdToken(null);
      setFirebaseUser(null);
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
        firebaseUser,
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
