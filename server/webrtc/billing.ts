import { db } from '../db';
import { rtcSessions, clientBalances, readerRates, users, notifications } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import Stripe from 'stripe';
import { getSessionInfo } from './signaling';
import { sendNotificationToUser } from './signaling';

// Initialize Stripe with API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

// Constant to determine billing frequency in milliseconds
const BILLING_INTERVAL = 60000; // 1 minute in ms (use 5000 for testing - 5 seconds)

// Start the billing service
let billingInterval: NodeJS.Timeout;

export function startBillingService() {
  // Clear any existing interval
  if (billingInterval) clearInterval(billingInterval);
  
  // Set up billing interval
  billingInterval = setInterval(async () => {
    try {
      await processBilling();
    } catch (error) {
      console.error('Error in billing service:', error);
    }
  }, BILLING_INTERVAL);
  
  console.log('WebRTC billing service started');
  
  return () => {
    if (billingInterval) clearInterval(billingInterval);
    console.log('WebRTC billing service stopped');
  };
}

// Process billing for all active sessions
async function processBilling() {
  console.log('Processing billing for active sessions...');
  
  // Get all active sessions from signaling module
  const activeSessions = getActiveSessions();
  
  // Process each active session
  for (const [sessionId, session] of activeSessions) {
    try {
      if (!session.isPayPerMinute) continue;
      
      // Skip if no lastBillingTime or session not active
      if (!session.lastBillingTime || session.status !== 'active') continue;
      
      // Calculate time since last billing
      const now = new Date();
      const timeSinceLastBilling = now.getTime() - session.lastBillingTime.getTime();
      
      // Skip if not enough time has passed
      if (timeSinceLastBilling < BILLING_INTERVAL) continue;
      
      // Get reader's rates
      const readerRate = await db.query.readerRates.findFirst({
        where: eq(readerRates.readerId, session.readerId)
      });
      
      if (!readerRate) {
        console.error(`No rates found for reader ${session.readerId}`);
        continue;
      }
      
      // Get the appropriate rate based on session type
      let ratePerMinute = 0;
      switch (session.type) {
        case 'chat':
          ratePerMinute = Number(readerRate.chatRate);
          break;
        case 'audio':
          ratePerMinute = Number(readerRate.audioRate);
          break;
        case 'video':
          ratePerMinute = Number(readerRate.videoRate);
          break;
      }
      
      // Get client's balance
      const clientBalance = await db.query.clientBalances.findFirst({
        where: eq(clientBalances.clientId, session.clientId)
      });
      
      if (!clientBalance) {
        console.error(`No balance found for client ${session.clientId}`);
        
        // End the session due to missing balance
        await endSessionDueToInsufficientFunds(sessionId, 'No balance found');
        continue;
      }
      
      // Calculate minutes to charge (rounded to 2 decimal places)
      const minutesToCharge = parseFloat((timeSinceLastBilling / BILLING_INTERVAL).toFixed(2));
      const amountToCharge = parseFloat((minutesToCharge * ratePerMinute).toFixed(2));
      
      // Check if client has enough balance
      if (Number(clientBalance.balance) < amountToCharge) {
        // End the session due to insufficient funds
        await endSessionDueToInsufficientFunds(sessionId, 'Insufficient funds');
        continue;
      }
      
      // Update client balance
      await db.update(clientBalances)
        .set({
          balance: Number(clientBalance.balance) - amountToCharge,
          updatedAt: now
        })
        .where(eq(clientBalances.clientId, session.clientId));
      
      // Update reader balance (add 70% of the charge to the reader's account)
      const readerAmount = parseFloat((amountToCharge * 0.7).toFixed(2));
      await db.update(users)
        .set({
          accountBalance: (u) => u.accountBalance + Math.round(readerAmount * 100) // Convert to cents
        })
        .where(eq(users.id, session.readerId));
      
      // Update session in database
      await db.update(rtcSessions)
        .set({
          lastBillingTime: now,
          amountCharged: (s) => s.amountCharged ? Number(s.amountCharged) + amountToCharge : amountToCharge,
          totalMinutes: (s) => s.totalMinutes ? Number(s.totalMinutes) + minutesToCharge : minutesToCharge,
          updatedAt: now
        })
        .where(eq(rtcSessions.sessionId, sessionId));
      
      // Update session in memory
      session.lastBillingTime = now;
      
      console.log(`Charged client ${session.clientId} $${amountToCharge} for ${minutesToCharge} minutes with ${session.type} session`);
      
      // Create a transaction record in Stripe for the charge
      const client = await db.query.users.findFirst({
        where: eq(users.id, session.clientId)
      });
      
      const reader = await db.query.users.findFirst({
        where: eq(users.id, session.readerId)
      });
      
      if (client?.stripeCustomerId) {
        await stripe.charges.create({
          amount: Math.round(amountToCharge * 100), // Convert to cents
          currency: 'usd',
          customer: client.stripeCustomerId,
          description: `SoulSeer ${session.type} reading with ${reader?.fullName || 'Reader'} - ${minutesToCharge} minutes`,
          metadata: {
            readerId: session.readerId.toString(),
            clientId: session.clientId.toString(),
            sessionId,
            sessionType: session.type,
            minutes: minutesToCharge.toString()
          }
        });
      }
      
      // Notify clients about the charge
      sendNotificationToUser(session.clientId, {
        type: 'balance-update',
        message: `You were charged $${amountToCharge} for ${minutesToCharge} minutes with ${reader?.fullName || 'Reader'}`,
        currentBalance: Number(clientBalance.balance) - amountToCharge
      });
      
      sendNotificationToUser(session.readerId, {
        type: 'earnings-update',
        message: `You earned $${readerAmount} from ${client?.fullName || 'Client'} for ${minutesToCharge} minutes`,
        amount: readerAmount
      });
      
    } catch (error) {
      console.error(`Error processing billing for session ${sessionId}:`, error);
    }
  }
}

// Handle ending a session due to insufficient funds
async function endSessionDueToInsufficientFunds(sessionId: string, reason: string) {
  const session = getSessionInfo(sessionId);
  
  if (!session) return;
  
  // Update session status in memory
  session.status = 'ended';
  session.endTime = new Date();
  
  // Calculate total duration
  let totalMinutes = 0;
  if (session.startTime) {
    const durationMs = session.endTime.getTime() - session.startTime.getTime();
    totalMinutes = parseFloat((durationMs / (1000 * 60)).toFixed(2));
  }
  
  // Update session in database
  await db.update(rtcSessions)
    .set({
      status: 'completed',
      endTime: session.endTime,
      totalMinutes,
      updatedAt: session.endTime
    })
    .where(eq(rtcSessions.sessionId, sessionId));
  
  // Create notifications
  await db.insert(notifications).values({
    userId: session.clientId,
    type: 'session_cancelled',
    message: `Your session ended automatically: ${reason}`,
    relatedEntityId: parseInt(sessionId),
    relatedEntityType: 'rtc_session',
    createdAt: new Date()
  });
  
  await db.insert(notifications).values({
    userId: session.readerId,
    type: 'session_cancelled',
    message: `Session with client ended automatically: ${reason}`,
    relatedEntityId: parseInt(sessionId),
    relatedEntityType: 'rtc_session',
    createdAt: new Date()
  });
  
  // Notify both users
  sendNotificationToUser(session.clientId, {
    type: 'session-ended',
    message: `Your session ended automatically: ${reason}`,
    sessionId
  });
  
  sendNotificationToUser(session.readerId, {
    type: 'session-ended',
    message: `Session with client ended automatically: ${reason}`,
    sessionId
  });
  
  console.log(`Session ${sessionId} ended due to ${reason}`);
}

// Function to check if a client has sufficient balance for a session
export async function checkClientBalance(clientId: number, sessionType: 'chat' | 'audio' | 'video', readerId: number, duration?: number) {
  try {
    // Get client's balance
    const clientBalance = await db.query.clientBalances.findFirst({
      where: eq(clientBalances.clientId, clientId)
    });
    
    if (!clientBalance) return false;
    
    // Get reader's rate
    const readerRate = await db.query.readerRates.findFirst({
      where: eq(readerRates.readerId, readerId)
    });
    
    if (!readerRate) return false;
    
    // Get appropriate rate based on session type
    let rate = 0;
    switch (sessionType) {
      case 'chat':
        rate = Number(readerRate.chatRate);
        break;
      case 'audio':
        rate = Number(readerRate.audioRate);
        break;
      case 'video':
        rate = Number(readerRate.videoRate);
        break;
    }
    
    // If duration is specified, check if client has enough for the entire duration
    if (duration) {
      return Number(clientBalance.balance) >= (rate * duration);
    }
    
    // Otherwise, check if client has enough for at least 1 minute
    return Number(clientBalance.balance) >= rate;
    
  } catch (error) {
    console.error('Error checking client balance:', error);
    return false;
  }
}

// Function to add funds to client balance
export async function addFundsToClientBalance(clientId: number, amount: number) {
  try {
    // Get client's balance
    const clientBalance = await db.query.clientBalances.findFirst({
      where: eq(clientBalances.clientId, clientId)
    });
    
    const now = new Date();
    
    if (clientBalance) {
      // Update existing balance
      await db.update(clientBalances)
        .set({
          balance: Number(clientBalance.balance) + amount,
          updatedAt: now
        })
        .where(eq(clientBalances.clientId, clientId));
    } else {
      // Create new balance entry
      await db.insert(clientBalances).values({
        clientId,
        balance: amount,
        updatedAt: now
      });
    }
    
    // Create a notification
    await db.insert(notifications).values({
      userId: clientId,
      type: 'payment_received',
      message: `$${amount} has been added to your account balance`,
      createdAt: now
    });
    
    // Notify the client
    sendNotificationToUser(clientId, {
      type: 'balance-update',
      message: `$${amount} has been added to your account balance`,
      amount
    });
    
    return true;
  } catch (error) {
    console.error('Error adding funds to client balance:', error);
    return false;
  }
}

// Function to get client's current balance
export async function getClientBalance(clientId: number) {
  try {
    const clientBalance = await db.query.clientBalances.findFirst({
      where: eq(clientBalances.clientId, clientId)
    });
    
    return clientBalance ? Number(clientBalance.balance) : 0;
  } catch (error) {
    console.error('Error getting client balance:', error);
    return 0;
  }
}

// Get active sessions from the signaling service
function getActiveSessions() {
  return getSessionInfo ? getSessionInfo('all') : new Map();
} 