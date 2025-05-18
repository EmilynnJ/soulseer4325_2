import { db } from '../db';
import { sql } from 'drizzle-orm';
import { query } from '../database';

export async function up() {
  console.log('Creating gifts table...');
  
  // Create the gifts table
  await query(`
    CREATE TABLE IF NOT EXISTS gifts (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      livestream_id INTEGER REFERENCES livestreams(id),
      amount INTEGER NOT NULL,
      gift_type TEXT NOT NULL,
      message TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      reader_amount INTEGER NOT NULL,
      platform_amount INTEGER NOT NULL,
      processed BOOLEAN DEFAULT FALSE,
      processed_at TIMESTAMP
    );
  `);
  
  // Add migration record
  await query(`
    INSERT INTO migrations (name) VALUES ('009_add_gifts');
  `);
  
  console.log('Gifts table created successfully');
}

export async function down() {
  console.log('Dropping gifts table...');
  
  // Drop the gifts table
  await query(`
    DROP TABLE IF EXISTS gifts;
  `);
  
  // Remove migration record
  await query(`
    DELETE FROM migrations WHERE name = '009_add_gifts';
  `);
  
  console.log('Gifts table dropped successfully');
}
