import { Router } from 'express';
import { verifyJwtToken } from '../auth';
import { storage } from '../storage';

const router = Router();

// Get notifications for current user
router.get('/', verifyJwtToken, async (req, res) => {
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

// Mark all notifications as read
router.post('/mark-all-read', verifyJwtToken, async (req, res) => {
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
