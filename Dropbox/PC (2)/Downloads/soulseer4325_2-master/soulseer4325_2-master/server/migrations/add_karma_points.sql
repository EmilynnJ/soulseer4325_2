-- Add karma_points column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS karma_points INTEGER DEFAULT 0;

-- Create karma_transactions table if not exists
CREATE TABLE IF NOT EXISTS karma_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  related_entity_id INTEGER,
  related_entity_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);