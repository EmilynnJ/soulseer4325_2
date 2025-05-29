import { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { Client, Account } from 'appwrite';

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user?: SelectUser;
      isAuthenticated(): boolean;
    }
  }
}

// Initialize Appwrite client
const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('681831b30038fbc171cf');

const account = new Account(client);

export interface AuthUser {
    id: string;
    email: string;
    name?: string;
}

/**
 * Middleware to verify Appwrite JWT token and set user in request
 */
export const verifyAppwriteToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized - No token provided' });

    // Get the current user session
    const session = await account.getSession('current');
    if (!session) return res.status(401).json({ message: 'Unauthorized - Invalid token' });

    // Get user details
    const user = await account.get();
    
    req.user = {
      id: user.$id,
      email: user.email,
      name: user.name
    } as AuthUser;
    
    // Update last active time
    await storage.updateUser(req.user.id, { lastActive: new Date() });
    
    // Add isAuthenticated method to request
    req.isAuthenticated = () => !!req.user;
    
    return next();
  } catch (error) {
    console.error('Error verifying Appwrite token:', error);
    return res.status(401).json({ message: 'Unauthorized - Authentication failed' });
  }
};

/**
 * Setup authentication routes
 */
export function setupAuth(app: Express) {
  // Current user endpoint
  app.get("/api/user", verifyAppwriteToken, (req, res) => {
    // User is already verified by middleware
    const userResponse = { ...req.user } as AuthUser;
    
    res.json(userResponse);
  });

  // Register endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const { fullName, email, role, appwriteUid } = req.body;
      
      // Create user in our database
      const user = await storage.createUser({
        username: email.split('@')[0], // Generate username from email
        email,
        fullName,
        role: role || "client",
        appwriteUid // Store Appwrite UID instead of Firebase UID
      });
      
      // Return the created user
      const userResponse = { ...user } as SelectUser;
      delete userResponse.password;
      
      res.status(201).json(userResponse);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Failed to register user' });
    }
  });
}