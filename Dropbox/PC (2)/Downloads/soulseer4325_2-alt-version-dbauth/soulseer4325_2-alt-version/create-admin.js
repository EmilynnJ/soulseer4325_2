// Script to create an admin user
import { createHash, randomBytes } from 'crypto';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import { users } from './shared/schema.js';
import { eq, or } from 'drizzle-orm';

// Load environment variables
config();

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256');
  hash.update(password + salt);
  const hashedPassword = hash.digest('hex');
  return `${hashedPassword}.${salt}`;
}

async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    
    // Admin user details
    const username = 'emilynnj14';
    const email = 'emilynnj14@gmail.com';
    const password = 'JayJas1423!';
    
    // Connect to database
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(
      or(
        eq(users.username, username),
        eq(users.email, email)
      )
    ).limit(1);
    
    if (existingUser.length > 0) {
      console.log('User already exists. Updating to admin role...');
      await db.update(users)
        .set({
          role: 'admin',
          password: hashedPassword,
          verified: true
        })
        .where(eq(users.id, existingUser[0].id));
      console.log('Admin user updated successfully!');
      return;
    }
    
    // Create the admin user
    const now = new Date();
    const result = await db.insert(users).values({
      username,
      email,
      password: hashedPassword,
      role: 'admin',
      fullName: 'Admin User',
      createdAt: now,
      lastActive: now,
      isOnline: false,
      reviewCount: 0,
      accountBalance: 0,
      verified: true
    }).returning();
    
    console.log('Admin user created successfully!', result[0]);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    process.exit(0);
  }
}

createAdminUser();