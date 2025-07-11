
import { neon, neonConfig } from '@neondatabase/serverless';
import { log } from './vite';

// Configure neon
neonConfig.fetchConnectionCache = true;

// Use the connection URL from environment variables only
const {DATABASE_URL} = process.env;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(DATABASE_URL);

// Export query function for compatibility
export const query = async (text: string, params?: any[]) => {
  try {
    const start = Date.now();
    const result = await sql(text, params);
    const duration = Date.now() - start;
    
    log(`Executed query: ${text} - Duration: ${duration}ms`, 'database');
    
    return { rows: result, rowCount: result.length };
  } catch (error: any) {
    console.error('Database query error:', error);
    throw new Error(`Database query error: ${error.message}`);
  }
};

// Test the database connection
sql('SELECT 1')
  .then(() => {
    log('PostgreSQL database connection established successfully', 'database');
  })
  .catch((err) => {
    log(`Error connecting to PostgreSQL database: ${err.message}`, 'database');
    console.error('Database connection error:', err);
  });

export { sql };
