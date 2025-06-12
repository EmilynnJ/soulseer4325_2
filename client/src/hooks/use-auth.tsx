import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
// import { account, ID } from "../lib/appwrite"; // Appwrite import removed

type AuthContextType = {
  user: User | null;
  // appwriteUser: any | null; // Removed
  idToken: string | null; // This can represent the JWT token itself
  isLoading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<User>;
  loginMutation: UseMutationResult<User, Error, { email: string; password: string }>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  logoutMutation: UseMutationResult<void, Error, void>;
};

type RegisterData = {
  email: string;
  password: string;
  fullName: string;
  role?: "client" | "reader";
};

export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Provides authentication state and actions to child components via React context.
 *
 * Manages user authentication, including login, registration, logout, JWT token handling, and session persistence. Exposes authentication methods and React Query mutations for use in descendant components.
 *
 * @param children - React components that will have access to authentication context.
 *
 * @remark Throws errors from authentication actions if login, registration, or logout fail.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  // const [appwriteUser, setAppwriteUser] = useState<any | null>(null); // Removed
  const [idToken, setIdToken] = useState<string | null>(null); // Represents JWT
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      setIsLoading(true);
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        setIdToken(storedToken); // Set idToken so apiRequest can use it if needed immediately
        try {
          // apiRequest will now use localStorage token
          const res = await apiRequest("GET", "/api/user");
          const userData = await res.json();
          setUser(userData);
        } catch (err) {
          // If token is invalid (e.g., expired, server returns 401)
          // Call a simplified logout to clear state and token
          localStorage.removeItem('authToken');
          setUser(null);
          setIdToken(null);
          setError(err instanceof Error ? err : new Error(String(err)));
          console.error("Session check failed, logging out:", err);
        }
      }
      setIsLoading(false);
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const { token, user: userData } = await res.json();
      
      localStorage.setItem('authToken', token);
      setIdToken(token);
      setUser(userData);
      
      queryClient.setQueryData(['user'], userData); // Update react-query cache if you use it for user

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
      // First, register the user
      const registerRes = await apiRequest("POST", "/api/auth/register", {
        fullName: userData.fullName,
        email: userData.email,
        password: userData.password, // Send plain password to register endpoint
        role: userData.role || "client",
      });
      const registeredUser = await registerRes.json();

      // After successful registration, log the user in to get a token
      // Note: this calls the updated login function from this hook
      await login(userData.email, userData.password);
      
      // setUser is handled by the login function
      // setIdToken is handled by the login function
      // localStorage is handled by the login function

      toast({
        title: "Registration successful!",
        description: `Welcome to SoulSeer, ${registeredUser.fullName}`,
      });
      
      return registeredUser; // Or return the user from login() if preferred
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
      // Optional: Call backend logout endpoint if it does anything useful
      // await apiRequest("POST", "/api/auth/logout");

      localStorage.removeItem('authToken');
      setIdToken(null);
      setUser(null);
      
      queryClient.clear(); // Clear all react-query cache on logout
      
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

  // React Query mutations for components to consume
  const loginMutation = useMutation(
    ({ email, password }: { email: string; password: string }) =>
      login(email, password)
  );

  const registerMutation = useMutation((data: RegisterData) => register(data));

  const logoutMutation = useMutation(logout);

  return (
    <AuthContext.Provider
      value={{
        user,
        // appwriteUser, // Removed
        idToken,
        isLoading,
        error,
        login,
        logout,
        register,
        loginMutation,
        registerMutation,
        logoutMutation,
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
