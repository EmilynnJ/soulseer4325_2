import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create reading session
router.post('/sessions/create', async (req, res) => {
  try {
    const { readerId, sessionType } = req.body;
    const roomId = uuidv4();

    // You'll integrate with your existing database here
    res.json({
      success: true,
      roomId,
      sessionType,
      webrtcUrl: `/webrtc/session/${roomId}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

export default router;
