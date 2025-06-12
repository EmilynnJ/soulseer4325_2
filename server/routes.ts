import express, { type Express, Request, Response, NextFunction } from "express";
import authRoutes from './routes/authRoutes';
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { UserUpdate, Reading } from "@shared/schema";
import { db } from "./db";
import { desc, asc } from "drizzle-orm";
import { gifts } from "@shared/schema";
import stripeClient from "./services/stripe-client";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import multer from "multer";
import path from "path";
import fs from "fs";

// Admin middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Unauthorized. Admin access required." });
  }
  
  next();
};

// Password hashing function
const scryptAsync = promisify(scrypt);

async function scrypt_hash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Helper function to process payment for a completed reading
async function processCompletedReadingPayment(
  readingId: number,
  totalPrice: number,
  duration: number
): Promise<void> {
  try {
    // Get the reading
    const reading = await storage.getReading(readingId);
    if (!reading) {
      throw new Error(`Reading not found: ${readingId}`);
    }
    
    // Get the client user
    const client = await storage.getUser(reading.clientId);
    if (!client) {
      throw new Error(`Client not found: ${reading.clientId}`);
    }
    
    // Check if client has sufficient balance
    const currentBalance = client.accountBalance || 0;
    if (currentBalance < totalPrice) {
      throw new Error(`Insufficient balance for client ${client.id}: has ${currentBalance}, needs ${totalPrice}`);
    }
    
    // Deduct from client's balance
    await storage.updateUser(client.id, {
      accountBalance: currentBalance - totalPrice
    });
    
    // Add to reader's balance (readers get 70% of the payment, platform takes 30%)
    const reader = await storage.getUser(reading.readerId);
    if (reader && reader.role === "reader") {
      const readerShare = Math.floor(totalPrice * 0.7); // 70% to reader
      const platformShare = totalPrice - readerShare; // 30% to platform
      
      console.log(`Processing reading payment: Total $${totalPrice/100}, Reader $${readerShare/100} (70%), Platform $${platformShare/100} (30%)`);
      
      await storage.updateUser(reader.id, {
        accountBalance: (reader.accountBalance || 0) + readerShare
      });
    }
    
    // Update reading with payment details
    await storage.updateReading(readingId, {
      totalPrice,
      duration,
      status: "completed",
      completedAt: new Date(),
      paymentStatus: "paid",
      paymentId: `internal-${Date.now()}`
    });
    
    console.log(`Completed payment for reading ${readingId}: ${totalPrice} cents for ${duration} minutes`);
  } catch (error) {
    console.error('Error processing reading payment:', error);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // Webhook endpoints removed

  // API Routes
  app.use('/api/auth', authRoutes);
  
  // Readers
  app.get("/api/readers", async (req, res) => {
    try {
      const readers = await storage.getReaders();
      // Remove sensitive data
      const sanitizedReaders = readers.map(reader => {
        const { password, ...safeReader } = reader;
        return safeReader;
      });
      res.json(sanitizedReaders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch readers" });
    }
  });
  
  app.get("/api/readers/online", async (req, res) => {
    try {
      const readers = await storage.getOnlineReaders();
      // Remove sensitive data
      const sanitizedReaders = readers.map(reader => {
        const { password, ...safeReader } = reader;
        return safeReader;
      });
      res.json(sanitizedReaders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch online readers" });
    }
  });
  
  app.get("/api/readers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reader ID" });
      }
      
      const reader = await storage.getUser(id);
      if (!reader || reader.role !== "reader") {
        return res.status(404).json({ message: "Reader not found" });
      }
      
      // Remove sensitive data
      const { password, ...safeReader } = reader;
      res.json(safeReader);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reader" });
    }
  });
  
  // Update reader status (online/offline)
  app.patch("/api/readers/status", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "reader") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      const { isOnline } = req.body;
      
      if (isOnline === undefined) {
        return res.status(400).json({ message: "isOnline status is required" });
      }
      
      const updatedUser = await storage.updateUser(req.user.id, {
        isOnline,
        lastActive: new Date()
      });
      
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to update status" });
    }
  });
  
  // Update reader pricing
  app.patch("/api/readers/pricing", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "reader") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      const { pricingChat, pricingVoice, pricingVideo } = req.body;
      
      if (pricingChat === undefined && pricingVoice === undefined && pricingVideo === undefined) {
        return res.status(400).json({ message: "At least one pricing field is required" });
      }
      
      // Validate pricing values
      const update: UserUpdate = {};
      
      if (pricingChat !== undefined) {
        if (isNaN(pricingChat) || pricingChat < 0) {
          return res.status(400).json({ message: "Chat pricing must be a positive number" });
        }
        update.pricingChat = pricingChat;
      }
      
      if (pricingVoice !== undefined) {
        if (isNaN(pricingVoice) || pricingVoice < 0) {
          return res.status(400).json({ message: "Voice pricing must be a positive number" });
        }
        update.pricingVoice = pricingVoice;
      }
      
      if (pricingVideo !== undefined) {
        if (isNaN(pricingVideo) || pricingVideo < 0) {
          return res.status(400).json({ message: "Video pricing must be a positive number" });
        }
        update.pricingVideo = pricingVideo;
      }
      
      // Update the pricing
      const updatedUser = await storage.updateUser(req.user.id, update);
      
      // Remove sensitive data before returning
      const { password, ...safeUser } = updatedUser;
      
      res.json({ success: true, user: safeUser });
    } catch (error) {
      console.error("Failed to update reader pricing:", error);
      res.status(500).json({ message: "Failed to update pricing" });
    }
  });
  
  // Readings
  app.post("/api/readings", verifyAppwriteToken, async (req, res) => {
    try {
      const readingData = req.body;
      
      const reading = await storage.createReading({
        readerId: readingData.readerId,
        clientId: req.user.id,
        status: "scheduled",
        type: readingData.type,
        readingMode: "scheduled",
        scheduledFor: readingData.scheduledFor ? new Date(readingData.scheduledFor) : null,
        duration: readingData.duration || null,
        pricePerMinute: readingData.pricePerMinute || 100,
        notes: readingData.notes || null
      });
      
      res.status(201).json(reading);
    } catch (error) {
      res.status(500).json({ message: "Failed to create reading" });
    }
  });
  
  app.get("/api/readings/client", verifyAppwriteToken, async (req, res) => {
    try {
      const readings = await storage.getReadingsByClient(req.user.id);
      res.json(readings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch readings" });
    }
  });
  
  app.get("/api/readings/reader", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "reader") {
      return res.status(401).json({ message: "Not authenticated as reader" });
    }
    
    try {
      const readings = await storage.getReadingsByReader(req.user.id);
      res.json(readings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch readings" });
    }
  });
  
  app.get("/api/readings/:id", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      res.json(reading);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reading" });
    }
  });
  
  app.patch("/api/readings/:id/status", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const { status } = req.body;
      
      // Update reading status
      const updatedReading = await storage.updateReading(id, { status });
      
      res.json(updatedReading);
    } catch (error) {
      res.status(500).json({ message: "Failed to update reading status" });
    }
  });
  
  // Send a chat message in a reading session (no WebSocket - removed)
  app.post("/api/readings/:id/message", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // Chat broadcast removed - business logic handled client-side via Firebase
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  
  // End a reading session (no WebSocket - removed)
  app.post("/api/readings/:id/end", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const { duration } = req.body;
      
      if (!duration || isNaN(duration)) {
        return res.status(400).json({ message: "Valid duration is required" });
      }
      
      // Calculate final cost based on duration and price per minute
      const durationInMinutes = Math.ceil(duration / 60); // Convert seconds to minutes, round up
      const totalCost = reading.pricePerMinute * durationInMinutes;
      
      // Update reading with duration, status, and end time
      const updatedReading = await storage.updateReading(id, {
        status: "completed",
        duration,
        totalPrice: totalCost, // Using totalPrice instead of totalCost to match schema
        endedAt: new Date()
      });
      
      // Process the payment if this is an on-demand reading
      if (reading.readingMode === 'on_demand') {
        try {
          await processCompletedReadingPayment(
            reading.id,
            totalCost,
            durationInMinutes
          );
        } catch (paymentError) {
          console.error('Error processing payment:', paymentError);
          // Continue anyway as the reading is completed
        }
      }
      
      // Business logic only - WebSocket removed
      
      res.json(updatedReading);
    } catch (error) {
      console.error('Error ending reading:', error);
      res.status(500).json({ message: "Failed to end reading session" });
    }
  });
  
  // Products
  app.get("/api/products", async (req, res) => {
    try {
      console.log("Getting products from database...");
      const products = await storage.getProducts();
      console.log(`Found ${products.length} products`);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });
  
  app.get("/api/products/featured", async (req, res) => {
    try {
      console.log("Getting featured products from database...");
      const products = await storage.getFeaturedProducts();
      console.log(`Found ${products.length} featured products`);
      res.json(products);
    } catch (error) {
      console.error("Error fetching featured products:", error);
      res.status(500).json({ message: "Failed to fetch featured products" });
    }
  });
  
  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });
  
  // Create a payment intent for reading with per-minute billing
  app.post("/api/readings/:id/create-billing-intent", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Only the client can create a payment intent
      if (req.user.id !== reading.clientId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if reading is in the right status
      if (reading.status !== "waiting_payment" && reading.status !== "payment_completed" && reading.status !== "in_progress") {
        return res.status(400).json({ 
          message: "Reading is not in a valid state for billing" 
        });
      }
      
      // Calculate initial authorization amount (30 minutes)
      const initialMinutes = 30;
      const initialAmount = reading.pricePerMinute * initialMinutes;
      
      // Create a payment intent with manual capture
      const { clientSecret, paymentIntentId } = await stripeClient.createPaymentIntent({
        amount: initialAmount,
        currency: "usd",
        metadata: {
          readingId: reading.id.toString(),
          readerId: reading.readerId.toString(),
          clientId: reading.clientId.toString(),
          readingType: reading.type,
          pricePerMinute: reading.pricePerMinute.toString(),
          initialMinutes: initialMinutes.toString(),
          purpose: 'per_minute_billing'
        },
      });
      
      // Update reading with payment intent ID
      await storage.updateReading(id, {
        stripePaymentIntentId: paymentIntentId,
        billingStatus: "pending"
      });
      
      res.json({ 
        clientSecret, 
        paymentIntentId,
        initialAmount,
        initialMinutes,
        pricePerMinute: reading.pricePerMinute
      });
    } catch (error: any) {
      console.error("Error creating billing payment intent:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Stripe payment intent creation for shop checkout
  app.post("/api/create-payment-intent", verifyAppwriteToken, async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
      }
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      
      const { clientSecret, paymentIntentId } = await stripeClient.createPaymentIntent({
        amount,
        currency: "usd",
        metadata: {
          integration_check: 'accept_a_payment',
          source: 'shop_checkout',
          userId: req.user.id.toString()
        },
      });
      
      res.json({ clientSecret, paymentIntentId });
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Admin-only routes for product management
  app.post("/api/products", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      const productData = req.body;
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to create product" });
    }
  });
  
  app.patch("/api/products/:id", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      const updatedProduct = await storage.updateProduct(id, req.body);
      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ message: "Failed to update product" });
    }
  });
  
  // Sync all products with Stripe
  app.post("/api/products/sync-with-stripe", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      // 1. Get all products from database
      const dbProducts = await storage.getProducts();
      
      // 2. Sync each product with Stripe
      const results = await Promise.all(
        dbProducts.map(async (product) => {
          try {
            const { stripeProductId, stripePriceId } = await stripeClient.syncProductWithStripe(product);
            
            // 3. Update product in database with Stripe IDs
            await storage.updateProduct(product.id, { 
              stripeProductId, 
              stripePriceId 
            });
            
            return { 
              id: product.id, 
              name: product.name, 
              success: true,
              stripeProductId,
              stripePriceId
            };
          } catch (error: any) {
            return { 
              id: product.id, 
              name: product.name, 
              success: false, 
              error: error.message 
            };
          }
        })
      );
      
      // 4. Return results
      res.json({
        totalProducts: dbProducts.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results
      });
    } catch (error: any) {
      console.error("Error syncing products with Stripe:", error);
      res.status(500).json({ message: "Failed to sync products with Stripe" });
    }
  });
  
  // Import products from Stripe
  app.post("/api/products/import-from-stripe", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      // 1. Get products from Stripe
      const stripeProducts = await stripeClient.fetchStripeProducts();
      
      // 2. Get existing products from DB to check for duplicates
      const dbProducts = await storage.getProducts();
      const existingStripeProductIds = new Set(
        dbProducts
          .filter(p => p.stripeProductId)
          .map(p => p.stripeProductId)
      );
      
      // 3. Filter out products that already exist in the database
      const newProducts = stripeProducts.filter(
        p => !existingStripeProductIds.has(p.stripeProductId)
      );
      
      // 4. Import new products into database
      const importResults = await Promise.all(
        newProducts.map(async (product) => {
          try {
            const newProduct = await storage.createProduct({
              name: product.name,
              description: product.description,
              price: product.price,
              imageUrl: product.imageUrl,
              category: product.category,
              stock: product.stock,
              featured: product.featured,
              stripeProductId: product.stripeProductId,
              stripePriceId: product.stripePriceId
            });
            
            return { 
              id: newProduct.id, 
              name: newProduct.name, 
              success: true 
            };
          } catch (error: any) {
            return { 
              name: product.name, 
              success: false, 
              error: error.message 
            };
          }
        })
      );
      
      // 5. Return results
      res.json({
        totalImported: newProducts.length,
        successCount: importResults.filter(r => r.success).length,
        failureCount: importResults.filter(r => !r.success).length,
        results: importResults
      });
    } catch (error: any) {
      console.error("Error importing products from Stripe:", error);
      res.status(500).json({ message: "Failed to import products from Stripe" });
    }
  });
  
  // Orders
  app.post("/api/orders", verifyAppwriteToken, async (req, res) => {
    try {
      const orderData = req.body;
      
      // Create order
      const order = await storage.createOrder({
        userId: req.user.id,
        status: "pending",
        total: orderData.total,
        shippingAddress: orderData.shippingAddress
      });
      
      // Create order items
      for (const item of orderData.items) {
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        });
      }
      
      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to create order" });
    }
  });
  
  app.get("/api/orders", verifyAppwriteToken, async (req, res) => {
    try {
      const orders = await storage.getOrdersByUser(req.user.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });
  
  app.get("/api/orders/:id", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }
      
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Check if user is authorized
      if (req.user.id !== order.userId && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get order items
      const orderItems = await storage.getOrderItems(id);
      
      res.json({ ...order, items: orderItems });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Reader Applications
  app.post("/api/applications", async (req, res) => {
    try {
      const appData = req.body;
      if (!appData.fullName || !appData.email) {
        return res.status(400).json({ message: "Missing fields" });
      }
      const application = await storage.createReaderApplication({
        fullName: appData.fullName,
        email: appData.email,
        experience: appData.experience || null,
      });
      res.status(201).json(application);
    } catch (error) {
      console.error('Error creating application:', error);
      res.status(500).json({ message: 'Failed to submit application' });
    }
  });
  
  // Livestreams
  app.get("/api/livestreams", async (req, res) => {
    try {
      const livestreams = await storage.getLivestreams();
      
      // Return an empty array if no livestreams found
      if (!livestreams || livestreams.length === 0) {
        return res.json([]);
      }
      
      res.json(livestreams);
    } catch (error) {
      console.error("Error fetching livestreams:", error);
      // Return empty array instead of error to avoid breaking the UI
      res.json([]);
    }
  });
  
  app.post("/api/livestreams", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "reader") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      const livestreamData = req.body;
      
      // Create a basic livestream record in the database
      const livestream = await storage.createLivestream({
        userId: req.user.id,
        title: livestreamData.title,
        description: livestreamData.description,
        status: "created",
        thumbnailUrl: livestreamData.thumbnailUrl || null,
        scheduledFor: livestreamData.scheduledFor ? new Date(livestreamData.scheduledFor) : null,
        category: livestreamData.category || "General"
      });
      
      // Return the livestream
      res.status(201).json(livestream);
    } catch (error) {
      console.error("Failed to create livestream:", error);
      res.status(500).json({ message: "Failed to create livestream" });
    }
  });
  
  app.patch("/api/livestreams/:id/status", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid livestream ID" });
      }
      
      const livestream = await storage.getLivestream(id);
      if (!livestream) {
        return res.status(404).json({ message: "Livestream not found" });
      }
      
      // Check if user is authorized
      if (req.user.id !== livestream.userId && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const { status } = req.body;
      
      // Update the livestream status in the database
      const updatedLivestream = await storage.updateLivestream(id, { status });
      
      res.json(updatedLivestream);
    } catch (error) {
      console.error("Failed to update livestream status:", error);
      res.status(500).json({ message: "Failed to update livestream status" });
    }
  });
  
  // Gifting system for livestreams
  app.post("/api/gifts", verifyAppwriteToken, async (req, res) => {
    try {
      const giftData = req.body;
      const userId = req.user.id;
      
      // Validate required fields
      if (!giftData.recipientId || !giftData.amount || !giftData.giftType) {
        return res.status(400).json({ message: "Missing required gift data" });
      }
      
      // Validate amount
      if (isNaN(giftData.amount) || giftData.amount <= 0) {
        return res.status(400).json({ 
          message: "Invalid gift amount",
          balance: req.user.accountBalance || 0,
          required: giftData.amount
        });
      }
      
      // Check if recipient exists
      const recipient = await storage.getUser(giftData.recipientId);
      if (!recipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      
      // Check if user has enough balance
      const sender = await storage.getUser(userId);
      if (!sender || (sender.accountBalance || 0) < giftData.amount) {
        return res.status(400).json({ 
          message: "Insufficient account balance",
          balance: sender ? sender.accountBalance || 0 : 0,
          required: giftData.amount
        });
      }
      
      // If there's a livestream, check if it's active
      if (giftData.livestreamId) {
        const livestream = await storage.getLivestream(giftData.livestreamId);
        if (!livestream) {
          return res.status(404).json({ message: "Livestream not found" });
        }
        if (livestream.status !== 'live') {
          return res.status(400).json({ message: "Livestream is not active" });
        }
      }
      
      // Calculate reader amount (70%) and platform amount (30%)
      const amount = parseInt(giftData.amount);
      const readerAmount = Math.floor(amount * 0.7); // 70% to reader
      const platformAmount = amount - readerAmount; // Remainder to platform
      
      // Create the gift
      const gift = await storage.createGift({
        senderId: userId,
        recipientId: giftData.recipientId,
        livestreamId: giftData.livestreamId || null,
        amount: amount,
        giftType: giftData.giftType,
        readerAmount: readerAmount,
        platformAmount: platformAmount,
        message: giftData.message || null
      });
      
      // Deduct from sender's balance
      await storage.updateUser(userId, {
        accountBalance: (sender.accountBalance || 0) - amount
      });
      
      // Add to recipient's balance (70% of the gift amount)
      await storage.updateUser(giftData.recipientId, {
        accountBalance: (recipient.accountBalance || 0) + readerAmount
      });
      
      res.status(201).json(gift);
    } catch (error) {
      console.error("Failed to create gift:", error);
      res.status(500).json({ message: "Failed to create gift. Please try again." });
    }
  });
  
  app.get("/api/gifts/livestream/:livestreamId", async (req, res) => {
    try {
      const { livestreamId } = req.params;
      
      if (!livestreamId || isNaN(parseInt(livestreamId))) {
        return res.json([]);
      }
      
      const gifts = await storage.getGiftsByLivestream(parseInt(livestreamId));
      
      // Return empty array if no gifts found
      if (!gifts || gifts.length === 0) {
        return res.json([]);
      }
      
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching gifts for livestream:", error);
      // Return empty array instead of error to avoid breaking the UI
      res.json([]);
    }
  });
  
  app.get("/api/gifts/received", verifyAppwriteToken, async (req, res) => {
    try {
      const gifts = await storage.getGiftsByRecipient(req.user.id);
      
      // Return empty array if no gifts found
      if (!gifts || gifts.length === 0) {
        return res.json([]);
      }
      
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching received gifts:", error);
      // Return empty array instead of error to avoid breaking the UI
      res.json([]);
    }
  });
  
  app.get("/api/gifts/sent", verifyAppwriteToken, async (req, res) => {
    try {
      const gifts = await storage.getGiftsBySender(req.user.id);
      
      // Return empty array if no gifts found
      if (!gifts || gifts.length === 0) {
        return res.json([]);
      }
      
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching sent gifts:", error);
      // Return empty array instead of error to avoid breaking the UI
      res.json([]);
    }
  });
  
  // Admin endpoint to get unprocessed gifts
  app.get("/api/admin/gifts/unprocessed", verifyAppwriteToken, requireAdmin, async (req, res) => {
    try {
      // Get all unprocessed gifts
      const unprocessedGifts = await storage.getUnprocessedGifts();
      
      // Include user information for the gifts
      const giftsWithUserInfo = await Promise.all(unprocessedGifts.map(async (gift) => {
        const sender = await storage.getUser(gift.senderId);
        const recipient = await storage.getUser(gift.recipientId);
        
        return {
          ...gift,
          senderUsername: sender?.username || `User #${gift.senderId}`,
          recipientUsername: recipient?.username || `User #${gift.recipientId}`
        };
      }));
      
      res.json(giftsWithUserInfo);
    } catch (error) {
      console.error("Failed to fetch unprocessed gifts:", error);
      res.status(500).json({ 
        message: "Failed to fetch unprocessed gifts",
        error: error.message || "Unknown error" 
      });
    }
  });
  
  // Admin endpoint to get all gifts
  app.get("/api/admin/gifts", verifyAppwriteToken, requireAdmin, async (req, res) => {
    try {
      // Get all gifts with optional limit
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      let allGifts = await db.select().from(gifts).orderBy(desc(gifts.createdAt));
      
      if (limit && !isNaN(limit)) {
        allGifts = allGifts.slice(0, limit);
      }
      
      // Include user information for the gifts
      const giftsWithUserInfo = await Promise.all(allGifts.map(async (gift) => {
        const sender = await storage.getUser(gift.senderId);
        const recipient = await storage.getUser(gift.recipientId);
        
        return {
          ...gift,
          senderUsername: sender?.username || `User #${gift.senderId}`,
          recipientUsername: recipient?.username || `User #${gift.recipientId}`
        };
      }));
      
      res.json(giftsWithUserInfo);
    } catch (error) {
      console.error("Failed to fetch gifts:", error);
      res.status(500).json({ 
        message: "Failed to fetch gifts",
        error: error.message || "Unknown error" 
      });
    }
  });

  // Admin endpoint to process gifts 
  app.post("/api/admin/gifts/process", verifyAppwriteToken, requireAdmin, async (req, res) => {
    try {
      // Get all unprocessed gifts
      const unprocessedGifts = await storage.getUnprocessedGifts();
      
      // If no unprocessed gifts found, return early
      if (!unprocessedGifts || unprocessedGifts.length === 0) {
        return res.json({ 
          processedCount: 0,
          gifts: [],
          message: "No unprocessed gifts found"
        });
      }
      
      const processedGifts = [];
      const failedGifts = [];
      
      // Mark each gift as processed
      for (const gift of unprocessedGifts) {
        try {
          const processedGift = await storage.markGiftAsProcessed(gift.id);
          if (processedGift) {
            processedGifts.push(processedGift);
          } else {
            failedGifts.push(gift.id);
          }
        } catch (giftError) {
          console.error(`Failed to process gift ${gift.id}:`, giftError);
          failedGifts.push(gift.id);
        }
      }
      
      res.json({ 
        processedCount: processedGifts.length,
        gifts: processedGifts,
        failedCount: failedGifts.length,
        failedGiftIds: failedGifts,
        success: processedGifts.length > 0
      });
    } catch (error) {
      console.error("Failed to process gifts:", error);
      res.status(500).json({ 
        message: "Failed to process gifts",
        error: error.message || "Unknown error" 
      });
    }
  });
  
  // Forum
  app.get("/api/forum/posts", async (req, res) => {
    try {
      const posts = await storage.getForumPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch forum posts" });
    }
  });
  
  app.post("/api/forum/posts", verifyAppwriteToken, async (req, res) => {
    try {
      const postData = req.body;
      
      const post = await storage.createForumPost({
        userId: req.user.id,
        title: postData.title,
        content: postData.content,
        category: postData.category
      });
      
      res.status(201).json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to create forum post" });
    }
  });

  app.get("/api/forum/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const post = await storage.getForumPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Increment view count
      const updatedPost = await storage.updateForumPost(id, {
        views: post.views + 1
      });
      
      res.json(updatedPost);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });
  
  app.post("/api/forum/posts/:id/like", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const post = await storage.getForumPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Increment likes
      const updatedPost = await storage.updateForumPost(id, {
        likes: post.likes + 1
      });
      
      res.json(updatedPost);
    } catch (error) {
      res.status(500).json({ message: "Failed to like post" });
    }
  });
  
  app.get("/api/forum/comments", async (req, res) => {
    try {
      const postId = req.query.postId ? parseInt(req.query.postId as string) : undefined;
      
      if (postId) {
        const comments = await storage.getForumCommentsByPost(postId);
        return res.json(comments);
      }
      
      res.status(400).json({ message: "Post ID is required" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });
  
  app.get("/api/forum/posts/:id/comments", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const comments = await storage.getForumCommentsByPost(id);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });
  
  app.post("/api/forum/posts/:id/comments", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      const post = await storage.getForumPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      const commentData = req.body;
      
      const comment = await storage.createForumComment({
        userId: req.user.id,
        postId: id,
        content: commentData.content
      });
      
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create comment" });
    }
  });
  
  // Messages
  app.get("/api/messages/:userId", verifyAppwriteToken, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const messages = await storage.getMessagesByUsers(req.user.id, userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  
  app.post("/api/messages", verifyAppwriteToken, async (req, res) => {
    try {
      const messageData = req.body;
      
      const message = await storage.createMessage({
        senderId: req.user.id,
        receiverId: messageData.receiverId,
        content: messageData.content,
        isPaid: messageData.isPaid || false,
        price: messageData.price || null
      });
      
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  
  app.patch("/api/messages/:id/read", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }
      
      const updatedMessage = await storage.markMessageAsRead(id);
      if (!updatedMessage) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      res.json(updatedMessage);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });
  
  app.get("/api/messages/unread/count", verifyAppwriteToken, async (req, res) => {
    try {
      const count = await storage.getUnreadMessageCount(req.user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to get unread message count" });
    }
  });

  // Payment API endpoints
  app.get("/api/stripe/config", (req, res) => {
    res.json({
      publishableKey: process.env.VITE_STRIPE_PUBLIC_KEY
    });
  });
  
  // Create a payment intent for on-demand readings
  app.post("/api/stripe/create-payment-intent", verifyAppwriteToken, async (req, res) => {
    try {
      const { amount, readingId, metadata = {} } = req.body;
      
      if (!amount || isNaN(amount)) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      
      // Use Stripe customer ID if available, or create a new one later
      const customerId = req.user.stripeCustomerId;
      
      const result = await stripeClient.createPaymentIntent({
        amount,
        ...(customerId ? { customerId } : {}),
        metadata: {
          readingId: readingId?.toString() || '',
          userId: req.user.id.toString(),
          ...metadata
        }
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update an existing payment intent (for pay-per-minute)
  app.post("/api/stripe/update-payment-intent", verifyAppwriteToken, async (req, res) => {
    try {
      const { paymentIntentId, amount, metadata = {} } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }
      
      if (!amount || isNaN(amount)) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      
      const result = await stripeClient.updatePaymentIntent(paymentIntentId, {
        amount,
        metadata: {
          ...metadata,
          updatedAt: new Date().toISOString()
        }
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Error updating payment intent:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Capture a payment intent (for finalized pay-per-minute sessions)
  app.post("/api/stripe/capture-payment-intent", verifyAppwriteToken, async (req, res) => {
    try {
      const { paymentIntentId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }
      
      const result = await stripeClient.capturePaymentIntent(paymentIntentId);
      res.json(result);
    } catch (error: any) {
      console.error("Error capturing payment intent:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create an on-demand reading session
  app.post("/api/readings/on-demand", verifyAppwriteToken, async (req, res) => {
    try {
      const { readerId, type } = req.body;
      
      if (!readerId || !type || !["chat", "video", "voice"].includes(type)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }
      
      // Get the reader
      const reader = await storage.getUser(readerId);
      if (!reader || reader.role !== "reader") {
        return res.status(404).json({ message: "Reader not found" });
      }
      
      // Check if reader is online
      if (!reader.isOnline) {
        return res.status(400).json({ message: "Reader is not online" });
      }
      
      // Check if client has sufficient balance (minimum $5 or 500 cents)
      const client = await storage.getUser(req.user.id);
      const minimumBalance = 500; // $5 in cents
      if (!client || (client.accountBalance || 0) < minimumBalance) {
        return res.status(400).json({ 
          message: "Insufficient account balance. Minimum of $5 is required to start a reading.",
          balance: client ? client.accountBalance || 0 : 0,
          minimumRequired: minimumBalance
        });
      }
      
      // Determine the appropriate price based on reading type
      let pricePerMinute = 100; // Default $1/min
      
      if (type === 'chat') {
        pricePerMinute = reader.pricingChat || reader.pricing || 100;
      } else if (type === 'voice') {
        pricePerMinute = reader.pricingVoice || reader.pricing || 200;
      } else if (type === 'video') {
        pricePerMinute = reader.pricingVideo || reader.pricing || 300;
      }
      
      // Create a new reading record
      const reading = await storage.createReading({
        readerId,
        clientId: req.user.id,
        status: "waiting_payment",
        type,
        readingMode: "on_demand",
        pricePerMinute: pricePerMinute,
        duration: 0, // Start with 0 and track actual duration during the session
        price: 0, // Database requires this field (legacy)
        totalPrice: 0, // Will be calculated based on duration after the reading is completed
        notes: null
      });
      
      // Create payment link using Stripe
      const paymentResult = await stripeClient.createOnDemandReadingPayment(
        pricePerMinute, // in cents
        req.user.id,
        req.user.fullName,
        readerId,
        reading.id,
        type
      );
      
      if (!paymentResult.success) {
        // If payment creation fails, update the reading status to cancelled
        await storage.updateReading(reading.id, { status: "cancelled" });
        return res.status(500).json({ message: "Failed to create payment" });
      }
      
      // Update reading with payment link
      const updatedReading = await storage.updateReading(reading.id, {
        paymentLinkUrl: paymentResult.paymentLinkUrl
      });
      
      res.json({
        success: true,
        reading: updatedReading,
        paymentLink: paymentResult.paymentLinkUrl
      });
    } catch (error) {
      console.error('Error creating on-demand reading:', error);
      res.status(500).json({ message: "Failed to create on-demand reading" });
    }
  });
  
  // Schedule a reading (fixed price one-time payment)
  app.post("/api/readings/schedule", verifyAppwriteToken, async (req, res) => {
    try {
      const { readerId, type, duration, scheduledFor, notes, price } = req.body;
      
      if (!readerId || !type || !["chat", "video", "voice"].includes(type)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }
      
      // Validate required fields
      if (!duration || isNaN(duration) || duration <= 0) {
        return res.status(400).json({ message: "Valid duration is required" });
      }
      
      if (!scheduledFor) {
        return res.status(400).json({ message: "Scheduled date and time is required" });
      }
      
      if (!price || isNaN(price) || price <= 0) {
        return res.status(400).json({ message: "Valid price is required" });
      }
      
      // Get the reader
      const reader = await storage.getUser(readerId);
      if (!reader || reader.role !== "reader") {
        return res.status(404).json({ message: "Reader not found" });
      }
      
      // Validate scheduled date (must be in the future)
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        return res.status(400).json({ message: "Scheduled date must be in the future" });
      }
      
      const clientId = req.user.id;
      
      // Create a Stripe payment intent for the full amount
      try {
        const stripeCustomerId = req.user.stripeCustomerId;
        let customerId = stripeCustomerId;
        
        // Create a new Stripe customer if the user doesn't have one
        if (!customerId) {
          const customer = await stripeClient.customers.create({
            email: req.user.email,
            name: req.user.fullName || req.user.username,
          });
          customerId = customer.id;
          
          // Update user with Stripe customer ID
          await storage.updateUser(clientId, {
            stripeCustomerId: customerId
          });
        }
        
        // Create a payment intent for the full reading cost
        const paymentIntent = await stripeClient.paymentIntents.create({
          amount: price,
          currency: 'usd',
          customer: customerId,
          payment_method_types: ['card'],
          metadata: {
            readingType: 'scheduled',
            clientId: clientId.toString(),
            readerId: readerId.toString(),
            type,
            duration: duration.toString(),
            scheduledFor: scheduledDate.toISOString(),
          },
        });
        
        // Create the reading in "waiting_payment" status
        const reading = await storage.createReading({
          readerId,
          clientId,
          type,
          status: "waiting_payment",
          price: price / duration, // Store the per-minute rate
          duration,
          totalPrice: price,
          scheduledFor: scheduledDate,
          notes: notes || null,
          readingMode: "scheduled",
          stripePaymentIntentId: paymentIntent.id
        });
        
        // Return the client secret for the payment intent
        return res.status(201).json({ 
          reading,
          clientSecret: paymentIntent.client_secret,
          paymentLink: `/checkout?clientSecret=${paymentIntent.client_secret}&readingId=${reading.id}`
        });
        
      } catch (stripeError) {
        console.error("Stripe error creating payment intent:", stripeError);
        return res.status(400).json({ 
          message: "Payment processing error",
          error: stripeError.message 
        });
      }
      
    } catch (error) {
      console.error("Error scheduling reading:", error);
      return res.status(500).json({ message: "Failed to schedule reading" });
    }
  });
  
  // Start an on-demand reading session (after payment) (no notify WebSocket)
  app.post("/api/readings/:id/start", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if reading is in the right status
      if (reading.status !== "waiting_payment" && reading.status !== "payment_completed") {
        return res.status(400).json({ 
          message: "Reading can't be started. Current status: " + reading.status 
        });
      }
      
      // Update reading status and start time
      const updatedReading = await storage.updateReading(id, {
        status: "in_progress",
        startedAt: new Date()
      });
      
      res.json(updatedReading);
    } catch (error) {
      res.status(500).json({ message: "Failed to start reading" });
    }
  });
  
  // Start billing for a reading session
  app.post("/api/readings/:id/start-billing", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if reading is in progress
      if (reading.status !== "in_progress") {
        return res.status(400).json({ message: "Reading is not in progress" });
      }
      
      // Get the payment intent ID if it exists
      const { paymentIntentId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }
      
      // Update reading with billing status
      const updatedReading = await storage.updateReading(id, {
        billingStatus: "active",
        billingStartedAt: new Date(),
        stripePaymentIntentId: paymentIntentId
      });
      
      res.json({
        success: true,
        reading: updatedReading,
        message: "Billing started successfully"
      });
    } catch (error) {
      console.error('Error starting billing:', error);
      res.status(500).json({ message: "Failed to start billing" });
    }
  });
  
  // Pause billing for a reading session
  app.post("/api/readings/:id/pause-billing", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if billing is active
      if (reading.billingStatus !== "active") {
        return res.status(400).json({ message: "Billing is not active" });
      }
      
      // Calculate minutes billed so far
      const billingStartedAt = new Date(reading.billingStartedAt);
      const now = new Date();
      const elapsedMinutes = Math.ceil((now.getTime() - billingStartedAt.getTime()) / (60 * 1000));
      
      // Calculate amount to capture
      const amountToCapture = reading.pricePerMinute * elapsedMinutes;
      
      // Capture payment for minutes used so far
      if (reading.stripePaymentIntentId) {
        try {
          // Update the payment intent with the current amount
          await stripeClient.updatePaymentIntent(reading.stripePaymentIntentId, {
            amount: amountToCapture,
            metadata: {
              readingId: reading.id.toString(),
              minutesBilled: elapsedMinutes.toString(),
              pausedAt: now.toISOString()
            }
          });
          
          console.log(`Updated payment intent ${reading.stripePaymentIntentId} with amount ${amountToCapture} for ${elapsedMinutes} minutes`);
        } catch (stripeError) {
          console.error('Error updating payment intent:', stripeError);
          // Continue anyway to pause billing
        }
      }
      
      // Update reading with billing status and accumulated minutes
      const updatedReading = await storage.updateReading(id, {
        billingStatus: "paused",
        billingPausedAt: now,
        billedMinutes: (reading.billedMinutes || 0) + elapsedMinutes
      });
      
      res.json({
        success: true,
        reading: updatedReading,
        minutesBilled: elapsedMinutes,
        totalMinutesBilled: updatedReading.billedMinutes,
        amountCaptured: amountToCapture,
        message: "Billing paused successfully"
      });
    } catch (error) {
      console.error('Error pausing billing:', error);
      res.status(500).json({ message: "Failed to pause billing" });
    }
  });
  
  // Process per-minute billing tick
  app.post("/api/readings/:id/billing-tick", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if reading is in progress and billing is active
      if (reading.status !== "in_progress" || reading.billingStatus !== "active") {
        return res.status(400).json({ message: "Reading is not in progress or billing is not active" });
      }
      
      const { elapsedMinutes, currentAmount } = req.body;
      
      if (!elapsedMinutes || isNaN(elapsedMinutes) || elapsedMinutes <= 0) {
        return res.status(400).json({ message: "Valid elapsed minutes are required" });
      }
      
      if (!currentAmount || isNaN(currentAmount) || currentAmount <= 0) {
        return res.status(400).json({ message: "Valid current amount is required" });
      }
      
      // Update payment intent with current amount if available
      if (reading.stripePaymentIntentId) {
        try {
          await stripeClient.updatePaymentIntent(reading.stripePaymentIntentId, {
            amount: currentAmount,
            metadata: {
              readingId: reading.id.toString(),
              minutesBilled: elapsedMinutes.toString(),
              lastBillingTick: new Date().toISOString()
            }
          });
          
          console.log(`Updated payment intent ${reading.stripePaymentIntentId} with amount ${currentAmount} for ${elapsedMinutes} minutes`);
        } catch (stripeError) {
          console.error('Error updating payment intent during billing tick:', stripeError);
          return res.status(500).json({ 
            message: "Failed to update payment intent",
            error: stripeError.message
          });
        }
      }
      
      // Update reading with current billed minutes
      const updatedReading = await storage.updateReading(id, {
        billedMinutes: elapsedMinutes
      });
      
      res.json({
        success: true,
        reading: updatedReading,
        message: "Billing tick processed successfully"
      });
    } catch (error) {
      console.error('Error processing billing tick:', error);
      res.status(500).json({ message: "Failed to process billing tick" });
    }
  });
  
  // Complete an on-demand reading session and process payment from account balance (no notify WebSocket)
  app.post("/api/readings/:id/end", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if reading is in progress
      if (reading.status !== "in_progress") {
        return res.status(400).json({ message: "Reading is not in progress" });
      }
      
      const { duration, totalPrice } = req.body;
      
      if (!duration || duration <= 0) {
        return res.status(400).json({ message: "Invalid duration" });
      }
      
      if (!totalPrice || totalPrice <= 0) {
        return res.status(400).json({ message: "Invalid total price" });
      }
      
      // Calculate and verify the price based on duration and pricePerMinute
      const calculatedPrice = reading.pricePerMinute * duration;
      if (Math.abs(calculatedPrice - totalPrice) > (reading.pricePerMinute / 2)) {
        console.warn(`Price discrepancy detected: calculated ${calculatedPrice} vs. received ${totalPrice}`);
      }
      
      // If using Stripe payment intent, capture the final amount
      if (reading.stripePaymentIntentId) {
        try {
          // Capture the final payment
          const captureResult = await stripeClient.capturePaymentIntent(reading.stripePaymentIntentId);
          console.log(`Captured payment intent ${reading.stripePaymentIntentId} with final amount ${captureResult.amount}`);
          
          // Update reading with payment details
          await storage.updateReading(id, {
            paymentStatus: "paid",
            paymentId: reading.stripePaymentIntentId,
            billingStatus: "completed"
          });
        } catch (stripeError) {
          console.error('Error capturing payment intent:', stripeError);
          // Continue with internal payment processing as fallback
        }
      } else {
        // Process payment from client's account balance (legacy method)
        const client = await storage.getUser(reading.clientId);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }
        
        // Check if client has sufficient balance
        const currentBalance = client.accountBalance || 0;
        if (currentBalance < totalPrice) {
          return res.status(400).json({ 
            message: "Insufficient account balance. Please add funds to continue.",
            balance: currentBalance,
            required: totalPrice
          });
        }
        
        // Deduct from client's balance
        await storage.updateUser(client.id, {
          accountBalance: currentBalance - totalPrice
        });
        
        // Add to reader's balance (if reader)
        const reader = await storage.getUser(reading.readerId);
        if (reader && reader.role === "reader") {
          const readerShare = Math.floor(totalPrice * 0.7);
          await storage.updateUser(reader.id, {
            accountBalance: (reader.accountBalance || 0) + readerShare
          });
        }
      }
      
      // Update reading with completion details
      const now = new Date();
      const updatedReading = await storage.updateReading(id, {
        status: "completed",
        completedAt: now,
        duration,
        totalPrice,
        paymentStatus: "paid",
        paymentId: `internal-${Date.now()}`
      });
      
      res.json({
        success: true,
        reading: updatedReading
      });
    } catch (error) {
      console.error('Error completing reading:', error);
      res.status(500).json({ message: "Failed to complete reading" });
    }
  });
  
  // Rate a completed reading (no notify WebSocket)
  app.post("/api/readings/:id/rate", verifyAppwriteToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Only the client can rate a reading
      if (req.user.id !== reading.clientId) {
        return res.status(403).json({ message: "Only the client can rate a reading" });
      }
      
      // Check if reading is completed
      if (reading.status !== "completed") {
        return res.status(400).json({ message: "Reading must be completed before rating" });
      }
      
      const { rating, review } = req.body;
      
      if (rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      
      // Update reading with rating and review
      const updatedReading = await storage.updateReading(id, { rating, review });
      
      // Update reader's review count
      const reader = await storage.getUser(reading.readerId);
      if (reader) {
        await storage.updateUser(reading.readerId, { 
          reviewCount: (reader.reviewCount || 0) + 1 
        });
      }
      
      res.json(updatedReading);
    } catch (error) {
      res.status(500).json({ message: "Failed to rate reading" });
    }
  });
  
  // Account Balance Management
  app.get('/api/user/balance', verifyAppwriteToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        balance: user.accountBalance || 0,
        formatted: `$${((user.accountBalance || 0) / 100).toFixed(2)}`
      });
    } catch (error: any) {
      console.error("Error fetching user balance:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get user's reading history
  app.get('/api/users/:id/readings', verifyAppwriteToken, async (req, res) => {
    // Users can only access their own readings
    if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      let readings;
      
      if (req.user.role === 'client') {
        readings = await storage.getReadingsByClient(req.user.id);
      } else if (req.user.role === 'reader') {
        readings = await storage.getReadingsByReader(req.user.id);
      } else {
        // Admin can view all completed readings
        const allReadings = await storage.getReadings();
        readings = allReadings.filter((r: Reading) => r.status === 'completed');
      }
      
      // Add reader names to the readings
      const readingsWithNames = await Promise.all(readings.map(async (reading: Reading) => {
        const reader = await storage.getUser(reading.readerId);
        return {
          ...reading,
          readerName: reader ? reader.fullName : 'Unknown Reader'
        };
      }));
      
      res.json(readingsWithNames.filter((r: Reading & { readerName: string }) => r.status === 'completed'));
    } catch (error: any) {
      console.error("Error fetching readings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get user's upcoming readings
  app.get('/api/users/:id/readings/upcoming', verifyAppwriteToken, async (req, res) => {
    // Users can only access their own upcoming readings
    if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      let readings;
      
      if (req.user.role === 'client') {
        readings = await storage.getReadingsByClient(req.user.id);
      } else if (req.user.role === 'reader') {
        readings = await storage.getReadingsByReader(req.user.id);
      } else {
        // Admin can view all scheduled readings
        const allReadings = await storage.getReadings();
        readings = allReadings.filter(r => 
          ['scheduled','waiting_payment','payment_completed','in_progress'].includes(r.status)
        );
      }
      
      // Add reader names to the readings
      const readingsWithNames = await Promise.all(readings.map(async (reading) => {
        const reader = await storage.getUser(reading.readerId);
        return {
          ...reading,
          readerName: reader ? reader.fullName : 'Unknown Reader'
        };
      }));
      
      // Filter for upcoming readings
      const upcomingReadings = readingsWithNames.filter(r => 
        ['scheduled','waiting_payment','payment_completed','in_progress'].includes(r.status)
      );
      
      res.json(upcomingReadings);
    } catch (error: any) {
      console.error("Error fetching upcoming readings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Add funds to account balance 
  app.post('/api/user/add-funds', verifyAppwriteToken, async (req, res) => {
    const { amount } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }
    
    try {
      // Create a Stripe payment intent to add funds
      const result = await stripeClient.createPaymentIntent({
        amount,
        metadata: {
          userId: req.user.id.toString(),
          purpose: 'account_funding'
        }
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Error creating payment intent for adding funds:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Confirm added funds (after payment is completed)
  app.post('/api/user/confirm-funds', verifyAppwriteToken, async (req, res) => {
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({ message: "Payment intent ID is required" });
    }
    
    try {
      // Check if payment intent exists and is valid
      const paymentIntent = await stripeClient.retrievePaymentIntent(paymentIntentId);
      
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({ message: "Payment not completed" });
      }
      
      if (paymentIntent.metadata.userId !== req.user.id.toString()) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Add funds to user's account balance
      const amountToAdd = paymentIntent.amount;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const currentBalance = user.accountBalance || 0;
      const updatedUser = await storage.updateUser(user.id, {
        accountBalance: currentBalance + amountToAdd
      });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update account balance" });
      }
      
      res.json({ 
        success: true, 
        newBalance: updatedUser.accountBalance || 0,
        formatted: `$${((updatedUser.accountBalance || 0) / 100).toFixed(2)}` 
      });
    } catch (error: any) {
      console.error("Error confirming added funds:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin API routes
  
  // Get all readings (admin only)
  app.get("/api/admin/readings", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized. Admin access required." });
    }
    
    try {
      const readings = await storage.getReadings();
      const readingsWithNames = await Promise.all(readings.map(async (reading) => {
        const client = await storage.getUser(reading.clientId);
        const reader = reading.readerId ? await storage.getUser(reading.readerId) : null;
        
        return {
          ...reading,
          clientName: client ? client.username : "Unknown",
          readerName: reader ? reader.username : "Unassigned"
        };
      }));
      
      return res.json(readingsWithNames);
    } catch (error) {
      console.error("Error fetching all readings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get all readers (admin only)
  app.get("/api/admin/readers", verifyAppwriteToken, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized. Admin access required." });
    }
    
    try {
      const readers = await storage.getReaders();
      return res.json(readers);
    } catch (error) {
      console.error("Error fetching all readers:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get all users (admin only)
  app.get("/api/admin/users", verifyAppwriteToken, requireAdmin, async (req, res) => {
    try {
      // We need to get all users - adapted storage method might be needed
      const users = await storage.getAllUsers();
      
      // Return without password information
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      return res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching all users:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Configure multer for memory storage
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // limit to 5MB
    },
    fileFilter: (req: any, file: any, cb: any) => {
      // Accept images only
      if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
      }
      cb(null, true);
    }
  });
  
  // Admin endpoint to add new readers with profile image
  app.post("/api/admin/readers", verifyAppwriteToken, requireAdmin, upload.single('profileImage'), async (req: any, res: any) => {
    try {
      console.log("Reader form submission received:", req.body);
      const { username, password, email, fullName, bio, ratePerMinute, specialties } = req.body;

      if (!username || !password || !email || !fullName) {
        return res.status(400).json({ message: "Required fields missing" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Parse specialties if it's a JSON string
      let parsedSpecialties = [];
      try {
        parsedSpecialties = JSON.parse(specialties);
      } catch (e) {
        // If parsing fails, use as is or empty array
        parsedSpecialties = specialties || [];
      }
      
      // Process boolean fields (checkboxes)
      const chatReadingEnabled = req.body.chatReading === 'true';
      const phoneReadingEnabled = req.body.phoneReading === 'true';
      const videoReadingEnabled = req.body.videoReading === 'true';
      
      // Generate a hash for the password
      const hashedPassword = await scrypt_hash(password);
      
      // Handle profile image if uploaded
      let profileImageUrl = null;
      if (req.file) {
        // Generate a unique filename
        const filename = `${Date.now()}-${req.file.originalname}`;
        const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
        const filepath = path.join(uploadsDir, filename);
        
        // Ensure uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Write file to disk
        fs.writeFileSync(filepath, req.file.buffer);
        
        // Set the URL for the profile image
        profileImageUrl = `/uploads/${filename}`;
      }
      
      // Parse rate per minute to a number
      const rate = Math.max(0, parseInt(ratePerMinute, 10) || 0);
      
      // Create the reader account
      const newReader = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        fullName,
        role: 'reader',
        bio: bio || '',
        profileImage: profileImageUrl,
        specialties: parsedSpecialties,
        pricing: rate,
        pricingChat: rate,
        pricingVoice: rate,
        pricingVideo: rate,
        isOnline: false,
        accountBalance: 0,
        verified: true,
        rating: 5,
        reviewCount: 0
      });

      // Log success
      console.log("Successfully created reader:", newReader.id);
      
      // Remove sensitive information from the response
      const { password: _, ...safeReader } = newReader;
      
      res.status(201).json(safeReader);
    } catch (error) {
      console.error("Error creating reader:", error);
      res.status(500).json({ message: "Failed to create reader account" });
    }
  });
  
  // Livestream API for readings
  app.post("/api/readings/:id/livestream", verifyAppwriteToken, async (req, res) => {
    try {
      const readingId = parseInt(req.params.id);
      if (isNaN(readingId)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }
      
      const reading = await storage.getReading(readingId);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }
      
      // Only the reader or client can create a livestream for this reading
      if (reading.readerId !== req.user.id && reading.clientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { title, description } = req.body;
      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }
      
      // Get the reader user
      const readerUser = await storage.getUser(reading.readerId);
      if (!readerUser) {
        return res.status(404).json({ message: "Reader not found" });
      }
      
      // Create a basic livestream record in the database
      const livestream = await storage.createLivestream({
        userId: readerUser.id,
        title,
        description,
        status: "created",
        readingId
      });
      
      // Update the reading with the livestream ID
      await storage.updateReading(readingId, {
        livestreamId: livestream.id
      });
      
      res.status(200).json({
        id: livestream.id,
        title: livestream.title,
        description: livestream.description,
        status: livestream.status
      });
    } catch (error) {
      console.error("Failed to create livestream for reading:", error);
      res.status(500).json({ message: "Failed to create livestream" });
    }
  });
  
  // API endpoint to start a livestream
  app.post("/api/livestreams/:id/start", verifyAppwriteToken, async (req, res) => {
    try {
      const livestreamId = parseInt(req.params.id);
      if (isNaN(livestreamId)) {
        return res.status(400).json({ message: "Invalid livestream ID" });
      }
      
      const livestream = await storage.getLivestream(livestreamId);
      if (!livestream) {
        return res.status(404).json({ message: "Livestream not found" });
      }
      
      // Only the creator can start a livestream
      if (livestream.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Update the livestream status in the database
      const updatedLivestream = await storage.updateLivestream(livestreamId, { 
        status: "live",
        startedAt: new Date()
      });
      
      res.status(200).json(updatedLivestream);
    } catch (error) {
      console.error("Failed to start livestream:", error);
      res.status(500).json({ message: "Failed to start livestream" });
    }
  });
  
  // API endpoint to end a livestream
  app.post("/api/livestreams/:id/end", verifyAppwriteToken, async (req, res) => {
    try {
      const livestreamId = parseInt(req.params.id);
      if (isNaN(livestreamId)) {
        return res.status(400).json({ message: "Invalid livestream ID" });
      }
      
      const livestream = await storage.getLivestream(livestreamId);
      if (!livestream) {
        return res.status(404).json({ message: "Livestream not found" });
      }
      
      // Both the creator and admin can end a livestream
      if (livestream.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Update the livestream status in the database
      const updatedLivestream = await storage.updateLivestream(livestreamId, { 
        status: "ended",
        endedAt: new Date()
      });
      
      res.status(200).json(updatedLivestream);
    } catch (error) {
      console.error("Failed to end livestream:", error);
      res.status(500).json({ message: "Failed to end livestream" });
    }
  });

  return httpServer;
}
