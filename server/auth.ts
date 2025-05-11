import { Express, Request, Response, NextFunction } from "express";
import { admin } from "./firebase-admin";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user?: SelectUser;
      isAuthenticated(): boolean;
    }
  }
}

/**
 * Middleware to verify Firebase ID token and set user in request
 */
export const verifyFirebaseToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if the Authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).json({ message: 'Unauthorized - Invalid token format' });
    }

    try {
      // Verify the token with Firebase Admin
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // Get the user from storage using Firebase UID
      const user = await storage.getUserByFirebaseUid(decodedToken.uid);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Set the user in the request object
      req.user = user;
      
      // Update last active time
      await storage.updateUser(user.id, { lastActive: new Date() });
      
      // Add isAuthenticated method to request
      req.isAuthenticated = () => !!req.user;
      
      next();
    } catch (error) {
      console.error('Error verifying Firebase token:', error);
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
  } catch (error) {
    console.error('Error in verifyFirebaseToken middleware:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Setup authentication routes
 */
export function setupAuth(app: Express) {
  // No need to set up Passport or sessions anymore
  
  // Current user endpoint
  app.get("/api/user", verifyFirebaseToken, (req, res) => {
    // User is already verified by middleware
    const userResponse = { ...req.user } as SelectUser;
    delete userResponse.password;
    
    res.json(userResponse);
  });
}
