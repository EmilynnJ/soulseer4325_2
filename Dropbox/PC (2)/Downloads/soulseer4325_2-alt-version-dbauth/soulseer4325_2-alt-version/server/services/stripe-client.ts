import Stripe from 'stripe';
import { log } from '../vite';

// Initialize Stripe with API key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

/**
 * Create a payment intent for an on-demand reading
 */
async function createOnDemandReadingPayment(
  pricePerMinute: number,
  clientId: number,
  clientName: string,
  readerId: number,
  readingId: number,
  readingType: string
): Promise<{
  success: boolean;
  paymentIntentId?: string;
  paymentLinkUrl?: string;
  error?: string;
}> {
  try {
    // Calculate initial amount to authorize (30 minutes worth)
    const initialAmount = pricePerMinute * 30; // 30 minutes in cents
    
    // Create a payment intent with the initial amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: initialAmount,
      currency: 'usd',
      capture_method: 'manual', // We'll capture the payment manually after the reading
      setup_future_usage: 'off_session', // Allow future charges
      metadata: {
        clientId: clientId.toString(),
        readerId: readerId.toString(),
        readingId: readingId.toString(),
        readingType,
        pricePerMinute: pricePerMinute.toString()
      },
      description: `SoulSeer ${readingType} reading with Reader #${readerId}`,
      statement_descriptor: 'SOULSEER READING',
      receipt_email: clientName.includes('@') ? clientName : undefined
    });
    
    // Create a payment link for the client to complete the payment
    const paymentLink = `${process.env.VITE_API_URL || ''}/checkout?payment_intent_id=${paymentIntent.id}`;
    
    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      paymentLinkUrl: paymentLink
    };
  } catch (error) {
    log(`Error creating payment intent: ${error}`, 'stripe');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Capture a partial payment from a payment intent
 */
async function capturePartialPayment(
  paymentIntentId: string,
  amountToCapture: number
): Promise<{
  success: boolean;
  amountCaptured: number;
  error?: string;
}> {
  try {
    // Get the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Check if the payment intent is in a capturable state
    if (paymentIntent.status !== 'requires_capture') {
      return {
        success: false,
        amountCaptured: 0,
        error: `Payment intent is in ${paymentIntent.status} state, not capturable`
      };
    }
    
    // Convert amount to cents
    const amountInCents = Math.round(amountToCapture * 100);
    
    // Ensure we don't capture more than the authorized amount
    const amountToCaptureCents = Math.min(amountInCents, paymentIntent.amount);
    
    // Capture the payment
    const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: amountToCaptureCents
    });
    
    return {
      success: true,
      amountCaptured: capturedPayment.amount_captured / 100 // Convert back to dollars
    };
  } catch (error) {
    log(`Error capturing payment: ${error}`, 'stripe');
    return {
      success: false,
      amountCaptured: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a payment intent for a scheduled reading
 */
async function createScheduledReadingPayment(
  totalAmount: number,
  clientId: number,
  clientName: string,
  readerId: number,
  readingId: number,
  readingType: string
): Promise<{
  success: boolean;
  paymentIntentId?: string;
  paymentLinkUrl?: string;
  error?: string;
}> {
  try {
    // Create a payment intent with the total amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      metadata: {
        clientId: clientId.toString(),
        readerId: readerId.toString(),
        readingId: readingId.toString(),
        readingType,
        scheduledReading: 'true'
      },
      description: `SoulSeer scheduled ${readingType} reading with Reader #${readerId}`,
      statement_descriptor: 'SOULSEER READING',
      receipt_email: clientName.includes('@') ? clientName : undefined
    });
    
    // Create a payment link for the client to complete the payment
    const paymentLink = `${process.env.VITE_API_URL || ''}/checkout?payment_intent_id=${paymentIntent.id}`;
    
    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      paymentLinkUrl: paymentLink
    };
  } catch (error) {
    log(`Error creating payment intent: ${error}`, 'stripe');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Process a gift payment
 */
async function processGiftPayment(
  amount: number,
  senderId: number,
  recipientId: number,
  livestreamId?: number,
  message?: string
): Promise<{
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}> {
  try {
    // Calculate the split (70% to reader, 30% to platform)
    const readerAmount = Math.round(amount * 0.7);
    const platformAmount = amount - readerAmount;
    
    // Create a payment intent for the gift
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        senderId: senderId.toString(),
        recipientId: recipientId.toString(),
        livestreamId: livestreamId?.toString() || '',
        giftType: 'livestream',
        readerAmount: readerAmount.toString(),
        platformAmount: platformAmount.toString()
      },
      description: `SoulSeer gift to Reader #${recipientId}`,
      statement_descriptor: 'SOULSEER GIFT',
      confirm: true, // Confirm the payment immediately
      automatic_payment_methods: {
        enabled: true
      }
    });
    
    return {
      success: true,
      paymentIntentId: paymentIntent.id
    };
  } catch (error) {
    log(`Error processing gift payment: ${error}`, 'stripe');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Add funds to client balance
 */
async function addFundsToBalance(
  amount: number,
  userId: number,
  email?: string
): Promise<{
  success: boolean;
  paymentIntentId?: string;
  paymentLinkUrl?: string;
  error?: string;
}> {
  try {
    // Create a payment intent for adding funds
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        userId: userId.toString(),
        transactionType: 'add_funds'
      },
      description: 'Add funds to SoulSeer account',
      statement_descriptor: 'SOULSEER FUNDS',
      receipt_email: email
    });
    
    // Create a payment link for the client to complete the payment
    const paymentLink = `${process.env.VITE_API_URL || ''}/checkout?payment_intent_id=${paymentIntent.id}&add_funds=true`;
    
    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      paymentLinkUrl: paymentLink
    };
  } catch (error) {
    log(`Error adding funds: ${error}`, 'stripe');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default {
  createOnDemandReadingPayment,
  capturePartialPayment,
  createScheduledReadingPayment,
  processGiftPayment,
  addFundsToBalance
};