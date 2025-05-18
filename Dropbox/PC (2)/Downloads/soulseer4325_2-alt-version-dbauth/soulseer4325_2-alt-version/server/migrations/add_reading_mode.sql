-- Add the reading_mode column to the readings table
ALTER TABLE readings ADD COLUMN IF NOT EXISTS reading_mode VARCHAR(20) NOT NULL DEFAULT 'scheduled';

-- Add additional fields needed for readings
ALTER TABLE readings ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS price_per_minute DECIMAL(10, 2);
ALTER TABLE readings ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2);
ALTER TABLE readings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE readings ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100);
ALTER TABLE readings ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);
ALTER TABLE readings ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS review TEXT;

-- Update existing records to have a default reading_mode
UPDATE readings SET reading_mode = 'scheduled' WHERE reading_mode IS NULL;