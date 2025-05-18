// Script to create an admin user
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { config } from 'dotenv';
import pg from 'pg';

// Load environment variables
config();

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function createAdminUser() {
  // Create a PostgreSQL client
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    // Admin user details
    const username = 'emilynnj14';
    const email = 'emilynnj14@gmail.com';
    const password = 'JayJas1423!';
    
    // Check if user already exists
    const checkResult = await client.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (checkResult.rows.length > 0) {
      console.log('User already exists. Updating to admin role...');
      await client.query(
        'UPDATE users SET role = $1, password = $2 WHERE username = $3 OR email = $4',
        ['admin', await hashPassword(password), username, email]
      );
      console.log('User updated to admin successfully!');
    } else {
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Create the admin user
      const now = new Date();
      await client.query(
        `INSERT INTO users (
          username, email, password, role, "fullName", "createdAt", "lastActive", 
          "isOnline", "reviewCount", "accountBalance", verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          username, email, hashedPassword, 'admin', 'Admin User', 
          now, now, false, 0, 0, true
        ]
      );
      
      console.log('Admin user created successfully!');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

createAdminUser();