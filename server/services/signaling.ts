import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { log } from '../vite';

// Define types for signaling messages
interface SignalingMessage {
  type: string;
  readingId: number;
  senderId: number;
  recipientId?: number;
  [key: string]: any;
}

// Store active connections by reading ID and user ID
const activeConnections = new Map<number, Map<number, Socket>>();

// Store namespaces by reading ID
const readingNamespaces = new Map<number, any>();

// Initialize Socket.IO server
let io: SocketIOServer | null = null;

/**
 * Initialize the signaling service with the HTTP server
 * @param httpServer The HTTP server instance
 * @returns The Socket.IO server instance
 */
export function initializeSignalingService(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io; // Return existing instance if already initialized
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // In production, restrict this to your domain
      methods: ['GET', 'POST']
    }
  });

  // Set up the main connection handler
  io.on('connection', (socket: Socket) => {
    log('New socket connection established', 'signaling');
    
    // Handle disconnection
    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });

    // Handle join event
    socket.on('join', (data: { readingId: number, userId: number, role: string }) => {
      handleJoin(socket, data);
    });

    // Handle leave event
    socket.on('leave', (data: { readingId: number, userId: number }) => {
      handleLeave(socket, data);
    });

    // Handle signaling messages
    socket.on('signal', (message: SignalingMessage) => {
      handleSignalingMessage(socket, message);
    });

    // Handle end call event
    socket.on('end_call', (data: { readingId: number, userId: number }) => {
      handleEndCall(socket, data);
    });
  });

  log('Signaling service initialized', 'signaling');
  return io;
}

/**
 * Get the namespace for a specific reading
 * @param readingId The reading ID
 * @returns The namespace for the reading
 */
export function getReadingNamespace(readingId: number): any {
  if (!io) {
    throw new Error('Signaling service not initialized');
  }

  if (!readingNamespaces.has(readingId)) {
    const namespace = io.of(`/reading-${readingId}`);
    readingNamespaces.set(readingId, namespace);
    
    // Set up namespace-specific handlers
    namespace.on('connection', (socket: Socket) => {
      log(`Socket connected to reading-${readingId} namespace`, 'signaling');
      
      // Handle namespace-specific events
      socket.on('signal', (message: SignalingMessage) => {
        handleSignalingMessage(socket, message);
      });
    });
  }

  return readingNamespaces.get(readingId);
}

/**
 * Handle a client joining a reading session
 * @param socket The client socket
 * @param data The join data
 */
function handleJoin(socket: Socket, data: { readingId: number, userId: number, role: string }): void {
  try {
    const { readingId, userId, role } = data;
    
    // Store the connection
    if (!activeConnections.has(readingId)) {
      activeConnections.set(readingId, new Map());
    }
    
    const readingConnections = activeConnections.get(readingId)!;
    readingConnections.set(userId, socket);
    
    // Join the room for this reading
    socket.join(`reading-${readingId}`);
    
    // Store user data in socket
    socket.data.readingId = readingId;
    socket.data.userId = userId;
    socket.data.role = role;
    
    log(`User ${userId} (${role}) joined reading ${readingId}`, 'signaling');
    
    // Notify others in the room
    socket.to(`reading-${readingId}`).emit('user_joined', {
      readingId,
      userId,
      role
    });
    
    // Emit join_success event to the client
    socket.emit('join_success', {
      readingId,
      userId,
      activeUsers: Array.from(readingConnections.keys())
    });
  } catch (error) {
    log(`Error in handleJoin: ${error}`, 'signaling');
    socket.emit('error', { message: 'Failed to join reading session' });
  }
}

/**
 * Handle a client leaving a reading session
 * @param socket The client socket
 * @param data The leave data
 */
function handleLeave(socket: Socket, data: { readingId: number, userId: number }): void {
  try {
    const { readingId, userId } = data;
    
    // Remove from active connections
    if (activeConnections.has(readingId)) {
      const readingConnections = activeConnections.get(readingId)!;
      readingConnections.delete(userId);
      
      // Clean up if no more connections for this reading
      if (readingConnections.size === 0) {
        activeConnections.delete(readingId);
      }
    }
    
    // Leave the room
    socket.leave(`reading-${readingId}`);
    
    log(`User ${userId} left reading ${readingId}`, 'signaling');
    
    // Notify others in the room
    socket.to(`reading-${readingId}`).emit('user_left', {
      readingId,
      userId
    });
  } catch (error) {
    log(`Error in handleLeave: ${error}`, 'signaling');
  }
}

/**
 * Handle a client disconnecting
 * @param socket The client socket
 */
function handleDisconnect(socket: Socket): void {
  try {
    const readingId = socket.data.readingId;
    const userId = socket.data.userId;
    
    if (readingId && userId) {
      // Handle as a leave event
      handleLeave(socket, { readingId, userId });
      log(`User ${userId} disconnected from reading ${readingId}`, 'signaling');
    }
  } catch (error) {
    log(`Error in handleDisconnect: ${error}`, 'signaling');
  }
}

/**
 * Handle a signaling message
 * @param socket The client socket
 * @param message The signaling message
 */
function handleSignalingMessage(socket: Socket, message: SignalingMessage): void {
  try {
    const { type, readingId, senderId, recipientId } = message;
    
    log(`Received ${type} signal from user ${senderId} in reading ${readingId}`, 'signaling');
    
    // Validate the message
    if (!readingId || !senderId || !type) {
      socket.emit('error', { message: 'Invalid signaling message' });
      return;
    }
    
    // Handle different message types
    switch (type) {
      case 'offer':
      case 'answer':
      case 'ice_candidate':
        // These messages need to be forwarded to a specific recipient
        if (!recipientId) {
          socket.emit('error', { message: 'Recipient ID is required' });
          return;
        }
        
        forwardSignalingMessage(message);
        break;
        
      case 'join':
        // Handle join message (already handled by handleJoin)
        break;
        
      case 'leave':
        // Handle leave message (already handled by handleLeave)
        break;
        
      case 'end_call':
        // Broadcast end call to all participants
        broadcastToReading(readingId, 'call_ended', {
          readingId,
          userId: senderId
        });
        break;
        
      default:
        log(`Unknown signal type: ${type}`, 'signaling');
        socket.emit('error', { message: 'Unknown signal type' });
    }
  } catch (error) {
    log(`Error in handleSignalingMessage: ${error}`, 'signaling');
    socket.emit('error', { message: 'Failed to process signaling message' });
  }
}

/**
 * Forward a signaling message to the intended recipient
 * @param message The signaling message
 */
function forwardSignalingMessage(message: SignalingMessage): void {
  try {
    const { readingId, recipientId } = message;
    
    if (!activeConnections.has(readingId)) {
      log(`No active connections for reading ${readingId}`, 'signaling');
      return;
    }
    
    const readingConnections = activeConnections.get(readingId)!;
    
    if (!recipientId || !readingConnections.has(recipientId)) {
      log(`Recipient ${recipientId} not found in reading ${readingId}`, 'signaling');
      return;
    }
    
    // Forward the message to the recipient
    const recipientSocket = readingConnections.get(recipientId)!;
    recipientSocket.emit('signal', message);
    
    log(`Forwarded ${message.type} signal to user ${recipientId} in reading ${readingId}`, 'signaling');
  } catch (error) {
    log(`Error in forwardSignalingMessage: ${error}`, 'signaling');
  }
}

/**
 * Handle an end call event
 * @param socket The client socket
 * @param data The end call data
 */
function handleEndCall(socket: Socket, data: { readingId: number, userId: number }): void {
  try {
    const { readingId, userId } = data;
    
    log(`User ${userId} ended call in reading ${readingId}`, 'signaling');
    
    // Broadcast end call to all participants
    broadcastToReading(readingId, 'call_ended', {
      readingId,
      userId
    });
  } catch (error) {
    log(`Error in handleEndCall: ${error}`, 'signaling');
    socket.emit('error', { message: 'Failed to end call' });
  }
}

/**
 * Broadcast a message to all clients in a reading session
 * @param readingId The reading ID
 * @param event The event name
 * @param data The event data
 */
function broadcastToReading(readingId: number, event: string, data: any): void {
  try {
    if (!io) {
      throw new Error('Signaling service not initialized');
    }
    
    io.to(`reading-${readingId}`).emit(event, data);
    log(`Broadcasted ${event} to reading ${readingId}`, 'signaling');
  } catch (error) {
    log(`Error in broadcastToReading: ${error}`, 'signaling');
  }
}

/**
 * Send a message to a specific user in a reading session
 * @param readingId The reading ID
 * @param userId The user ID
 * @param event The event name
 * @param data The event data
 * @returns True if the message was sent, false otherwise
 */
export function sendToUser(readingId: number, userId: number, event: string, data: any): boolean {
  try {
    if (!activeConnections.has(readingId)) {
      return false;
    }
    
    const readingConnections = activeConnections.get(readingId)!;
    
    if (!readingConnections.has(userId)) {
      return false;
    }
    
    const socket = readingConnections.get(userId)!;
    socket.emit(event, data);
    
    log(`Sent ${event} to user ${userId} in reading ${readingId}`, 'signaling');
    return true;
  } catch (error) {
    log(`Error in sendToUser: ${error}`, 'signaling');
    return false;
  }
}

/**
 * Get all active users in a reading session
 * @param readingId The reading ID
 * @returns Array of user IDs
 */
export function getActiveUsers(readingId: number): number[] {
  if (!activeConnections.has(readingId)) {
    return [];
  }
  
  const readingConnections = activeConnections.get(readingId)!;
  return Array.from(readingConnections.keys());
}

/**
 * Check if a user is connected to a reading session
 * @param readingId The reading ID
 * @param userId The user ID
 * @returns True if the user is connected, false otherwise
 */
export function isUserConnected(readingId: number, userId: number): boolean {
  if (!activeConnections.has(readingId)) {
    return false;
  }
  
  const readingConnections = activeConnections.get(readingId)!;
  return readingConnections.has(userId);
}