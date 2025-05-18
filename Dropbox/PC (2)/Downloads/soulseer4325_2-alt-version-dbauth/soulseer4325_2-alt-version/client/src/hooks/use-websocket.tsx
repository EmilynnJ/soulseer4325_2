import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './use-auth';

interface WebSocketContextType {
  socket: Socket;
  connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Create socket connection
    const socketUrl = import.meta.env.VITE_WEBSOCKET_URL || window.location.origin;
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    // Set up event listeners
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      
      // Authenticate if user is logged in
      if (user) {
        newSocket.emit('authenticate', { userId: user.id });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Store socket in state
    setSocket(newSocket);

    // Clean up on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Re-authenticate when user changes
  useEffect(() => {
    if (socket && user && connected) {
      socket.emit('authenticate', { userId: user.id });
    }
  }, [user, socket, connected]);

  // Don't render until socket is initialized
  if (!socket) {
    return null;
  }

  return (
    <WebSocketContext.Provider value={{ socket, connected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  
  return context;
};