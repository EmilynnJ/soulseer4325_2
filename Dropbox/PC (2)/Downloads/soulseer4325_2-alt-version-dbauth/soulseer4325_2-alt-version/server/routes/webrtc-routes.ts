import { Router } from 'express';
import { verifyAppwriteToken } from '../auth';
import { storage } from '../storage';

const router = Router();

// Get WebRTC configuration for a reading
router.get('/api/webrtc/config/:readingId', verifyAppwriteToken, async (req, res) => {
  try {
    const readingId = parseInt(req.params.readingId);
    if (isNaN(readingId)) {
      return res.status(400).json({ message: 'Invalid reading ID' });
    }
    
    const reading = await storage.getReading(readingId);
    if (!reading) {
      return res.status(404).json({ message: 'Reading not found' });
    }
    
    // Check if user is authorized (client or reader of this reading)
    if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Return WebRTC configuration
    res.json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      readingId,
      readerId: reading.readerId,
      clientId: reading.clientId,
      type: reading.type
    });
  } catch (error) {
    console.error('Error getting WebRTC config:', error);
    res.status(500).json({ message: 'Failed to get WebRTC configuration' });
  }
});

// Start a WebRTC session for a reading
router.post('/api/webrtc/start/:readingId', verifyAppwriteToken, async (req, res) => {
  try {
    const readingId = parseInt(req.params.readingId);
    if (isNaN(readingId)) {
      return res.status(400).json({ message: 'Invalid reading ID' });
    }
    
    const reading = await storage.getReading(readingId);
    if (!reading) {
      return res.status(404).json({ message: 'Reading not found' });
    }
    
    // Check if user is authorized (client or reader of this reading)
    if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update reading status if not already in progress
    if (reading.status !== 'in_progress') {
      await storage.updateReading(readingId, {
        status: 'in_progress',
        startedAt: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'WebRTC session started',
      readingId
    });
  } catch (error) {
    console.error('Error starting WebRTC session:', error);
    res.status(500).json({ message: 'Failed to start WebRTC session' });
  }
});

// End a WebRTC session for a reading
router.post('/api/webrtc/end/:readingId', verifyAppwriteToken, async (req, res) => {
  try {
    const readingId = parseInt(req.params.readingId);
    if (isNaN(readingId)) {
      return res.status(400).json({ message: 'Invalid reading ID' });
    }
    
    const reading = await storage.getReading(readingId);
    if (!reading) {
      return res.status(404).json({ message: 'Reading not found' });
    }
    
    // Check if user is authorized (client or reader of this reading)
    if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { duration, totalPrice } = req.body;
    
    // Update reading with completion details
    await storage.updateReading(readingId, {
      status: 'completed',
      completedAt: new Date(),
      duration: duration || 0,
      totalPrice: totalPrice || 0
    });
    
    res.json({
      success: true,
      message: 'WebRTC session ended',
      readingId
    });
  } catch (error) {
    console.error('Error ending WebRTC session:', error);
    res.status(500).json({ message: 'Failed to end WebRTC session' });
  }
});

export default router;