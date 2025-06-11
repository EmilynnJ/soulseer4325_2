import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@shared/schema';

const { Pool } = pg;

// Create a PostgreSQL pool using the Neon PostgreSQL connection string
export const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Pbpz9TuH5AhX@ep-lively-base-a4k2rid7.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

// Initialize Drizzle with the pool and schema
export const db = drizzle(pool, { schema });
