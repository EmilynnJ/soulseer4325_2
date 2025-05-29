const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Neon database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// WebRTC service webhook handler
router.post('/webrtc', async (req, res) => {
  try {
    const { event, data, timestamp, source } = req.body;
    
    // Verify webhook source
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`📨 WebRTC webhook received: ${event}`, data);

    switch (event) {
      case 'session_created':
        await handleSessionCreated(data);
        break;
        
      case 'session_started':
        await handleSessionStarted(data);
        break;
        
      case 'session_ended':
        await handleSessionEnded(data);
        break;
        
      case 'payment_processed':
        await handlePaymentProcessed(data);
        break;
        
      case 'stream_started':
        await handleStreamStarted(data);
        break;
        
      case 'stream_ended':
        await handleStreamEnded(data);
        break;
        
      case 'gift_received':
        await handleGiftReceived(data);
        break;
        
      default:
        console.log(`Unknown webhook event: ${event}`);
    }

    res.json({ success: true, received: true });

  } catch (error) {
    console.error('Error processing WebRTC webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleSessionCreated(data) {
  try {
    const { sessionId, clientId, readerId, roomId, sessionType, rate, externalSessionId } = data;
    
    // Store in your main Neon database
    await pool.query(`
      INSERT INTO webrtc_sessions (
        webrtc_session_id, client_id, reader_id, room_id, 
        session_type, rate, status, external_session_id, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (webrtc_session_id) DO NOTHING
    `, [sessionId, clientId, readerId, roomId, sessionType, rate, 'created', externalSessionId]);
    
    console.log(`✅ Session created in main database: ${sessionId}`);
  } catch (error) {
    console.error('Error handling session created:', error);
  }
}

async function handleSessionStarted(data) {
  try {
    const { sessionId, startTime } = data;
    
    // Update session status in Neon database
    await pool.query(`
      UPDATE webrtc_sessions 
      SET status = $1, started_at = $2 
      WHERE webrtc_session_id = $3
    `, ['active', startTime, sessionId]);
    
    console.log(`🎥 Session started: ${sessionId}`);
  } catch (error) {
    console.error('Error handling session started:', error);
  }
}

async function handleSessionEnded(data) {
  try {
    const { sessionId, endTime, totalMinutes, amountCharged, reason } = data;
    
    // Update session with final details in Neon
    await pool.query(`
      UPDATE webrtc_sessions 
      SET status = $1, ended_at = $2, total_minutes = $3, 
          amount_charged = $4, end_reason = $5 
      WHERE webrtc_session_id = $6
    `, ['completed', endTime, totalMinutes, amountCharged, reason, sessionId]);
    
    console.log(`🏁 Session ended: ${sessionId} - ${totalMinutes} minutes, $${amountCharged}`);
  } catch (error) {
    console.error('Error handling session ended:', error);
  }
}

async function handlePaymentProcessed(data) {
  try {
    const { sessionId, amount, stripePaymentIntentId, status } = data;
    
    // Log payment in Neon database
    await pool.query(`
      INSERT INTO payment_logs (
        session_id, amount, stripe_payment_intent_id, status, 
        source, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [sessionId, amount, stripePaymentIntentId, status, 'webrtc_service']);
    
    console.log(`💳 Payment processed: ${sessionId} - $${amount}`);
  } catch (error) {
    console.error('Error handling payment processed:', error);
  }
}

async function handleStreamStarted(data) {
  try {
    const { streamId, readerId, title, roomId } = data;
    
    // Log stream start in Neon database
    await pool.query(`
      INSERT INTO live_streams (
        webrtc_stream_id, reader_id, title, room_id, 
        status, started_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (webrtc_stream_id) DO NOTHING
    `, [streamId, readerId, title, roomId, 'live']);
    
    console.log(`📡 Stream started: ${streamId}`);
  } catch (error) {
    console.error('Error handling stream started:', error);
  }
}

async function handleStreamEnded(data) {
  try {
    const { streamId, totalGifts, viewerCount } = data;
    
    // Update stream with final stats in Neon
    await pool.query(`
      UPDATE live_streams 
      SET status = $1, ended_at = NOW(), total_gifts = $2, max_viewers = $3 
      WHERE webrtc_stream_id = $4
    `, ['ended', totalGifts, viewerCount, streamId]);
    
    console.log(`📡 Stream ended: ${streamId} - $${totalGifts} in gifts`);
  } catch (error) {
    console.error('Error handling stream ended:', error);
  }
}

async function handleGiftReceived(data) {
  try {
    const { streamId, senderId, receiverId, giftType, amount } = data;
    
    // Log gift in Neon database
    await pool.query(`
      INSERT INTO stream_gifts (
        stream_id, sender_id, receiver_id, gift_type, amount, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [streamId, senderId, receiverId, giftType, amount]);
    
    console.log(`🎁 Gift received: ${giftType} ($${amount}) from ${senderId} to ${receiverId}`);
  } catch (error) {
    console.error('Error handling gift received:', error);
  }
}

module.exports = router;
