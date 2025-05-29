import { useState, useEffect, useCallback } from 'react';
import { webrtcClient } from '../services/webrtc-client';

export const useWebRTC = () => {
  const [isServiceHealthy, setIsServiceHealthy] = useState(false);
  const [serviceStatus, setServiceStatus] = useState('checking');
  const [activeSessions, setActiveSessions] = useState([]);

  // Check WebRTC service health
  const checkServiceHealth = useCallback(async () => {
    try {
      const health = await webrtcClient.getHealth();
      setIsServiceHealthy(health.status === 'healthy');
      setServiceStatus(health.status);
    } catch (error) {
      setIsServiceHealthy(false);
      setServiceStatus('error');
      console.error('WebRTC service health check failed:', error);
    }
  }, []);

  // Create a reading session
  const createReadingSession = useCallback(async (sessionData) => {
    try {
      const response = await webrtcClient.createSession(sessionData);
      
      if (response.success) {
        setActiveSessions(prev => [...prev, response.session]);
        return response;
      } else {
        throw new Error(response.error || 'Failed to create session');
      }
    } catch (error) {
      console.error('Error creating reading session:', error);
      throw error;
    }
  }, []);

  // Join an existing session
  const joinSession = useCallback(async (sessionId, userData) => {
    try {
      return await webrtcClient.joinSession(sessionId, userData);
    } catch (error) {
      console.error('Error joining session:', error);
      throw error;
    }
  }, []);

  // End a session
  const endSession = useCallback(async (sessionId, reason) => {
    try {
      const response = await webrtcClient.endSession(sessionId, reason);
      
      // Remove from active sessions
      setActiveSessions(prev => 
        prev.filter(session => session.id !== sessionId)
      );
      
      return response;
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }, []);

  // Create a live stream
  const createLiveStream = useCallback(async (streamData) => {
    try {
      return await webrtcClient.createStream(streamData);
    } catch (error) {
      console.error('Error creating live stream:', error);
      throw error;
    }
  }, []);

  // Send a gift in a stream
  const sendStreamGift = useCallback(async (streamId, giftData) => {
    try {
      return await webrtcClient.sendGift(streamId, giftData);
    } catch (error) {
      console.error('Error sending stream gift:', error);
      throw error;
    }
  }, []);

  // Get session status
  const getSessionStatus = useCallback(async (sessionId) => {
    try {
      return await webrtcClient.getSessionStatus(sessionId);
    } catch (error) {
      console.error('Error getting session status:', error);
      throw error;
    }
  }, []);

  // Generate session URL
  const generateSessionUrl = useCallback((roomId, userId, role, sessionType) => {
    return webrtcClient.generateSessionUrl(roomId, userId, role, sessionType);
  }, []);

  // Generate stream URL
  const generateStreamUrl = useCallback((streamId, userId, role, userName) => {
    return webrtcClient.generateStreamUrl(streamId, userId, role, userName);
  }, []);

  // Check service health on mount
  useEffect(() => {
    checkServiceHealth();
    
    // Check health every 30 seconds
    const healthInterval = setInterval(checkServiceHealth, 30000);
    
    return () => clearInterval(healthInterval);
  }, [checkServiceHealth]);

  return {
    // Service status
    isServiceHealthy,
    serviceStatus,
    checkServiceHealth,
    
    // Session management
    activeSessions,
    createReadingSession,
    joinSession,
    endSession,
    getSessionStatus,
    
    // Live streaming
    createLiveStream,
    sendStreamGift,
    
    // URL generation
    generateSessionUrl,
    generateStreamUrl
  };
};
