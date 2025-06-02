import { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key-for-development';
// Defines the duration for which JWT tokens are valid. Default is '1d' (1 day).
// This can be made an environment variable (e.g., process.env.JWT_EXPIRES_IN) if more flexibility is needed.
const JWT_EXPIRES_IN = '1d';

/**
 * Generates a JWT token for a user.
 * @param user An object containing the user's id and role.
 * @returns The generated JWT token.
 */
export function generateToken(user: { id: string; role: string }): string {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// BCrypt salt rounds
const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt.
 * @param password The plaintext password to hash.
 * @returns A promise that resolves to the hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 * @param password The plaintext password to verify.
 * @param hash The stored hashed password.
 * @returns A promise that resolves to true if the password matches the hash, false otherwise.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

declare global {
  namespace Express {
    interface User extends SelectUser {} // SelectUser is `typeof users.$inferSelect`
    interface Request {
      user?: SelectUser; // User object based on our schema
      // isAuthenticated(): boolean; // This can be removed if not used by other parts of the app
                                  // or reimplemented if a similar check is needed.
                                  // For JWT, typically, if req.user exists, they are "authenticated".
    }
  }
}

/**
 * Defines the structure of the JWT payload.
 */
interface JwtPayload {
  userId: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Middleware to verify JWT token and set user in request.
 */
export const verifyJwtToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No token provided or incorrect format' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err) {
      // Handle specific JWT errors
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: 'Unauthorized - Token expired' });
      }
      if (err instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ message: 'Unauthorized - Invalid token' });
      }
      // Fallback for other errors during verification
      console.error('JWT verification error:', err);
      return res.status(401).json({ message: 'Unauthorized - Token verification failed' });
    }

    if (!decoded.userId) {
        return res.status(401).json({ message: 'Unauthorized - Invalid token payload' });
    }

    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized - User not found' });
    }

    // Attach user to request, ensuring it matches SelectUser from schema
    req.user = user;
    
    // Optionally, you might want to re-add isAuthenticated if your app relies on it elsewhere
    // req.isAuthenticated = () => !!req.user;

    next();
  } catch (error) {
    console.error('Error in verifyJwtToken middleware:', error);
    return res.status(500).json({ message: 'Internal server error during authentication' });
  }
};

/**
 * Setup authentication routes
 */
export function setupAuth(app: Express) {
  // Current user endpoint, now protected by JWT
  app.get("/api/user", verifyJwtToken, (req, res) => {
    if (!req.user) {
      // This case should ideally be handled by verifyJwtToken sending a 401
      // but as a safeguard:
      return res.status(401).json({ message: "Unauthorized - User not found after token verification" });
    }
    // req.user is populated by verifyJwtToken and is of type SelectUser
    // Exclude hashedPassword from the response
    const { hashedPassword, ...userResponse } = req.user;
    res.json(userResponse);
  });

  // New Register endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, fullName, role } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "User already exists with this email" });
      }

      const newHashedPassword = await hashPassword(password);

      const newUser = await storage.createUser({
        email,
        hashedPassword: newHashedPassword,
        fullName,
        role: role || 'client',
      });

      // Exclude hashedPassword from the response
      const { hashedPassword, ...userResponse } = newUser;

      res.status(201).json(userResponse);
    } catch (error) {
      console.error('Registration error:', error);
      // Check for unique constraint error if not already handled by getUserByEmail
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({ message: "User already exists with this email." });
      }
      res.status(500).json({ message: 'Failed to register user' });
    }
  });

  // New Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.hashedPassword) {
        console.error(`User with email ${email} has no hashed password set.`);
        return res.status(500).json({ message: "Authentication error" });
      }

      const isValidPassword = await verifyPassword(password, user.hashedPassword);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = generateToken({ id: user.id, role: user.role });

      // Exclude hashedPassword from the response
      const { hashedPassword, ...userResponse } = user;

      res.status(200).json({ token, user: userResponse });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Failed to login' });
    }
  });

  // New Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    // For JWT, logout is typically handled client-side by deleting the token.
    // Server can optionally maintain a blacklist of tokens if needed.
    res.status(200).json({ message: "Logged out successfully" });
  });
 
      // Return the created user
      const userResponse = { ...user } as SelectUser;
      delete userResponse.password; // This was for a plain password, not hashed
      
      res.status(201).json(userResponse);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Failed to register user' });
    }
  });
  */
}