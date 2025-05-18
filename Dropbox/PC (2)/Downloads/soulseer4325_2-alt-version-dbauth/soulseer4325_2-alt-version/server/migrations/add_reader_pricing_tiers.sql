-- Add separate pricing tiers for different reading types
ALTER TABLE users ADD COLUMN IF NOT EXISTS pricing_chat INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pricing_voice INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pricing_video INTEGER;

-- Set default values for existing readers based on their current pricing
UPDATE users 
SET 
  pricing_chat = pricing, 
  pricing_voice = pricing + 100, -- $1 more per minute for voice
  pricing_video = pricing + 200  -- $2 more per minute for video
WHERE role = 'reader' AND pricing IS NOT NULL;

-- Create an index for each pricing field to optimize searches
CREATE INDEX IF NOT EXISTS idx_users_pricing_chat ON users(pricing_chat);
CREATE INDEX IF NOT EXISTS idx_users_pricing_voice ON users(pricing_voice);
CREATE INDEX IF NOT EXISTS idx_users_pricing_video ON users(pricing_video);