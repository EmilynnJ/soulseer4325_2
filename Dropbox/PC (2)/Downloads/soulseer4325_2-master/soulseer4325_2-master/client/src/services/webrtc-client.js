import { account } from './appwrite'; // Your existing Appwrite config

class WebRTCClient {
  constructor() {
    this.baseUrl = import.meta.env.VITE_WEBRTC_SERVICE_URL || 'http://localhost:3002';
    this.wsUrl = import.meta.env.VITE_WEBRTC_WS_URL || 'ws://localhost:3002';
  }

  // Get current Appwrite user session token
  async getAuthToken() {
    try {
      const session = await account.getSession('current');
      return session.$id || ''; // Use session ID as token
    } catch (error) {
      console.error('Error getting Appwrite session:', error);
      return '';
    }
  }

  // Get current Appwrite user ID
  async getCurrentUserId() {
    try {
      const user = await account.get();
      return user.$id;
    } catch (error) {
      console.error('Error getting Appwrite user:', error);
      return null;
    }
  }

  // Get current user data
  async getCurrentUser() {
    try {
      return await account.get();
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Create a new reading session
  async createSession(sessionData) {
    try {
      const user = await this.getCurrentUser();
      const token = await this.getAuthToken();
      
      const payload = {
        ...sessionData,
        clientId: user.$id,
        clientName: user.name || user.email,
        clientEmail: user.email,
        appwriteUserId: user.$id
      };

      const response = await fetch(`${this.baseUrl}/api/sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Appwrite-User-ID': user.$id
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating WebRTC session:', error);
      throw error;
    }
  }

  // Join an existing session
  async joinSession(sessionId, userData = {}) {
    try {
      const user = await this.getCurrentUser();
      const token = await this.getAuthToken();
      
      const payload = {
        ...userData,
        userId: user.$id,
        userName: user.name || user.email,
        userEmail: user.email,
        appwriteUserId: user.$id
      };

      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Appwrite-User-ID': user.$id
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join session');
      }

      return await response.json();
    } catch (error) {
      console.error('Error joining WebRTC session:', error);
      throw error;
    }
  }

  // End a session
  async endSession(sessionId, reason = 'completed') {
    try {
      const user = await this.getCurrentUser();
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Appwrite-User-ID': user.$id
        },
        body: JSON.stringify({ 
          reason, 
          userId: user.$id,
          appwriteUserId: user.$id
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error ending WebRTC session:', error);
      throw error;
    }
  }

  // Get session status
  async getSessionStatus(sessionId) {
    try {
      const token = await this.getAuthToken();
      const user = await this.getCurrentUser();
      
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Appwrite-User-ID': user.$id
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Error getting session status:', error);
      throw error;
    }
  }

  // Create live stream
  async createStream(streamData) {
    try {
      const user = await this.getCurrentUser();
      const token = await this.getAuthToken();
      
      const payload = {
        ...streamData,
        readerId: user.$id,
        readerName: user.name || user.email,
        readerEmail: user.email,
        appwriteUserId: user.$id
      };

      const response = await fetch(`${this.baseUrl}/api/streams/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Appwrite-User-ID': user.$id
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create stream');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    }
  }

  // Send gift in stream
  async sendGift(streamId, giftData) {
    try {
      const user = await this.getCurrentUser();
      const token = await this.getAuthToken();
      
      const payload = {
        ...giftData,
        senderId: user.$id,
        senderName: user.name || user.email,
        appwriteUserId: user.$id
      };

      const response = await fetch(`${this.baseUrl}/api/streams/${streamId}/gift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Appwrite-User-ID': user.$id
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send gift');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending gift:', error);
      throw error;
    }
  }

  // Get WebRTC service health
  async getHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return await response.json();
    } catch (error) {
      console.error('Error checking WebRTC service health:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }

  // Generate session URL for redirect
  generateSessionUrl(roomId, userId, role, sessionType) {
    return `${this.baseUrl}/session/${roomId}?userId=${userId}&role=${role}&type=${sessionType}`;
  }

  // Generate stream URL for redirect
  generateStreamUrl(streamId, userId, role, userName) {
    return `${this.baseUrl}/stream/${streamId}?userId=${userId}&role=${role}&name=${encodeURIComponent(userName)}`;
  }
}

export const webrtcClient = new WebRTCClient();
