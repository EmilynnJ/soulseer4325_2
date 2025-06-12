CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop foreign key constraints that depend on users.id
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_sender_id_users_id_fk";
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_receiver_id_users_id_fk";
ALTER TABLE "readings" DROP CONSTRAINT IF EXISTS "readings_reader_id_users_id_fk";
ALTER TABLE "readings" DROP CONSTRAINT IF EXISTS "readings_client_id_users_id_fk";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_user_id_users_id_fk";
ALTER TABLE "livestreams" DROP CONSTRAINT IF EXISTS "livestreams_user_id_users_id_fk";
ALTER TABLE "forum_posts" DROP CONSTRAINT IF EXISTS "forum_posts_user_id_users_id_fk";
ALTER TABLE "forum_comments" DROP CONSTRAINT IF EXISTS "forum_comments_user_id_users_id_fk";
-- The gifts table is referenced as "gifts" in schema.ts for both "gifts" and "liveGifts"
ALTER TABLE "gifts" DROP CONSTRAINT IF EXISTS "gifts_sender_id_users_id_fk";
ALTER TABLE "gifts" DROP CONSTRAINT IF EXISTS "gifts_recipient_id_users_id_fk";
ALTER TABLE "rtc_sessions" DROP CONSTRAINT IF EXISTS "rtc_sessions_reader_id_users_id_fk";
ALTER TABLE "rtc_sessions" DROP CONSTRAINT IF EXISTS "rtc_sessions_client_id_users_id_fk";
ALTER TABLE "reader_rates" DROP CONSTRAINT IF EXISTS "reader_rates_reader_id_users_id_fk";
ALTER TABLE "live_streams" DROP CONSTRAINT IF EXISTS "live_streams_reader_id_users_id_fk";
ALTER TABLE "premium_messages" DROP CONSTRAINT IF EXISTS "premium_messages_sender_id_users_id_fk";
ALTER TABLE "premium_messages" DROP CONSTRAINT IF EXISTS "premium_messages_receiver_id_users_id_fk";
ALTER TABLE "client_balances" DROP CONSTRAINT IF EXISTS "client_balances_client_id_users_id_fk";
ALTER TABLE "reader_availability" DROP CONSTRAINT IF EXISTS "reader_availability_reader_id_users_id_fk";
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_user_id_users_id_fk";

-- Alter users table
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "username",
  DROP COLUMN IF EXISTS "password",
  DROP COLUMN IF EXISTS "profile_image",
  DROP COLUMN IF EXISTS "bio",
  DROP COLUMN IF EXISTS "specialties",
  DROP COLUMN IF EXISTS "pricing",
  DROP COLUMN IF EXISTS "pricing_chat",
  DROP COLUMN IF EXISTS "pricing_voice",
  DROP COLUMN IF EXISTS "pricing_video",
  DROP COLUMN IF EXISTS "rating",
  DROP COLUMN IF EXISTS "review_count",
  DROP COLUMN IF EXISTS "verified",
  DROP COLUMN IF EXISTS "account_balance",
  DROP COLUMN IF EXISTS "last_active",
  DROP COLUMN IF EXISTS "is_online",
  DROP COLUMN IF EXISTS "stripe_customer_id",
  ADD COLUMN IF NOT EXISTS "hashed_password" TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT now() NOT NULL;

-- Alter id column from serial to uuid
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_pkey";
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "users" ADD PRIMARY KEY ("id");
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();

-- Update columns in other tables to uuid
ALTER TABLE "messages" ALTER COLUMN "sender_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "messages" ALTER COLUMN "receiver_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "readings" ALTER COLUMN "reader_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "readings" ALTER COLUMN "client_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "orders" ALTER COLUMN "user_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "livestreams" ALTER COLUMN "user_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "forum_posts" ALTER COLUMN "user_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "forum_comments" ALTER COLUMN "user_id" SET DATA TYPE uuid USING (uuid_generate_v4());
-- The gifts table is referenced as "gifts" in schema.ts for both "gifts" and "liveGifts"
ALTER TABLE "gifts" ALTER COLUMN "sender_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "gifts" ALTER COLUMN "recipient_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "rtc_sessions" ALTER COLUMN "reader_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "rtc_sessions" ALTER COLUMN "client_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "reader_rates" ALTER COLUMN "reader_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "live_streams" ALTER COLUMN "reader_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "premium_messages" ALTER COLUMN "sender_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "premium_messages" ALTER COLUMN "receiver_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "client_balances" ALTER COLUMN "client_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "reader_availability" ALTER COLUMN "reader_id" SET DATA TYPE uuid USING (uuid_generate_v4());
ALTER TABLE "notifications" ALTER COLUMN "user_id" SET DATA TYPE uuid USING (uuid_generate_v4());

-- Recreate foreign key constraints with the new uuid type
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id");
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "users"("id");
ALTER TABLE "readings" ADD CONSTRAINT "readings_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "users"("id");
ALTER TABLE "readings" ADD CONSTRAINT "readings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "users"("id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "livestreams" ADD CONSTRAINT "livestreams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
-- The gifts table is referenced as "gifts" in schema.ts for both "gifts" and "liveGifts"
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id");
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "users"("id");
ALTER TABLE "rtc_sessions" ADD CONSTRAINT "rtc_sessions_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "users"("id");
ALTER TABLE "rtc_sessions" ADD CONSTRAINT "rtc_sessions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "users"("id");
ALTER TABLE "reader_rates" ADD CONSTRAINT "reader_rates_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "users"("id");
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "users"("id");
ALTER TABLE "premium_messages" ADD CONSTRAINT "premium_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id");
ALTER TABLE "premium_messages" ADD CONSTRAINT "premium_messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "users"("id");
ALTER TABLE "client_balances" ADD CONSTRAINT "client_balances_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "users"("id");
ALTER TABLE "reader_availability" ADD CONSTRAINT "reader_availability_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "users"("id");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");

-- Make fullName optional
ALTER TABLE "users" ALTER COLUMN "full_name" DROP NOT NULL;

-- Ensure email has a UNIQUE constraint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");

-- Ensure timestamp columns have default and on update triggers (handled by Drizzle ORM for updatedAt)
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();

-- Manual trigger for updatedAt (if not relying on Drizzle ORM)
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = now();
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';
-- CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
