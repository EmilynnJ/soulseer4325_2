import Stripe from 'stripe';

let stripe: Stripe | null = null;

try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Error: STRIPE_SECRET_KEY environment variable is missing');
  } else {
    console.log('Initializing Stripe with key length:', process.env.STRIPE_SECRET_KEY.length);
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    });
    console.log('Stripe initialized successfully');
  }
} catch (error) {
  console.error('Error initializing Stripe:', error);
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export async function createPaymentIntent({
  amount,
  currency = 'usd',
  customerId,
  metadata = {},
}: CreatePaymentIntentParams) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      ...(customerId ? { customer: customerId } : {}),
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
}

export async function updatePaymentIntent(
  paymentIntentId: string,
  updateData: {
    amount?: number;
    metadata?: Record<string, string>;
  }
) {
  try {
    const { amount, metadata } = updateData;
    const updateParams: Stripe.PaymentIntentUpdateParams = {};

    if (amount !== undefined) {
      updateParams.amount = Math.round(amount * 100); // Convert to cents
    }

    if (metadata) {
      updateParams.metadata = metadata;
    }

    const paymentIntent = await stripe.paymentIntents.update(
      paymentIntentId,
      updateParams
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  } catch (error: any) {
    console.error('Error updating payment intent:', error);
    throw new Error(`Failed to update payment intent: ${error.message}`);
  }
}

export async function capturePaymentIntent(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100, // Convert from cents to dollars
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    console.error('Error capturing payment intent:', error);
    throw new Error(`Failed to capture payment intent: ${error.message}`);
  }
}

export async function capturePartialPayment(paymentIntentId: string, amount: number) {
  try {
    // First retrieve the payment intent to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Only proceed if the payment intent is in a capturable state
    if (paymentIntent.status !== 'requires_capture') {
      throw new Error(`Payment intent is not in a capturable state. Current status: ${paymentIntent.status}`);
    }
    
    // Convert amount to cents and ensure it's an integer
    const amountInCents = Math.round(amount * 100);
    
    // Ensure the amount to capture doesn't exceed the authorized amount
    if (amountInCents > paymentIntent.amount) {
      throw new Error(`Cannot capture ${amountInCents} cents, which exceeds the authorized amount of ${paymentIntent.amount} cents`);
    }
    
    // Capture the specified amount
    const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: amountInCents
    });
    
    return {
      status: capturedPayment.status,
      amount: capturedPayment.amount_received / 100, // Convert from cents to dollars
      amountCaptured: amountInCents / 100, // Convert from cents to dollars
      paymentIntentId: capturedPayment.id,
    };
  } catch (error: any) {
    console.error('Error capturing partial payment:', error);
    throw new Error(`Failed to capture partial payment: ${error.message}`);
  }
}

export async function updateAuthorizedAmount(paymentIntentId: string, amount: number) {
  try {
    // First retrieve the payment intent to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Only proceed if the payment intent is in an updatable state
    const updatableStatuses = ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture'];
    if (!updatableStatuses.includes(paymentIntent.status)) {
      throw new Error(`Payment intent cannot be updated. Current status: ${paymentIntent.status}`);
    }
    
    // Convert amount to cents and ensure it's an integer
    const amountInCents = Math.round(amount * 100);
    
    // Ensure the new amount is greater than the current amount
    if (amountInCents <= paymentIntent.amount) {
      throw new Error(`New amount (${amountInCents} cents) must be greater than current amount (${paymentIntent.amount} cents)`);
    }
    
    // Update the payment intent with the new amount
    const updatedPaymentIntent = await stripe.paymentIntents.update(
      paymentIntentId,
      {
        amount: amountInCents
      }
    );
    
    return {
      status: updatedPaymentIntent.status,
      amount: updatedPaymentIntent.amount / 100, // Convert from cents to dollars
      paymentIntentId: updatedPaymentIntent.id,
    };
  } catch (error: any) {
    console.error('Error updating authorized amount:', error);
    throw new Error(`Failed to update authorized amount: ${error.message}`);
  }
}

export async function createCustomer({
  email,
  name,
  metadata = {},
}: {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}) {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    });
    return customer;
  } catch (error: any) {
    console.error('Error creating customer:', error);
    throw new Error(`Failed to create customer: ${error.message}`);
  }
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error: any) {
    console.error('Error retrieving payment intent:', error);
    throw new Error(`Failed to retrieve payment intent: ${error.message}`);
  }
}

export async function createOnDemandReadingPayment(
  pricePerMinute: number, // in cents
  clientId: number, // ID of the client
  clientName: string, // Name of the client
  readerId: number, // ID of the reader
  readingId: number, // ID of the reading session
  readingType: string, // Type of reading (chat, phone, video)
) {
  try {
    // Calculate initial amount (10 minutes as a pre-authorization)
    const initialAmount = pricePerMinute * 10;
    
    // Create a Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: initialAmount,
      currency: 'usd',
      metadata: {
        readingId: readingId.toString(),
        clientId: clientId.toString(),
        readerId: readerId.toString(),
        readingType,
        pricePerMinute: pricePerMinute.toString(),
        purpose: 'reading_payment'
      },
      capture_method: 'manual', // Authorize only initially, capture exact amount later
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentLinkUrl: `/reading-session/${readingId}?paymentIntentId=${paymentIntent.id}`,
      amount: initialAmount,
      paymentIntent: paymentIntent, // Return the full PaymentIntent object for incremental updates
      pricePerMinute: pricePerMinute // Include the price per minute for easy reference
    };
  } catch (error: any) {
    console.error('Error creating on-demand reading payment:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function fetchStripeProducts() {
  try {
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price']
    });
    
    return products.data.map(product => {
      const price = product.default_price as Stripe.Price;
      return {
        stripeProductId: product.id,
        stripePriceId: price?.id,
        name: product.name,
        description: product.description || '',
        price: price?.unit_amount || 0, // in cents
        imageUrl: product.images?.[0] || 'https://placehold.co/600x400?text=No+Image',
        category: product.metadata?.category || 'other',
        stock: parseInt(product.metadata?.stock || '100'),
        featured: product.metadata?.featured === 'true'
      };
    });
  } catch (error: any) {
    console.error('Error fetching Stripe products:', error);
    throw new Error(`Failed to fetch Stripe products: ${error.message}`);
  }
}

export async function syncProductWithStripe(product: {
  id: number;
  name: string;
  description: string;
  price: number; // in cents
  imageUrl: string;
  category: string;
  stock: number;
  featured: boolean;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
}) {
  try {
    let stripeProduct;
    let stripePrice;
    
    // If product exists in Stripe, update it
    if (product.stripeProductId) {
      stripeProduct = await stripe.products.update(
        product.stripeProductId,
        {
          name: product.name,
          description: product.description,
          images: [product.imageUrl],
          metadata: {
            category: product.category,
            stock: product.stock.toString(),
            featured: product.featured.toString()
          }
        }
      );
      
      // If price has changed, create a new price
      if (product.stripePriceId) {
        const existingPrice = await stripe.prices.retrieve(product.stripePriceId);
        if (existingPrice.unit_amount !== product.price) {
          // Create new price and update the product's default price
          stripePrice = await stripe.prices.create({
            product: product.stripeProductId,
            unit_amount: product.price,
            currency: 'usd',
          });
          
          // Update the product's default price
          await stripe.products.update(
            product.stripeProductId,
            {
              default_price: stripePrice.id
            }
          );
        } else {
          stripePrice = existingPrice;
        }
      } else {
        // Create a new price if none exists
        stripePrice = await stripe.prices.create({
          product: product.stripeProductId,
          unit_amount: product.price,
          currency: 'usd',
        });
        
        // Update the product's default price
        await stripe.products.update(
          product.stripeProductId,
          {
            default_price: stripePrice.id
          }
        );
      }
    } else {
      // Create a new product in Stripe
      stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description,
        images: [product.imageUrl],
        default_price_data: {
          unit_amount: product.price,
          currency: 'usd',
        },
        metadata: {
          category: product.category,
          stock: product.stock.toString(),
          featured: product.featured.toString()
        }
      });
      
      // Get the default price ID
      const price = stripeProduct.default_price as string;
      stripePrice = await stripe.prices.retrieve(price);
    }
    
    return {
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id
    };
  } catch (error: any) {
    console.error('Error syncing product with Stripe:', error);
    throw new Error(`Failed to sync product with Stripe: ${error.message}`);
  }
}

export default {
  createPaymentIntent,
  updatePaymentIntent,
  capturePaymentIntent,
  capturePartialPayment,
  updateAuthorizedAmount,
  createCustomer,
  retrievePaymentIntent,
  createOnDemandReadingPayment,
  fetchStripeProducts,
  syncProductWithStripe,
};
