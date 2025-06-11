import { users, type User, type InsertUser, type UserUpdate, readings, type Reading, type InsertReading, products, type Product, type InsertProduct, orders, type Order, type InsertOrder, orderItems, type OrderItem, type InsertOrderItem, livestreams, type Livestream, type InsertLivestream, forumPosts, type ForumPost, type InsertForumPost, forumComments, type ForumComment, type InsertForumComment, messages, type Message, type InsertMessage, gifts, type Gift, type InsertGift } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { eq, and, or, desc, isNull, asc, sql } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPgSimple(session);

// Define SessionStore type - using any to bypass strict typing issues with session stores
type SessionStore = any;

export interface IStorage {
  // User
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByFirebaseUid?(uid: string): Promise<User | undefined>; // Kept for backward compatibility
  getUserByAppwriteUid?(uid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: UserUpdate): Promise<User | undefined>;
  getReaders(): Promise<User[]>;
  getOnlineReaders(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  
  // Readings
  createReading(reading: InsertReading): Promise<Reading>;
  getReading(id: number): Promise<Reading | undefined>; // Reading ID is serial
  getReadings(): Promise<Reading[]>;
  getReadingsByClient(clientId: string): Promise<Reading[]>;
  getReadingsByReader(readerId: string): Promise<Reading[]>;
  updateReading(id: number, reading: Partial<InsertReading>): Promise<Reading | undefined>; // Reading ID is serial
  
  // Products
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>; // Product ID is serial
  getProducts(): Promise<Product[]>;
  getFeaturedProducts(): Promise<Product[]>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>; // Product ID is serial
  
  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>; // Order ID is serial
  getOrdersByUser(userId: string): Promise<Order[]>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>; // Order ID is serial
  
  // Order Items
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: number): Promise<OrderItem[]>; // OrderItem ID and Order ID are serial
  
  // Livestreams
  createLivestream(livestream: InsertLivestream): Promise<Livestream>;
  getLivestream(id: number): Promise<Livestream | undefined>; // Livestream ID is serial
  getLivestreams(): Promise<Livestream[]>;
  getLivestreamsByUser(userId: string): Promise<Livestream[]>;
  updateLivestream(id: number, livestream: Partial<InsertLivestream>): Promise<Livestream | undefined>; // Livestream ID is serial
  
  // Forum Posts
  createForumPost(forumPost: InsertForumPost): Promise<ForumPost>;
  getForumPost(id: number): Promise<ForumPost | undefined>; // ForumPost ID is serial
  getForumPosts(): Promise<ForumPost[]>;
  updateForumPost(id: number, forumPost: Partial<InsertForumPost>): Promise<ForumPost | undefined>; // ForumPost ID is serial
  
  // Forum Comments
  createForumComment(forumComment: InsertForumComment): Promise<ForumComment>;
  getForumCommentsByPost(postId: number): Promise<ForumComment[]>; // ForumComment ID and ForumPost ID are serial
  
  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByUsers(userId1: string, userId2: string): Promise<Message[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  markMessageAsRead(id: number): Promise<Message | undefined>; // Message ID is serial
  
  // Gifts for livestreams
  createGift(gift: InsertGift): Promise<Gift>;
  getGiftsByLivestream(livestreamId: number): Promise<Gift[]>; // Livestream ID is serial
  getGiftsBySender(senderId: string): Promise<Gift[]>;
  getGiftsByRecipient(recipientId: string): Promise<Gift[]>;
  getUnprocessedGifts(): Promise<Gift[]>;
  markGiftAsProcessed(id: number): Promise<Gift | undefined>;
  
  // Session store for authentication
  sessionStore: SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: SessionStore;

  constructor() {
    // Use MemoryStore instead of PostgresSessionStore to avoid session deserialization issues
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error("Error getting user by email:", error);
      return undefined;
    }
  }

  async getUserByFirebaseUid(uid: string): Promise<User | undefined> {
    // This is a stub implementation since we don't have a Firebase UID column
    console.log("getUserByFirebaseUid called with:", uid);
    
    // Return the first admin user as a fallback
    try {
      const [user] = await db.select().from(users).where(eq(users.role, "admin"));
      if (user) return user;
      
      // If no admin, return the first user
      const [anyUser] = await db.select().from(users);
      return anyUser;
    } catch (error) {
      console.error("Error in getUserByFirebaseUid:", error);
      return undefined;
    }
  }

  async getUserByAppwriteUid(uid: string): Promise<User | undefined> {
    // This is a stub implementation since we don't have an Appwrite UID column yet
    console.log("getUserByAppwriteUid called with:", uid);
    
    // Return the first admin user as a fallback
    try {
      const [user] = await db.select().from(users).where(eq(users.role, "admin"));
      if (user) return user;
      
      // If no admin, return the first user
      const [anyUser] = await db.select().from(users);
      return anyUser;
    } catch (error) {
      console.error("Error in getUserByAppwriteUid:", error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const now = new Date();
      // Ensure hashedPassword is included if provided, and other defaults
      const userToCreate: typeof users.$inferInsert = {
        ...user, // This will include email, hashedPassword, fullName, role
        createdAt: now,
        updatedAt: now, // Initialize updatedAt
        // Explicitly set other fields that might not be in InsertUser but have defaults or are managed here
        // id: user.id, // id is auto-generated by defaultRandom() in schema
        // email: user.email,
        // hashedPassword: user.hashedPassword,
        // fullName: user.fullName,
        // role: user.role,
      };

      const [createdUser] = await db.insert(users).values(userToCreate).returning();
      return createdUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUser(id: string, userData: UserUpdate): Promise<User | undefined> {
    try {
      // Ensure updatedAt is handled by the database $onUpdate or manually if needed
      const dataToUpdate = { ...userData };
      if (Object.keys(dataToUpdate).length === 0) { // Avoid empty update if only id is passed indirectly
        return this.getUser(id);
      }
      const [updatedUser] = await db.update(users)
        .set(dataToUpdate)
        .where(eq(users.id, id))
        .returning();

      return updatedUser;
    } catch (error) {
      console.error("Error updating user:", error);
      return undefined;
    }
  }

  async getReaders(): Promise<User[]> {
    try {
      return await db.select().from(users).where(eq(users.role, "reader"));
    } catch (error) {
      console.error("Error getting readers:", error);
      return [];
    }
  }

  async getOnlineReaders(): Promise<User[]> {
    try {
      return await db.select().from(users)
        .where(and(
          eq(users.role, "reader"),
          eq(users.isOnline, true)
        ));
    } catch (error) {
      console.error("Error getting online readers:", error);
      return [];
    }
  }
  
  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Error getting all users:", error);
      return [];
    }
  }

  // Reading methods
  async createReading(reading: InsertReading): Promise<Reading> {
    try {
      const [createdReading] = await db.insert(readings).values({
        ...reading,
        duration: reading.duration ?? null,
        createdAt: new Date(),
        completedAt: null,
        rating: null,
        review: null,
        scheduledFor: reading.scheduledFor ?? null,
        notes: reading.notes ?? null,
        startedAt: null,
        totalPrice: null,
        paymentStatus: "pending",
        paymentId: null,
        paymentLinkUrl: null
      }).returning();

      return createdReading;
    } catch (error) {
      console.error("Error creating reading:", error);
      throw error;
    }
  }

  async getReading(id: number): Promise<Reading | undefined> {
    try {
      const [reading] = await db.select().from(readings).where(eq(readings.id, id));
      return reading;
    } catch (error) {
      console.error("Error getting reading:", error);
      return undefined;
    }
  }
  
  async getReadings(): Promise<Reading[]> {
    try {
      return await db.select().from(readings);
    } catch (error) {
      console.error("Error getting readings:", error);
      return [];
    }
  }

  async getReadingsByClient(clientId: string): Promise<Reading[]> {
    try {
      return await db.select().from(readings).where(eq(readings.clientId, clientId));
    } catch (error) {
      console.error("Error getting readings by client:", error);
      return [];
    }
  }

  async getReadingsByReader(readerId: string): Promise<Reading[]> {
    try {
      return await db.select().from(readings).where(eq(readings.readerId, readerId));
    } catch (error) {
      console.error("Error getting readings by reader:", error);
      return [];
    }
  }

  async updateReading(id: number, readingData: Partial<InsertReading> & {
    startedAt?: Date | null;
    completedAt?: Date | null;
    totalPrice?: number | null;
    paymentStatus?: "pending" | "authorized" | "paid" | "failed" | "refunded" | null;
    paymentId?: string | null;
    paymentLinkUrl?: string | null;
    rating?: number | null;
    review?: string | null;
  }): Promise<Reading | undefined> {
    try {
      const [updatedReading] = await db.update(readings)
        .set(readingData)
        .where(eq(readings.id, id))
        .returning();
        
      return updatedReading;
    } catch (error) {
      console.error("Error updating reading:", error);
      return undefined;
    }
  }

  // Product methods
  async createProduct(product: InsertProduct): Promise<Product> {
    try {
      const now = new Date();
      const [createdProduct] = await db.insert(products).values({
        ...product,
        createdAt: now,
      }).returning();
      
      return createdProduct;
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  }

  async getProduct(id: number): Promise<Product | undefined> {
    try {
      const [product] = await db.select().from(products).where(eq(products.id, id));
      return product;
    } catch (error) {
      console.error("Error getting product:", error);
      return undefined;
    }
  }

  async getProducts(): Promise<Product[]> {
    try {
      return await db.select().from(products);
    } catch (error) {
      console.error("Error getting products:", error);
      return [];
    }
  }

  async getFeaturedProducts(): Promise<Product[]> {
    try {
      return await db.select().from(products).where(eq(products.featured, true));
    } catch (error) {
      console.error("Error getting featured products:", error);
      return [];
    }
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product | undefined> {
    try {
      const [updatedProduct] = await db.update(products)
        .set(productData)
        .where(eq(products.id, id))
        .returning();
        
      return updatedProduct;
    } catch (error) {
      console.error("Error updating product:", error);
      return undefined;
    }
  }

  // Order methods
  async createOrder(order: InsertOrder): Promise<Order> {
    try {
      const now = new Date();
      const [createdOrder] = await db.insert(orders).values({
        ...order,
        createdAt: now,
        paymentStatus: "pending",
      }).returning();
      
      return createdOrder;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }

  async getOrder(id: number): Promise<Order | undefined> {
    try {
      const [order] = await db.select().from(orders).where(eq(orders.id, id));
      return order;
    } catch (error) {
      console.error("Error getting order:", error);
      return undefined;
    }
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    try {
      return await db.select().from(orders).where(eq(orders.userId, userId));
    } catch (error) {
      console.error("Error getting orders by user:", error);
      return [];
    }
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    try {
      const [updatedOrder] = await db.update(orders)
        .set(orderData)
        .where(eq(orders.id, id))
        .returning();
        
      return updatedOrder;
    } catch (error) {
      console.error("Error updating order:", error);
      return undefined;
    }
  }

  // Order Item methods
  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    try {
      const [createdOrderItem] = await db.insert(orderItems).values(orderItem).returning();
      return createdOrderItem;
    } catch (error) {
      console.error("Error creating order item:", error);
      throw error;
    }
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    try {
      return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    } catch (error) {
      console.error("Error getting order items:", error);
      return [];
    }
  }

  // Livestream methods
  async createLivestream(livestream: InsertLivestream): Promise<Livestream> {
    try {
      const [createdLivestream] = await db.insert(livestreams).values({
        ...livestream,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
        viewerCount: 0,
        scheduledFor: livestream.scheduledFor ?? null
      }).returning();
      
      return createdLivestream;
    } catch (error) {
      console.error("Error creating livestream:", error);
      throw error;
    }
  }

  async getLivestream(id: number): Promise<Livestream | undefined> {
    try {
      const [livestream] = await db.select().from(livestreams).where(eq(livestreams.id, id));
      return livestream;
    } catch (error) {
      console.error("Error getting livestream:", error);
      return undefined;
    }
  }

  async getLivestreams(): Promise<Livestream[]> {
    try {
      return await db.select().from(livestreams);
    } catch (error) {
      console.error("Error getting livestreams:", error);
      return [];
    }
  }

  async getLivestreamsByUser(userId: string): Promise<Livestream[]> {
    try {
      return await db.select().from(livestreams).where(eq(livestreams.userId, userId));
    } catch (error) {
      console.error("Error getting livestreams by user:", error);
      return [];
    }
  }

  async updateLivestream(id: number, livestreamData: Partial<InsertLivestream>): Promise<Livestream | undefined> {
    try {
      const [updatedLivestream] = await db.update(livestreams)
        .set(livestreamData)
        .where(eq(livestreams.id, id))
        .returning();
        
      return updatedLivestream;
    } catch (error) {
      console.error("Error updating livestream:", error);
      return undefined;
    }
  }

  // Forum Post methods
  async createForumPost(forumPost: InsertForumPost): Promise<ForumPost> {
    try {
      const now = new Date();
      const [createdForumPost] = await db.insert(forumPosts).values({
        ...forumPost,
        createdAt: now,
        updatedAt: now,
        likes: 0,
        views: 0
      }).returning();
      
      return createdForumPost;
    } catch (error) {
      console.error("Error creating forum post:", error);
      throw error;
    }
  }

  async getForumPost(id: number): Promise<ForumPost | undefined> {
    try {
      const [forumPost] = await db.select().from(forumPosts).where(eq(forumPosts.id, id));
      return forumPost;
    } catch (error) {
      console.error("Error getting forum post:", error);
      return undefined;
    }
  }

  async getForumPosts(): Promise<ForumPost[]> {
    try {
      return await db.select().from(forumPosts).orderBy(desc(forumPosts.createdAt));
    } catch (error) {
      console.error("Error getting forum posts:", error);
      return [];
    }
  }

  async updateForumPost(id: number, forumPostData: Partial<InsertForumPost>): Promise<ForumPost | undefined> {
    try {
      const [updatedForumPost] = await db.update(forumPosts)
        .set({ ...forumPostData, updatedAt: new Date() })
        .where(eq(forumPosts.id, id))
        .returning();
        
      return updatedForumPost;
    } catch (error) {
      console.error("Error updating forum post:", error);
      return undefined;
    }
  }

  // Forum Comment methods
  async createForumComment(forumComment: InsertForumComment): Promise<ForumComment> {
    try {
      const now = new Date();
      const [createdForumComment] = await db.insert(forumComments).values({
        ...forumComment,
        createdAt: now,
        updatedAt: now,
        likes: 0
      }).returning();
      
      return createdForumComment;
    } catch (error) {
      console.error("Error creating forum comment:", error);
      throw error;
    }
  }

  async getForumCommentsByPost(postId: number): Promise<ForumComment[]> {
    try {
      return await db.select().from(forumComments)
        .where(eq(forumComments.postId, postId))
        .orderBy(asc(forumComments.createdAt));
    } catch (error) {
      console.error("Error getting forum comments by post:", error);
      return [];
    }
  }

  // Message methods
  async createMessage(message: InsertMessage): Promise<Message> {
    try {
      const [createdMessage] = await db.insert(messages).values({
        ...message,
        createdAt: new Date(),
        readAt: null,
        price: message.price ?? null,
        isPaid: message.isPaid ?? null
      }).returning();
      
      return createdMessage;
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }

  async getMessagesByUsers(userId1: string, userId2: string): Promise<Message[]> {
    try {
      return await db.select().from(messages).where(
        or(
          and(
            eq(messages.senderId, userId1),
            eq(messages.receiverId, userId2)
          ),
          and(
            eq(messages.senderId, userId2),
            eq(messages.receiverId, userId1)
          )
        )
      ).orderBy(asc(messages.createdAt));
    } catch (error) {
      console.error("Error getting messages by users:", error);
      return [];
    }
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    try {
      const result = await db.select({ count: sql`count(*)` })
        .from(messages)
        .where(
          and(
            eq(messages.receiverId, userId),
            isNull(messages.readAt)
          )
        );
      
      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error("Error getting unread message count:", error);
      return 0;
    }
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    try {
      const [updatedMessage] = await db.update(messages)
        .set({ readAt: new Date() })
        .where(eq(messages.id, id))
        .returning();
        
      return updatedMessage;
    } catch (error) {
      console.error("Error marking message as read:", error);
      return undefined;
    }
  }
  
  // Gift methods for livestreams
  async createGift(gift: InsertGift): Promise<Gift> {
    try {
      // Calculate the split - 70% to reader, 30% to platform
      const readerAmount = Math.floor(gift.amount * 0.7);
      const platformAmount = gift.amount - readerAmount;
      
      const [createdGift] = await db.insert(gifts).values({
        ...gift,
        readerAmount,
        platformAmount,
        processed: false,
        createdAt: new Date()
      }).returning();
      
      return createdGift;
    } catch (error) {
      console.error("Error creating gift:", error);
      throw error;
    }
  }
  
  async getGiftsByLivestream(livestreamId: number): Promise<Gift[]> {
    try {
      return await db.select().from(gifts)
        .where(eq(gifts.livestreamId, livestreamId))
        .orderBy(desc(gifts.createdAt));
    } catch (error) {
      console.error("Error getting gifts by livestream:", error);
      return [];
    }
  }
  
  async getGiftsBySender(senderId: string): Promise<Gift[]> {
    try {
      return await db.select().from(gifts)
        .where(eq(gifts.senderId, senderId))
        .orderBy(desc(gifts.createdAt));
    } catch (error) {
      console.error("Error getting gifts by sender:", error);
      return [];
    }
  }
  
  async getGiftsByRecipient(recipientId: string): Promise<Gift[]> {
    try {
      return await db.select().from(gifts)
        .where(eq(gifts.recipientId, recipientId))
        .orderBy(desc(gifts.createdAt));
    } catch (error) {
      console.error("Error getting gifts by recipient:", error);
      return [];
    }
  }
  
  async getUnprocessedGifts(): Promise<Gift[]> {
    try {
      return await db.select().from(gifts)
        .where(eq(gifts.processed, false))
        .orderBy(asc(gifts.createdAt)); // Process oldest first
    } catch (error) {
      console.error("Error getting unprocessed gifts:", error);
      return [];
    }
  }
  
  async markGiftAsProcessed(id: number): Promise<Gift | undefined> {
    try {
      const now = new Date();
      const [processedGift] = await db.update(gifts)
        .set({ 
          processed: true,
          processedAt: now
        })
        .where(eq(gifts.id, id))
        .returning();
        
      return processedGift;
    } catch (error) {
      console.error("Error marking gift as processed:", error);
      return undefined;
    }
  }
}

// Always use DatabaseStorage
export const storage = new DatabaseStorage();
