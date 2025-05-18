import { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { rtcSessions, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Define WebSocket client interface with custom properties
interface SignalingClient extends WebSocket {
  userId?: number;
  role?: 'client' | 'reader';
  sessionId?: string;
  peerId?: string;
  isAlive: boolean;
  connectionType?: 'chat' | 'audio' | 'video';
}

// Types for signaling messages
interface SignalingMessage {
  type: string;
  data: any;
  sessionId?: string;
  senderId?: number;
  recipientId?: number;
}

interface SessionInfo {
  sessionId: string;
  clients: Map<number, SignalingClient>;
  readerId: number;
  clientId: number;
  status: 'connecting' | 'active' | 'ended';
  type: 'chat' | 'audio' | 'video';
  startTime?: Date;
  endTime?: Date;
  isPayPerMinute: boolean;
  lastBillingTime?: Date;
}

// Store active sessions
const sessions = new Map<string, SessionInfo>();
// Store connected clients
const connectedClients = new Map<number, SignalingClient>();

// Parse ICE servers from environment variables
const getIceServers = () => {
  const iceServers = [];
  
  // Add STUN servers
  try {
    const stunServers = JSON.parse(process.env.WEBRTC_ICE_SERVERS || '[]');
    iceServers.push(...stunServers);
  } catch (error) {
    console.error('Error parsing STUN servers:', error);
  }

  // Add TURN servers
  if (process.env.WEBRTC_TURN_SERVERS) {
    iceServers.push({
      urls: `turn:${process.env.WEBRTC_TURN_SERVERS}`,
      username: process.env.WEBRTC_TURN_SERVERS_USERNAME || '',
      credential: process.env.WEBRTC_TURN_SERVERS_PASSWORD || ''
    });
  }

  return iceServers;
};

export function setupSignalingServer(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: SignalingClient) => {
    ws.isAlive = true;

    // Handle incoming messages
    ws.on('message', async (message: string) => {
      try {
        const parsedMessage: SignalingMessage = JSON.parse(message);
        
        switch (parsedMessage.type) {
          case 'join':
            handleJoin(ws, parsedMessage);
            break;
          case 'offer':
            handleOffer(ws, parsedMessage);
            break;
          case 'answer':
            handleAnswer(ws, parsedMessage);
            break;
          case 'ice-candidate':
            handleIceCandidate(ws, parsedMessage);
            break;
          case 'leave':
            handleLeave(ws, parsedMessage);
            break;
          case 'chat-message':
            handleChatMessage(ws, parsedMessage);
            break;
          case 'start-session':
            handleStartSession(ws, parsedMessage);
            break;
          case 'end-session':
            handleEndSession(ws, parsedMessage);
            break;
          case 'ping':
            handlePing(ws);
            break;
          default:
            console.log('Unknown message type:', parsedMessage.type);
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    // Handle connection close
    ws.on('close', () => {
      if (ws.userId) {
        handleUserDisconnect(ws);
      }
    });

    // Handle pong messages for connection heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // Set up a heartbeat interval to detect dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((client: SignalingClient) => {
      if (!client.isAlive) {
        handleUserDisconnect(client);
        return client.terminate();
      }
      
      client.isAlive = false;
      client.ping();
    });
  }, 30000); // Check every 30 seconds

  // Clean up interval on server close
  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

// Handler functions for different message types
async function handleJoin(ws: SignalingClient, message: SignalingMessage) {
  const { userId, role, sessionId, peerId } = message.data;
  
  // Store user info with the connection
  ws.userId = userId;
  ws.role = role;
  ws.sessionId = sessionId;
  ws.peerId = peerId;
  
  // Store the connection in our map
  connectedClients.set(userId, ws);
  
  // Check if the session exists
  if (sessionId) {
    let session = sessions.get(sessionId);
    
    if (!session) {
      // If the session doesn't exist yet, create it
      // First, retrieve session information from database
      const dbSession = await db.query.rtcSessions.findFirst({
        where: eq(rtcSessions.sessionId, sessionId),
        with: {
          reader: true,
          client: true
        }
      });
      
      if (!dbSession) {
        sendToClient(ws, {
          type: 'error',
          data: { message: 'Session not found' }
        });
        return;
      }
      
      // Create a new session
      session = {
        sessionId,
        clients: new Map(),
        readerId: dbSession.readerId,
        clientId: dbSession.clientId,
        status: 'connecting',
        type: dbSession.sessionType as 'chat' | 'audio' | 'video',
        isPayPerMinute: dbSession.isPayPerMinute
      };
      
      sessions.set(sessionId, session);
    }
    
    // Add this client to the session
    session.clients.set(userId, ws);
    
    // Send the ice servers configuration
    sendToClient(ws, {
      type: 'ice-servers',
      data: { iceServers: getIceServers() }
    });
    
    // Notify this client about other peers in the session
    const peers = Array.from(session.clients.entries())
      .filter(([id]) => id !== userId)
      .map(([id]) => id);
    
    sendToClient(ws, {
      type: 'peers',
      data: { peers }
    });
    
    // Notify other clients in the session about this new peer
    for (const [peerId, client] of session.clients.entries()) {
      if (peerId !== userId) {
        sendToClient(client, {
          type: 'peer-joined',
          data: { peerId: userId }
        });
      }
    }
  }
}

function handleOffer(ws: SignalingClient, message: SignalingMessage) {
  const { sessionId, recipientId } = message;
  
  if (!sessionId || !recipientId) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Missing sessionId or recipientId' }
    });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Session not found' }
    });
  }
  
  const recipient = session.clients.get(recipientId);
  if (!recipient) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Recipient not found' }
    });
  }
  
  // Forward the offer to the recipient
  sendToClient(recipient, {
    type: 'offer',
    data: message.data,
    senderId: ws.userId
  });
}

function handleAnswer(ws: SignalingClient, message: SignalingMessage) {
  const { sessionId, recipientId } = message;
  
  if (!sessionId || !recipientId) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Missing sessionId or recipientId' }
    });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Session not found' }
    });
  }
  
  const recipient = session.clients.get(recipientId);
  if (!recipient) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Recipient not found' }
    });
  }
  
  // Forward the answer to the recipient
  sendToClient(recipient, {
    type: 'answer',
    data: message.data,
    senderId: ws.userId
  });
}

function handleIceCandidate(ws: SignalingClient, message: SignalingMessage) {
  const { sessionId, recipientId } = message;
  
  if (!sessionId || !recipientId) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Missing sessionId or recipientId' }
    });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Session not found' }
    });
  }
  
  const recipient = session.clients.get(recipientId);
  if (!recipient) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Recipient not found' }
    });
  }
  
  // Forward the ICE candidate to the recipient
  sendToClient(recipient, {
    type: 'ice-candidate',
    data: message.data,
    senderId: ws.userId
  });
}

function handleLeave(ws: SignalingClient, message: SignalingMessage) {
  handleUserDisconnect(ws);
}

function handleChatMessage(ws: SignalingClient, message: SignalingMessage) {
  const { sessionId } = message;
  
  if (!sessionId) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Missing sessionId' }
    });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Session not found' }
    });
  }
  
  // Forward the chat message to all other clients in the session
  for (const [peerId, client] of session.clients.entries()) {
    if (peerId !== ws.userId) {
      sendToClient(client, {
        type: 'chat-message',
        data: message.data,
        senderId: ws.userId
      });
    }
  }
}

async function handleStartSession(ws: SignalingClient, message: SignalingMessage) {
  const { sessionId } = message;
  
  if (!sessionId) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Missing sessionId' }
    });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Session not found' }
    });
  }
  
  // Update session status
  session.status = 'active';
  session.startTime = new Date();
  session.lastBillingTime = new Date();
  
  // Update database
  await db.update(rtcSessions)
    .set({
      status: 'active',
      startTime: session.startTime
    })
    .where(eq(rtcSessions.sessionId, sessionId));
  
  // Notify all clients in the session
  for (const client of session.clients.values()) {
    sendToClient(client, {
      type: 'session-started',
      data: {
        startTime: session.startTime,
        isPayPerMinute: session.isPayPerMinute
      }
    });
  }
}

async function handleEndSession(ws: SignalingClient, message: SignalingMessage) {
  const { sessionId } = message;
  
  if (!sessionId) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Missing sessionId' }
    });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return sendToClient(ws, {
      type: 'error',
      data: { message: 'Session not found' }
    });
  }
  
  // Update session status
  session.status = 'ended';
  session.endTime = new Date();
  
  // Calculate total duration in minutes
  let totalMinutes = 0;
  if (session.startTime) {
    const durationMs = session.endTime.getTime() - session.startTime.getTime();
    totalMinutes = durationMs / (1000 * 60);
  }
  
  // Update database
  await db.update(rtcSessions)
    .set({
      status: 'completed',
      endTime: session.endTime,
      totalMinutes
    })
    .where(eq(rtcSessions.sessionId, sessionId));
  
  // Notify all clients in the session
  for (const client of session.clients.values()) {
    sendToClient(client, {
      type: 'session-ended',
      data: {
        endTime: session.endTime,
        totalMinutes
      }
    });
  }
  
  // Clean up the session
  sessions.delete(sessionId);
}

function handlePing(ws: SignalingClient) {
  sendToClient(ws, { type: 'pong', data: {} });
}

function handleUserDisconnect(ws: SignalingClient) {
  if (!ws.userId) return;
  
  // Remove client from connected clients map
  connectedClients.delete(ws.userId);
  
  // Check if client is part of a session
  if (ws.sessionId) {
    const session = sessions.get(ws.sessionId);
    
    if (session) {
      // Remove client from session
      session.clients.delete(ws.userId);
      
      // Notify other clients in the session
      for (const client of session.clients.values()) {
        sendToClient(client, {
          type: 'peer-left',
          data: { peerId: ws.userId }
        });
      }
      
      // If no clients left in the session, clean it up
      if (session.clients.size === 0) {
        sessions.delete(ws.sessionId);
      }
    }
  }
}

function sendToClient(client: SignalingClient, message: SignalingMessage) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

// Export a function to allow other parts of the app to send notifications to users
export function sendNotificationToUser(userId: number, notification: any) {
  const client = connectedClients.get(userId);
  
  if (client) {
    sendToClient(client, {
      type: 'notification',
      data: notification
    });
  }
}

// Get session information
export function getSessionInfo(sessionId: string) {
  return sessions.get(sessionId);
}

// Check if user is online
export function isUserOnline(userId: number) {
  return connectedClients.has(userId);
}

// Create a new session
export async function createSession(readerId: number, clientId: number, type: 'chat' | 'audio' | 'video', isPayPerMinute: boolean = true) {
  const sessionId = uuidv4();
  
  // Create a new session in the database
  await db.insert(rtcSessions).values({
    sessionId,
    readerId,
    clientId,
    sessionType: type,
    startTime: new Date(),
    status: 'scheduled',
    isPayPerMinute
  });
  
  return sessionId;
}

// Get all active sessions
export function getActiveSessions() {
  return Array.from(sessions.entries()).filter(([_, session]) => session.status === 'active');
} 