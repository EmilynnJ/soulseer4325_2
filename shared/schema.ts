import { pgTable, text, serial, integer, boolean, timestamp, json, unique, real, uuid, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";


export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  fullName: text('full_name'),
  role: text('role').notNull().default('client'),
  isOnline: boolean('is_online').default(false),
  accountBalance: numeric('account_balance', { precision: 10, scale: 2 }).default('0'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  receiverId: uuid("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isPaid: boolean("is_paid").default(false),
  price: integer("price"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  readerId: uuid("reader_id").notNull().references(() => users.id),
  clientId: uuid("client_id").notNull().references(() => users.id),
  status: text("status", { enum: ["scheduled", "waiting_payment", "payment_completed", "in_progress", "completed", "cancelled"] }).notNull(),
  type: text("type", { enum: ["chat", "video", "voice"] }).notNull(),
  readingMode: text("reading_mode", { enum: ["scheduled", "on_demand"] }).notNull(),
  scheduledFor: timestamp("scheduled_for"),
  duration: integer("duration").notNull(), // in minutes
  price: integer("price").notNull(), // Legacy price field (required by database)
  pricePerMinute: integer("price_per_minute").notNull(), // in cents
  totalPrice: integer("total_price"), // in cents, calculated after reading completes
  notes: text("notes"),
  startedAt: timestamp("started_at"),
  paymentStatus: text("payment_status", { enum: ["pending", "authorized", "paid", "failed", "refunded"] }).default("pending"),
  paymentId: text("payment_id"), // Stripe payment intent ID
  paymentLinkUrl: text("payment_link_url"), // Stripe payment link URL
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID
  rating: integer("rating"),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // in cents
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull(),
  stock: integer("stock").notNull(),
  featured: boolean("featured").default(false),
  stripeProductId: text("stripe_product_id"), // Stripe product ID
  stripePriceId: text("stripe_price_id"), // Stripe price ID
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "processing", "shipped", "delivered", "cancelled"] }).notNull(),
  total: integer("total").notNull(), // in cents
  shippingAddress: json("shipping_address").notNull(),
  paymentStatus: text("payment_status", { enum: ["pending", "authorized", "paid", "failed", "refunded"] }).default("pending"),
  stripePaymentIntentId: text("stripe_payment_intent_id"), // Stripe payment intent ID
  stripeSessionId: text("stripe_session_id"), // Stripe checkout session ID
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(), // in cents
});

export const livestreams = pgTable("livestreams", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  status: text("status", { enum: ["scheduled", "created", "live", "idle", "ended"] }).notNull(),
  scheduledFor: timestamp("scheduled_for"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  category: text("category").notNull(),
  viewerCount: integer("viewer_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  // WebRTC fields
  streamId: text("stream_id"),
  readingId: integer("reading_id"),
  duration: real("duration"), // Duration in seconds after stream ends
});

export const forumPosts = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  likes: integer("likes").default(0),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const forumComments = pgTable("forum_comments", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  postId: integer("post_id").notNull().references(() => forumPosts.id),
  content: text("content").notNull(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gifts = pgTable("gifts", {
  id: serial("id").primaryKey(),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  recipientId: uuid("recipient_id").notNull().references(() => users.id),
  livestreamId: integer("livestream_id").references(() => livestreams.id),
  amount: integer("amount").notNull(), // Amount in cents
  giftType: text("gift_type", { 
    enum: ["applause", "heart", "star", "diamond", "custom"] 
  }).notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
  // Stores the split of the gift amount (70% to reader, 30% to platform)
  readerAmount: integer("reader_amount").notNull(), // 70% of amount in cents
  platformAmount: integer("platform_amount").notNull(), // 30% of amount in cents
  processed: boolean("processed").default(false), // Whether the payment has been processed to the reader
  processedAt: timestamp("processed_at"),
});

// WebRTC Sessions Table
export const rtcSessions = pgTable('rtc_sessions', {
  id: serial('id').primaryKey(),
  sessionId: uuid('session_id').notNull().unique(),
  readerId: uuid('reader_id').references(() => users.id).notNull(),
  clientId: uuid('client_id').references(() => users.id).notNull(),
  sessionType: text('session_type', { enum: ['chat', 'audio', 'video'] }).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  scheduledStartTime: timestamp('scheduled_start_time'),
  scheduledDuration: integer('scheduled_duration'),
  status: text('status', { enum: ['scheduled', 'active', 'completed', 'cancelled'] }).notNull().default('scheduled'),
  totalMinutes: numeric('total_minutes', { precision: 10, scale: 2 }),
  amountCharged: numeric('amount_charged', { precision: 10, scale: 2 }),
  isPayPerMinute: boolean('is_pay_per_minute').notNull().default(true),
  lastBillingTime: timestamp('last_billing_time'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
});

// Reader Rates Table
export const readerRates = pgTable('reader_rates', {
  id: serial('id').primaryKey(),
  readerId: uuid('reader_id').references(() => users.id).notNull(),
  chatRate: numeric('chat_rate', { precision: 10, scale: 2 }).notNull(),
  audioRate: numeric('audio_rate', { precision: 10, scale: 2 }).notNull(),
  videoRate: numeric('video_rate', { precision: 10, scale: 2 }).notNull(),
  flatRate15Min: numeric('flat_rate_15_min', { precision: 10, scale: 2 }),
  flatRate30Min: numeric('flat_rate_30_min', { precision: 10, scale: 2 }),
  flatRate45Min: numeric('flat_rate_45_min', { precision: 10, scale: 2 }),
  flatRate60Min: numeric('flat_rate_60_min', { precision: 10, scale: 2 }),
  isAvailableForChat: boolean('is_available_for_chat').notNull().default(true),
  isAvailableForAudio: boolean('is_available_for_audio').notNull().default(true),
  isAvailableForVideo: boolean('is_available_for_video').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
});

// Live Streams Table
export const liveStreams = pgTable('live_streams', {
  id: serial('id').primaryKey(),
  streamId: uuid('stream_id').notNull().unique(),
  readerId: uuid('reader_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  status: text('status', { enum: ['scheduled', 'active', 'completed', 'cancelled'] }).notNull().default('scheduled'),
  viewerCount: integer('viewer_count').notNull().default(0),
  totalGiftsAmount: numeric('total_gifts_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
});

// Gifts Table
export const liveGifts = pgTable('gifts', {
  id: serial('id').primaryKey(),
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  receiverId: uuid('receiver_id').references(() => users.id).notNull(),
  liveStreamId: integer('live_stream_id').references(() => liveStreams.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  message: text('message'),
  giftType: text('gift_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Premium Messages Table
export const premiumMessages = pgTable('premium_messages', {
  id: serial('id').primaryKey(),
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  receiverId: uuid('receiver_id').references(() => users.id).notNull(),
  message: text('message').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }),
  isPaid: boolean('is_paid').notNull().default(false),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const readerApplications = pgTable('reader_applications', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  experience: text('experience'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Client Balance Table
export const clientBalances = pgTable('client_balances', {
  id: serial('id').primaryKey(),
  clientId: uuid('client_id').references(() => users.id).notNull(),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Reader Availability Table
export const readerAvailability = pgTable('reader_availability', {
  id: serial('id').primaryKey(),
  readerId: uuid('reader_id').references(() => users.id).notNull(),
  isOnline: boolean('is_online').notNull().default(false),
  lastOnlineTime: timestamp('last_online_time'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Notifications Table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type', { 
    enum: ['new_session_request', 'session_accepted', 'session_cancelled', 'payment_received', 'new_message']
  }).notNull(),
  message: text('message').notNull(),
  relatedEntityId: integer('related_entity_id'),
  relatedEntityType: text('related_entity_type'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Insert Schemas

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertReadingSchema = createInsertSchema(readings)
  .omit({ 
    id: true, 
    createdAt: true, 
    completedAt: true, 
    rating: true, 
    review: true, 
    startedAt: true, 
    paymentStatus: true,
    paymentId: true,
    paymentLinkUrl: true,
    stripeCustomerId: true
  });

export const insertProductSchema = createInsertSchema(products)
  .omit({ 
    id: true, 
    createdAt: true,
    stripeProductId: true,
    stripePriceId: true
  });

export const insertOrderSchema = createInsertSchema(orders)
  .omit({ 
    id: true, 
    createdAt: true,
    paymentStatus: true,
    stripePaymentIntentId: true,
    stripeSessionId: true
  });

export const insertOrderItemSchema = createInsertSchema(orderItems)
  .omit({ id: true });

export const insertLivestreamSchema = createInsertSchema(livestreams)
  .omit({ 
    id: true, 
    createdAt: true, 
    startedAt: true, 
    endedAt: true, 
    viewerCount: true,
    duration: true,
    readingId: true
  });

export const insertForumPostSchema = createInsertSchema(forumPosts)
  .omit({ id: true, createdAt: true, updatedAt: true, likes: true, views: true });

export const insertForumCommentSchema = createInsertSchema(forumComments)
  .omit({ id: true, createdAt: true, updatedAt: true, likes: true });

export const insertMessageSchema = createInsertSchema(messages)
  .omit({ id: true, createdAt: true, readAt: true });

export const insertGiftSchema = createInsertSchema(gifts)
  .omit({ id: true, createdAt: true, processed: true, processedAt: true });

export const insertReaderApplicationSchema = createInsertSchema(readerApplications)
  .omit({ id: true, createdAt: true, status: true });
  
// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserUpdate = Partial<InsertUser> & {
  isOnline?: boolean;
  stripeCustomerId?: string;
  accountBalance?: number;
};

export type InsertReading = z.infer<typeof insertReadingSchema>;
export type Reading = typeof readings.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export type InsertLivestream = z.infer<typeof insertLivestreamSchema>;
export type Livestream = typeof livestreams.$inferSelect;

export type InsertForumPost = z.infer<typeof insertForumPostSchema>;
export type ForumPost = typeof forumPosts.$inferSelect;

export type InsertForumComment = z.infer<typeof insertForumCommentSchema>;
export type ForumComment = typeof forumComments.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertGift = z.infer<typeof insertGiftSchema>;
export type Gift = typeof gifts.$inferSelect;

export type InsertReaderApplication = z.infer<typeof insertReaderApplicationSchema>;
export type ReaderApplication = typeof readerApplications.$inferSelect;
