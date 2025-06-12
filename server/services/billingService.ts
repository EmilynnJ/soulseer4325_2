import { neon } from '@neondatabase/serverless';
import { storage } from '../storage';
import { sendToUser } from './signaling';

const sql = neon(process.env.DATABASE_URL!);

export class BillingService {
  private static instance: BillingService;
  private billingInterval: NodeJS.Timeout | null = null;

  public static getInstance(): BillingService {
    if (!BillingService.instance) {
      BillingService.instance = new BillingService();
    }
    return BillingService.instance;
  }

  public startBillingService() {
    console.log('Starting billing service...');
    
    // Clear any existing interval
    if (this.billingInterval) {
      clearInterval(this.billingInterval);
    }

    // Start billing every minute (60000ms)
    this.billingInterval = setInterval(async () => {
      await this.processBilling();
    }, 60000);
  }

  public stopBillingService() {
    if (this.billingInterval) {
      clearInterval(this.billingInterval);
      this.billingInterval = null;
      console.log('Billing service stopped');
    }
  }

  private async processBilling() {
    try {
      console.log('Processing billing for active sessions...');
      
      // Get active sessions with proper error handling
      const activeSessions = await this.getActiveSessions();
      
      // Ensure activeSessions is an array
      if (!Array.isArray(activeSessions)) {
        console.log('No active sessions found or invalid data returned');
        return;
      }

      if (activeSessions.length === 0) {
        console.log('No active sessions to process');
        return;
      }

      console.log(`Found ${activeSessions.length} active sessions`);

      // Process each session
      for (const session of activeSessions) {
        try {
          await this.processSessionBilling(session);
        } catch (sessionError) {
          console.error(`Error processing billing for session ${session.id}:`, sessionError);
          // Continue with other sessions even if one fails
        }
      }
    } catch (error) {
      console.error('Error in billing service:', error);
    }
  }

  private async getActiveSessions() {
    try {
      const result = await sql`
        SELECT 
          s.id,
          s.client_id,
          s.reader_id,
          s.session_type,
          s.started_at,
          s.last_billed_at,
          r.chat_rate,
          r.audio_rate,
          r.video_rate,
          cb.balance as client_balance
        FROM rtc_sessions s
        JOIN reader_rates r ON s.reader_id = r.reader_id
        JOIN client_balances cb ON s.client_id = cb.client_id
        WHERE s.status = 'active'
        AND s.started_at IS NOT NULL
      `;

      return result || [];
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return []; // Return empty array instead of undefined
    }
  }

  private async processSessionBilling(session: any) {
    try {
      const now = new Date();
      const lastBilled = session.last_billed_at ? new Date(session.last_billed_at) : new Date(session.started_at);
      
      // Check if a full minute has passed since last billing
      const minutesSinceLastBill = (now.getTime() - lastBilled.getTime()) / (1000 * 60);
      
      if (minutesSinceLastBill < 1) {
        return; // Not time to bill yet
      }

      // Determine the rate based on session type
      let ratePerMinute = 0;
      switch (session.session_type) {
        case 'chat':
          ratePerMinute = parseFloat(session.chat_rate) || 0;
          break;
        case 'audio':
          ratePerMinute = parseFloat(session.audio_rate) || 0;
          break;
        case 'video':
          ratePerMinute = parseFloat(session.video_rate) || 0;
          break;
        default:
          console.warn(`Unknown session type: ${session.session_type}`);
          return;
      }

      if (ratePerMinute <= 0) {
        console.warn(`Invalid rate for session ${session.id}: ${ratePerMinute}`);
        return;
      }

      // Check if client has sufficient balance
      const clientBalance = parseFloat(session.client_balance) || 0;
      
      if (clientBalance < ratePerMinute) {
        console.log(`Insufficient balance for session ${session.id}. Ending session.`);
        await this.endSessionDueToInsufficientFunds(session.id);
        return;
      }

      // Calculate minutes to bill (floor to only bill complete minutes)
      const minutesToBill = Math.floor(minutesSinceLastBill);
      const amountToCharge = ratePerMinute * minutesToBill;

      // Process the billing
      await this.chargeBilling(session, amountToCharge, minutesToBill);
      
      console.log(`Billed session ${session.id}: $${amountToCharge} for ${minutesToBill} minute(s)`);
      
    } catch (error) {
      console.error(`Error processing session billing for ${session.id}:`, error);
    }
  }

  private async chargeBilling(session: any, amount: number, minutes: number) {
    try {
      // Start transaction
      await sql`BEGIN`;

      // Deduct from client balance
      await sql`
        UPDATE client_balances 
        SET balance = balance - ${amount}
        WHERE client_id = ${session.client_id}
      `;

      // Add to reader earnings (70% to reader, 30% platform fee)
      const readerEarnings = amount * 0.7;
      await sql`
        INSERT INTO reader_earnings (reader_id, session_id, amount, earned_at)
        VALUES (${session.reader_id}, ${session.id}, ${readerEarnings}, NOW())
      `;

      // Update session with last billed time and total charged
      await sql`
        UPDATE rtc_sessions 
        SET 
          last_billed_at = NOW(),
          total_minutes = COALESCE(total_minutes, 0) + ${minutes},
          amount_charged = COALESCE(amount_charged, 0) + ${amount}
        WHERE id = ${session.id}
      `;

      // Commit transaction
      await sql`COMMIT`;

    } catch (error) {
      // Rollback on error
      await sql`ROLLBACK`;
      throw error;
    }
  }

  private async endSessionDueToInsufficientFunds(sessionId: string) {
    try {
      const [sessionInfo] = await sql`
        SELECT reader_id, client_id FROM rtc_sessions WHERE id = ${sessionId}
      `;

      await sql`
        UPDATE rtc_sessions
        SET
          status = 'ended',
          ended_at = NOW(),
          end_reason = 'insufficient_funds'
        WHERE id = ${sessionId}
      `;

      if (sessionInfo) {
        const message = 'Session ended due to insufficient funds';
        await storage.createNotification({
          userId: sessionInfo.client_id,
          type: 'session_cancelled',
          message,
          relatedEntityId: Number(sessionId),
          relatedEntityType: 'rtc_session'
        });
        await storage.createNotification({
          userId: sessionInfo.reader_id,
          type: 'session_cancelled',
          message,
          relatedEntityId: Number(sessionId),
          relatedEntityType: 'rtc_session'
        });

        sendToUser(Number(sessionId), sessionInfo.client_id, 'notification', { message });
        sendToUser(Number(sessionId), sessionInfo.reader_id, 'notification', { message });
      }

      console.log(`Session ${sessionId} ended due to insufficient funds`);
      
    } catch (error) {
      console.error(`Error ending session ${sessionId}:`, error);
    }
  }
}
