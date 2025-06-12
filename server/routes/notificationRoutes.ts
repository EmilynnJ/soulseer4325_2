import { Router } from 'express';
import { verifyJwtToken } from '../auth';
import { storage } from '../storage';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for fetching notifications
const fetchNotificationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per windowMs
  message: { message: 'Too many requests, please try again later.' },
});

// Get notifications for current user
router.get('/', verifyJwtToken, fetchNotificationsLimiter, async (req, res) => {
  try {
    const userId = req.user!.id;
    const notifications = await storage.getNotificationsByUser(userId);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// Mark a notification as read
router.post('/:id/mark-read', verifyJwtToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }
    const updated = await storage.markNotificationAsRead(id);
    res.json(updated);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
});

// Rate limiter for marking all notifications as read
const markAllReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each user to 10 requests per windowMs
  message: { message: 'Too many requests, please try again later.' },
});

// Mark all notifications as read
router.post('/mark-all-read', verifyJwtToken, markAllReadLimiter, async (req, res) => {
  try {
    const userId = req.user!.id;
    await storage.markAllNotificationsAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
});

export default router;
