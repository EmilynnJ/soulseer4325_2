import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Define the types for signal data
export interface SignalData {
  type: string;
  data?: any;
  readingId: number;
  senderId: number;
  recipientId?: number;
}

// Define the return type of our hook
interface UseSignalingReturn {
  isConnected: boolean;
  sendSignal: (type: string, data?: any, recipientId?: number) => void;
  addSignalListener: (type: string, callback: (data: SignalData) => void) => void;
  removeSignalListener: (type: string, callback: (data: SignalData) => void) => void;
}

/**
 * Custom hook for WebRTC signaling using Socket.IO
 * 
 * @param readingId - The ID of the reading session
 * @param userId - The current user's ID
 * @returns Object with connection state and signaling methods
 */
export function useSignaling(readingId: number, userId: number): UseSignalingReturn {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_INTERVAL = 2000; // 2 seconds

  // Initialize socket connection
  useEffect(() => {
    // Create socket connection to the signaling namespace
    const socket = io(`/signal/reading/${readingId}`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_INTERVAL,
    });

    socketRef.current = socket;

    // Set up connection event handlers
    socket.on('connect', () => {
      console.log(`Socket connected to reading ${readingId}`);
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      
      // Register user in the reading session
      socket.emit('join_reading', {
        readingId,
        userId,
        timestamp: Date.now()
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected from reading ${readingId}`);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error(`Socket connection error for reading ${readingId}:`, error);
      handleReconnect();
    });

    // Clean up on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socket) {
        console.log(`Cleaning up socket for reading ${readingId}`);
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.disconnect();
      }
    };
  }, [readingId, userId]);

  // Handle reconnection logic
  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached for reading ${readingId}`);
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) for reading ${readingId}`);
      
      if (socketRef.current) {
        socketRef.current.connect();
      }
    }, RECONNECT_INTERVAL);
  }, [readingId]);

  // Send a signal through the socket
  const sendSignal = useCallback((type: string, data?: any, recipientId?: number) => {
    if (!socketRef.current || !isConnected) {
      console.warn('Cannot send signal: socket not connected');
      return;
    }

    const signalData: SignalData = {
      type,
      data,
      readingId,
      senderId: userId,
      ...(recipientId && { recipientId }),
    };

    console.log(`Sending signal: ${type}`, signalData);
    socketRef.current.emit('signal', signalData);
  }, [isConnected, readingId, userId]);

  // Add a listener for a specific signal type
  const addSignalListener = useCallback((type: string, callback: (data: SignalData) => void) => {
    if (!socketRef.current) {
      console.warn('Cannot add signal listener: socket not initialized');
      return;
    }

    const wrappedCallback = (data: SignalData) => {
      if (data.type === type) {
        callback(data);
      }
    };

    socketRef.current.on('signal', wrappedCallback);
  }, []);

  // Remove a listener for a specific signal type
  const removeSignalListener = useCallback((type: string, callback: (data: SignalData) => void) => {
    if (!socketRef.current) {
      return;
    }

    const wrappedCallback = (data: SignalData) => {
      if (data.type === type) {
        callback(data);
      }
    };

    socketRef.current.off('signal', wrappedCallback);
  }, []);

  return {
    isConnected,
    sendSignal,
    addSignalListener,
    removeSignalListener,
  };
}

export default useSignaling;