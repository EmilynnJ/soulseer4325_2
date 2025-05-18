import React, { useState, useEffect } from 'react';
import { Bell, Video, MessageSquare, Phone, Calendar, X, User, Check, Clock } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'wouter';
import { format, formatDistanceToNow } from 'date-fns';

interface ReadingNotificationsProps {
  userId: number;
}

interface Notification {
  id: number;
  type: 'new_session_request' | 'session_accepted' | 'session_cancelled' | 'payment_received' | 'new_message';
  message: string;
  relatedEntityId?: number;
  relatedEntityType?: string;
  createdAt: string;
  isRead: boolean;
}

export default function ReadingNotifications({ userId }: ReadingNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await axios.get('/api/notifications');
        setNotifications(response.data);
        
        // Calculate unread count
        const unread = response.data.filter((notif: Notification) => !notif.isRead).length;
        setUnreadCount(unread);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };
    
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [userId]);

  // Mark notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      await axios.post(`/api/notifications/${notificationId}/mark-read`);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await axios.post('/api/notifications/mark-all-read');
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      
      // Update unread count
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read first
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    
    // Navigate based on notification type
    if (notification.type === 'new_session_request' && notification.relatedEntityType === 'rtc_session') {
      navigate(`/session/${notification.relatedEntityId}`);
    } else if (notification.type === 'session_accepted' && notification.relatedEntityType === 'rtc_session') {
      navigate(`/session/${notification.relatedEntityId}`);
    } else if (notification.type === 'new_message') {
      navigate('/messages');
    }
    
    // Close notifications panel
    setIsOpen(false);
  };

  // Get icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_session_request':
        return <Video className="text-indigo-400" size={20} />;
      case 'session_accepted':
        return <Check className="text-green-400" size={20} />;
      case 'session_cancelled':
        return <X className="text-red-400" size={20} />;
      case 'payment_received':
        return <Check className="text-green-400" size={20} />;
      case 'new_message':
        return <MessageSquare className="text-blue-400" size={20} />;
      default:
        return <Bell className="text-gray-400" size={20} />;
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors focus:outline-none"
      >
        <Bell size={20} className="text-gray-300" />
        
        {unreadCount > 0 && (
          <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>
      
      {/* Notifications Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-50 border border-gray-700">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-medium text-white">Notifications</h3>
            
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                <Bell size={32} className="mx-auto mb-2 text-gray-500" />
                <p>No notifications</p>
              </div>
            ) : (
              <div>
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer ${
                      !notification.isRead ? 'bg-gray-700 bg-opacity-50' : ''
                    }`}
                  >
                    <div className="flex">
                      <div className="mr-3 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${!notification.isRead ? 'text-white' : 'text-gray-300'}`}>
                          {notification.message}
                        </p>
                        <div className="flex items-center mt-1 text-xs text-gray-500">
                          <Clock size={12} className="mr-1" />
                          <span>
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      
                      {!notification.isRead && (
                        <div className="ml-2 w-2 h-2 bg-indigo-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-700">
            <button
              onClick={() => navigate('/notifications')}
              className="w-full py-2 text-sm text-center text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View All
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 