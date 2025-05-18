import { Router } from 'express';
import { db } from '../db';
import { rtcSessions, readerRates, readerAvailability, clientBalances, users, notifications } from '@shared/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { verifyAppwriteToken } from '../auth';
import { createSession, getSessionInfo, isUserOnline } from './signaling';
import { checkClientBalance, addFundsToClientBalance, getClientBalance } from './billing';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

const router = Router();

// Middleware to check if user is a reader
const isReader = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  if (req.user.role !== 'reader') {
    return res.status(403).json({ message: 'Forbidden - Reader access required' });
  }
  
  next();
};

// Middleware to check if user is a client
const isClient = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  if (req.user.role !== 'client') {
    return res.status(403).json({ message: 'Forbidden - Client access required' });
  }
  
  next();
};

// READER ROUTES

// Get reader's rates
router.get('/reader/rates', verifyAppwriteToken, isReader, async (req, res) => {
  try {
    const readerId = req.user!.id;
    
    const rates = await db.query.readerRates.findFirst({
      where: eq(readerRates.readerId, readerId)
    });
    
    if (!rates) {
      return res.status(404).json({ message: 'Rates not found' });
    }
    
    res.json(rates);
  } catch (error) {
    console.error('Error getting reader rates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Set reader's rates
router.post('/reader/rates', verifyAppwriteToken, isReader, async (req, res) => {
  try {
    const readerId = req.user!.id;
    const { chatRate, audioRate, videoRate, flatRate15Min, flatRate30Min, flatRate45Min, flatRate60Min } = req.body;
    
    // Validate rates
    if (chatRate === undefined || audioRate === undefined || videoRate === undefined) {
      return res.status(400).json({ message: 'Chat, audio, and video rates are required' });
    }
    
    // Check if rates already exist
    const existingRates = await db.query.readerRates.findFirst({
      where: eq(readerRates.readerId, readerId)
    });
    
    const now = new Date();
    
    if (existingRates) {
      // Update existing rates
      await db.update(readerRates)
        .set({
          chatRate,
          audioRate,
          videoRate,
          flatRate15Min: flatRate15Min ?? existingRates.flatRate15Min,
          flatRate30Min: flatRate30Min ?? existingRates.flatRate30Min,
          flatRate45Min: flatRate45Min ?? existingRates.flatRate45Min,
          flatRate60Min: flatRate60Min ?? existingRates.flatRate60Min,
          updatedAt: now
        })
        .where(eq(readerRates.readerId, readerId));
    } else {
      // Create new rates
      await db.insert(readerRates).values({
        readerId,
        chatRate,
        audioRate,
        videoRate,
        flatRate15Min,
        flatRate30Min,
        flatRate45Min,
        flatRate60Min,
        createdAt: now,
        updatedAt: now
      });
    }
    
    res.status(200).json({ message: 'Rates updated successfully' });
  } catch (error) {
    console.error('Error setting reader rates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update reader's availability
router.post('/reader/availability', verifyAppwriteToken, isReader, async (req, res) => {
  try {
    const readerId = req.user!.id;
    const { isOnline, isAvailableForChat, isAvailableForAudio, isAvailableForVideo } = req.body;
    
    const now = new Date();
    
    // Update user's online status
    await db.update(users)
      .set({ isOnline: isOnline ?? true, lastActive: now })
      .where(eq(users.id, readerId));
    
    // Check if availability record exists
    const existingAvailability = await db.query.readerAvailability.findFirst({
      where: eq(readerAvailability.readerId, readerId)
    });
    
    if (existingAvailability) {
      // Update existing availability
      await db.update(readerAvailability)
        .set({
          isOnline: isOnline ?? existingAvailability.isOnline,
          lastOnlineTime: isOnline ? now : existingAvailability.lastOnlineTime,
          updatedAt: now
        })
        .where(eq(readerAvailability.readerId, readerId));
    } else {
      // Create new availability record
      await db.insert(readerAvailability).values({
        readerId,
        isOnline: isOnline ?? true,
        lastOnlineTime: now,
        createdAt: now,
        updatedAt: now
      });
    }
    
    // Update reader rates if provided
    if (isAvailableForChat !== undefined || isAvailableForAudio !== undefined || isAvailableForVideo !== undefined) {
      const rates = await db.query.readerRates.findFirst({
        where: eq(readerRates.readerId, readerId)
      });
      
      if (rates) {
        await db.update(readerRates)
          .set({
            isAvailableForChat: isAvailableForChat ?? rates.isAvailableForChat,
            isAvailableForAudio: isAvailableForAudio ?? rates.isAvailableForAudio,
            isAvailableForVideo: isAvailableForVideo ?? rates.isAvailableForVideo,
            updatedAt: now
          })
          .where(eq(readerRates.readerId, readerId));
      }
    }
    
    res.status(200).json({ message: 'Availability updated successfully' });
  } catch (error) {
    console.error('Error updating reader availability:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get reader's active sessions
router.get('/reader/sessions', verifyAppwriteToken, isReader, async (req, res) => {
  try {
    const readerId = req.user!.id;
    
    const sessions = await db.query.rtcSessions.findMany({
      where: and(
        eq(rtcSessions.readerId, readerId),
        eq(rtcSessions.status, 'active')
      ),
      with: {
        client: true
      },
      orderBy: desc(rtcSessions.createdAt)
    });
    
    res.json(sessions);
  } catch (error) {
    console.error('Error getting reader sessions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get reader's scheduled sessions
router.get('/reader/scheduled-sessions', verifyAppwriteToken, isReader, async (req, res) => {
  try {
    const readerId = req.user!.id;
    
    const sessions = await db.query.rtcSessions.findMany({
      where: and(
        eq(rtcSessions.readerId, readerId),
        eq(rtcSessions.status, 'scheduled'),
        gt(rtcSessions.scheduledStartTime!, new Date())
      ),
      with: {
        client: true
      },
      orderBy: desc(rtcSessions.scheduledStartTime!)
    });
    
    res.json(sessions);
  } catch (error) {
    console.error('Error getting reader scheduled sessions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Accept a session request
router.post('/reader/accept-session/:sessionId', verifyAppwriteToken, isReader, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const readerId = req.user!.id;
    
    // Get the session
    const session = await db.query.rtcSessions.findFirst({
      where: and(
        eq(rtcSessions.sessionId, sessionId),
        eq(rtcSessions.readerId, readerId),
        eq(rtcSessions.status, 'scheduled')
      ),
      with: {
        client: true
      }
    });
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found or already started' });
    }
    
    // If it's a pay-per-minute session, check if client has sufficient balance
    if (session.isPayPerMinute) {
      const hasBalance = await checkClientBalance(
        session.clientId,
        session.sessionType as 'chat' | 'audio' | 'video',
        readerId
      );
      
      if (!hasBalance) {
        return res.status(400).json({ message: 'Client has insufficient balance' });
      }
    }
    
    // Update session status
    await db.update(rtcSessions)
      .set({
        status: 'active',
        startTime: new Date(),
        updatedAt: new Date()
      })
      .where(eq(rtcSessions.sessionId, sessionId));
    
    // Create notification for client
    await db.insert(notifications).values({
      userId: session.clientId,
      type: 'session_accepted',
      message: `Your reading session with ${req.user!.fullName} has started`,
      relatedEntityId: session.id,
      relatedEntityType: 'rtc_session',
      createdAt: new Date()
    });
    
    res.status(200).json({ message: 'Session accepted successfully', session });
  } catch (error) {
    console.error('Error accepting session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// CLIENT ROUTES

// Get client's balance
router.get('/client/balance', verifyAppwriteToken, isClient, async (req, res) => {
  try {
    const clientId = req.user!.id;
    
    const balance = await getClientBalance(clientId);
    
    res.json({ balance });
  } catch (error) {
    console.error('Error getting client balance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add funds to client's balance
router.post('/client/add-funds', verifyAppwriteToken, isClient, async (req, res) => {
  try {
    const clientId = req.user!.id;
    const { amount, stripeToken } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    let paymentIntentId = null;
    
    // Get or create Stripe customer
    const user = await db.query.users.findFirst({
      where: eq(users.id, clientId)
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    let customer;
    if (user.stripeCustomerId) {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: {
          userId: user.id.toString()
        }
      });
      
      // Update user with Stripe customer ID
      await db.update(users)
        .set({ stripeCustomerId: customer.id })
        .where(eq(users.id, clientId));
    }
    
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: customer.id,
      payment_method_types: ['card'],
      description: `SoulSeer - Add funds to balance ($${amount})`,
      metadata: {
        userId: clientId.toString(),
        type: 'add_funds'
      }
    });
    
    paymentIntentId = paymentIntent.id;
    
    // Add funds to balance
    const success = await addFundsToClientBalance(clientId, amount);
    
    if (!success) {
      return res.status(500).json({ message: 'Failed to add funds to balance' });
    }
    
    res.status(200).json({
      message: 'Funds added successfully',
      balance: await getClientBalance(clientId),
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Error adding funds:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get available readers
router.get('/client/available-readers', verifyAppwriteToken, async (req, res) => {
  try {
    const { type } = req.query;
    
    let availableReaders;
    
    if (type) {
      // Filter by session type
      const sessionType = type as string;
      
      availableReaders = await db.query.users.findMany({
        where: and(
          eq(users.role, 'reader'),
          eq(users.isOnline, true)
        ),
        with: {
          readerRates: {
            where: sessionType === 'chat'
              ? eq(readerRates.isAvailableForChat, true)
              : sessionType === 'audio'
                ? eq(readerRates.isAvailableForAudio, true)
                : eq(readerRates.isAvailableForVideo, true)
          }
        }
      });
      
      // Filter out readers without rates or not available for the session type
      availableReaders = availableReaders.filter(reader => reader.readerRates.length > 0);
    } else {
      // Get all available readers
      availableReaders = await db.query.users.findMany({
        where: and(
          eq(users.role, 'reader'),
          eq(users.isOnline, true)
        ),
        with: {
          readerRates: true
        }
      });
      
      // Filter out readers without rates
      availableReaders = availableReaders.filter(reader => reader.readerRates.length > 0);
    }
    
    // Remove sensitive data
    const cleanedReaders = availableReaders.map(reader => {
      const { password, ...cleanedReader } = reader;
      return cleanedReader;
    });
    
    res.json(cleanedReaders);
  } catch (error) {
    console.error('Error getting available readers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Request a pay-per-minute session
router.post('/client/request-session', verifyAppwriteToken, isClient, async (req, res) => {
  try {
    const clientId = req.user!.id;
    const { readerId, sessionType } = req.body;
    
    if (!readerId || !sessionType) {
      return res.status(400).json({ message: 'Reader ID and session type are required' });
    }
    
    // Check if session type is valid
    if (!['chat', 'audio', 'video'].includes(sessionType)) {
      return res.status(400).json({ message: 'Invalid session type' });
    }
    
    // Check if reader exists and is available
    const reader = await db.query.users.findFirst({
      where: and(
        eq(users.id, readerId),
        eq(users.role, 'reader'),
        eq(users.isOnline, true)
      ),
      with: {
        readerRates: true
      }
    });
    
    if (!reader) {
      return res.status(404).json({ message: 'Reader not found or not available' });
    }
    
    // Check if reader is available for this session type
    const readerRate = reader.readerRates[0];
    if (!readerRate) {
      return res.status(400).json({ message: 'Reader has not set their rates' });
    }
    
    if (
      (sessionType === 'chat' && !readerRate.isAvailableForChat) ||
      (sessionType === 'audio' && !readerRate.isAvailableForAudio) ||
      (sessionType === 'video' && !readerRate.isAvailableForVideo)
    ) {
      return res.status(400).json({ message: `Reader is not available for ${sessionType} sessions` });
    }
    
    // Check if client has sufficient balance
    const hasBalance = await checkClientBalance(clientId, sessionType as 'chat' | 'audio' | 'video', readerId);
    
    if (!hasBalance) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    // Create a new session
    const sessionId = await createSession(readerId, clientId, sessionType as 'chat' | 'audio' | 'video', true);
    
    // Create notification for reader
    await db.insert(notifications).values({
      userId: readerId,
      type: 'new_session_request',
      message: `New ${sessionType} reading request from ${req.user!.fullName}`,
      relatedEntityId: parseInt(sessionId.replace(/-/g, '').substring(0, 9), 16) % 1000000000, // Generate a numeric ID from UUID
      relatedEntityType: 'rtc_session',
      createdAt: new Date()
    });
    
    res.status(201).json({
      message: 'Session request created successfully',
      sessionId
    });
  } catch (error) {
    console.error('Error requesting session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Request a scheduled session
router.post('/client/schedule-session', verifyAppwriteToken, isClient, async (req, res) => {
  try {
    const clientId = req.user!.id;
    const { readerId, sessionType, scheduledStartTime, duration } = req.body;
    
    if (!readerId || !sessionType || !scheduledStartTime || !duration) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if duration is valid (15, 30, 45, or 60 minutes)
    if (![15, 30, 45, 60].includes(duration)) {
      return res.status(400).json({ message: 'Invalid duration. Must be 15, 30, 45, or 60 minutes' });
    }
    
    // Check if scheduled time is in the future
    const startTime = new Date(scheduledStartTime);
    if (startTime <= new Date()) {
      return res.status(400).json({ message: 'Scheduled time must be in the future' });
    }
    
    // Check if reader exists
    const reader = await db.query.users.findFirst({
      where: and(
        eq(users.id, readerId),
        eq(users.role, 'reader')
      ),
      with: {
        readerRates: true
      }
    });
    
    if (!reader) {
      return res.status(404).json({ message: 'Reader not found' });
    }
    
    // Check if reader has set flat rates
    const readerRate = reader.readerRates[0];
    if (!readerRate) {
      return res.status(400).json({ message: 'Reader has not set their rates' });
    }
    
    // Get the appropriate flat rate
    let flatRate;
    switch (duration) {
      case 15:
        flatRate = readerRate.flatRate15Min;
        break;
      case 30:
        flatRate = readerRate.flatRate30Min;
        break;
      case 45:
        flatRate = readerRate.flatRate45Min;
        break;
      case 60:
        flatRate = readerRate.flatRate60Min;
        break;
    }
    
    if (!flatRate) {
      return res.status(400).json({ message: `Reader has not set a flat rate for ${duration} minutes` });
    }
    
    // Create a Stripe payment intent for the full amount
    const user = await db.query.users.findFirst({
      where: eq(users.id, clientId)
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    let customer;
    if (user.stripeCustomerId) {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: {
          userId: user.id.toString()
        }
      });
      
      // Update user with Stripe customer ID
      await db.update(users)
        .set({ stripeCustomerId: customer.id })
        .where(eq(users.id, clientId));
    }
    
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(flatRate) * 100), // Convert to cents
      currency: 'usd',
      customer: customer.id,
      payment_method_types: ['card'],
      description: `SoulSeer - ${duration} minute ${sessionType} reading with ${reader.fullName}`,
      metadata: {
        userId: clientId.toString(),
        readerId: readerId.toString(),
        sessionType,
        duration: duration.toString(),
        type: 'scheduled_session'
      }
    });
    
    // Create a new session in database
    const sessionId = uuidv4();
    
    await db.insert(rtcSessions).values({
      sessionId,
      readerId,
      clientId,
      sessionType,
      scheduledStartTime: startTime,
      scheduledDuration: duration,
      status: 'scheduled',
      isPayPerMinute: false,
      createdAt: new Date(),
      amountCharged: flatRate
    });
    
    // Create notification for reader
    await db.insert(notifications).values({
      userId: readerId,
      type: 'new_session_request',
      message: `New scheduled ${sessionType} reading request from ${user.fullName} for ${startTime.toLocaleString()}`,
      relatedEntityId: parseInt(sessionId.replace(/-/g, '').substring(0, 9), 16) % 1000000000,
      relatedEntityType: 'rtc_session',
      createdAt: new Date()
    });
    
    res.status(201).json({
      message: 'Scheduled session created successfully',
      sessionId,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Error scheduling session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get session details
router.get('/session/:sessionId', verifyAppwriteToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.id;
    
    // Get the session
    const session = await db.query.rtcSessions.findFirst({
      where: eq(rtcSessions.sessionId, sessionId),
      with: {
        reader: true,
        client: true
      }
    });
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Check if user is part of this session
    if (session.readerId !== userId && session.clientId !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    // Clean sensitive data
    const { password: _, ...reader } = session.reader || {};
    const { password: __, ...client } = session.client || {};
    
    const cleanedSession = {
      ...session,
      reader,
      client
    };
    
    res.json(cleanedSession);
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Webhook for Stripe events
router.post('/webhook', async (req, res) => {
  let event;
  
  try {
    const signature = req.headers['stripe-signature'];
    
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      signature || '',
      process.env.STRIPE_WEBHOOK_SIGNING_SECRET || ''
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Handle different event types
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      // Handle successful payment
      if (paymentIntent.metadata.type === 'add_funds') {
        // Funds already added when creating the payment intent
        console.log(`Payment for adding funds succeeded: ${paymentIntent.id}`);
      } else if (paymentIntent.metadata.type === 'scheduled_session') {
        // Payment for scheduled session succeeded
        const { userId, readerId, sessionType, duration } = paymentIntent.metadata;
        
        console.log(`Payment for scheduled session succeeded: ${paymentIntent.id}`);
      }
      break;
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log(`Payment failed: ${failedPayment.id}`);
      break;
  }
  
  res.status(200).json({ received: true });
});

export default router; 