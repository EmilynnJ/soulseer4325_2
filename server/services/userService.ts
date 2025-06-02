import { db } from '../db';
import { users, User } from '../../shared/schema'; // Import User type and users table
import { eq } from 'drizzle-orm';

export const findUserByEmail = async (email: string): Promise<User | undefined> => {
  // Use Drizzle query builder
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
};

export const createUser = async (email: string, hashedPasswordVal: string, roleVal: "admin" | "reader" | "client"): Promise<User> => {
  // Use Drizzle query builder and correct column name
  const result = await db.insert(users).values({
    email: email,
    hashedPassword: hashedPasswordVal, // Corrected column name
    role: roleVal,
    // createdAt will be handled by defaultNow() in the schema
    // updatedAt will be handled by defaultNow() in the schema
  }).returning();
  return result[0];
};
