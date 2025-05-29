// Script to create an admin user
import { createHash, randomBytes } from 'crypto';
import { config } from 'dotenv';
import pg from 'pg';

// Load environment variables
config();

const { Pool } = pg;

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
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Check if user already exists
    const existingUserResult = await pool.query(
      `SELECT * FROM users WHERE username = $1 OR email = $2 LIMIT 1`,
      [username, email]
    );
    
    if (existingUserResult.rows.length > 0) {
      console.log('User already exists. Updating to admin role...');
      await pool.query(
        `UPDATE users SET role = 'admin', password = $1, verified = true WHERE id = $2`,
        [hashedPassword, existingUserResult.rows[0].id]
      );
      console.log('Admin user updated successfully!');
    } else {
      // Create the admin user
      const now = new Date();
      const result = await pool.query(
        `INSERT INTO users (username, email, password, role, full_name, created_at, last_active, is_online, review_count, account_balance, verified) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [username, email, hashedPassword, 'admin', 'Admin User', now, now, false, 0, 0, true]
      );
      
      console.log('Admin user created successfully!', result.rows[0]);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    process.exit(0);
  }
}

createAdminUser();