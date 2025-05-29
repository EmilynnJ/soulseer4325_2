import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { Server } from 'http';

interface Room {
  participants: Map<string, {
    ws: WebSocket;
    userId: string;
    role: 'client' | 'reader';
    joined: number;
  }>;
  type: 'reading' | 'stream';
  created: number;
  metadata?: any;
}

export class WebRTCService {
  private rooms = new Map<string, Room>();
  private connections = new Map<string, WebSocket>();
  private userConnections = new Map<string, WebSocket>();
  private wss?: WebSocket.Server;

  initialize(server: Server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws/webrtc'
    });
    
    console.log('🔗 WebRTC Service initialized');
    
    this.wss.on('connection', (ws: WebSocket, req) => {
      const connectionId = uuidv4();
      this.connections.set(connectionId, ws);
      
      (ws as any).connectionId = connectionId;
      (ws as any).isAlive = true;
      
      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });
      
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        this.handleDisconnection(ws);
      });
    });

    setInterval(() => {
      this.wss?.clients.forEach((ws: WebSocket) => {
        if (!(ws as any).isAlive) {
          this.handleDisconnection(ws);
          return ws.terminate();
        }
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private handleMessage(ws: WebSocket, message: any) {
    const { type, roomId, payload, userId } = message;

    if (userId && !(ws as any).userId) {
      (ws as any).userId = userId;
      this.userConnections.set(userId, ws);
    }

    switch (type) {
      case 'join-room':
        this.joinRoom(ws, roomId, payload);
        break;
      case 'webrtc-offer':
      case 'webrtc-answer':
      case 'ice-candidate':
        this.forwardMessage(ws, roomId, { type, payload });
        break;
      case 'chat-message':
        this.broadcastToRoom(roomId, { type: 'chat-message', payload });
        break;
    }
  }

  private joinRoom(ws: WebSocket, roomId: string, payload: any) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        participants: new Map(),
        type: payload.roomType || 'reading',
        created: Date.now(),
        metadata: payload.metadata || {}
      });
    }

    const room = this.rooms.get(roomId)!;
    room.participants.set((ws as any).connectionId, {
      ws,
      userId: payload.userId,
      role: payload.role,
      joined: Date.now()
    });

    (ws as any).roomId = roomId;

    this.broadcastToRoom(roomId, {
      type: 'participant-joined',
      payload: {
        userId: payload.userId,
        role: payload.role,
        participantCount: room.participants.size
      }
    }, (ws as any).connectionId);

    ws.send(JSON.stringify({
      type: 'room-joined',
      payload: { roomId, participantCount: room.participants.size }
    }));
  }

  private forwardMessage(ws: WebSocket, roomId: string, message: any) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.forEach((participant, connectionId) => {
      if (connectionId !== (ws as any).connectionId && participant.ws.readyState === WebSocket.OPEN) {
        participant.ws.send(JSON.stringify(message));
      }
    });
  }

  private broadcastToRoom(roomId: string, message: any, excludeId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.forEach((participant, connectionId) => {
      if (connectionId !== excludeId && participant.ws.readyState === WebSocket.OPEN) {
        participant.ws.send(JSON.stringify(message));
      }
    });
  }

  private handleDisconnection(ws: WebSocket) {
    if ((ws as any).roomId) {
      // Handle room cleanup
    }
    
    if ((ws as any).userId) {
      this.userConnections.delete((ws as any).userId);
    }
    
    this.connections.delete((ws as any).connectionId);
  }

  notifyUser(userId: string, notification: any): boolean {
    const ws = this.userConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'notification',
        payload: notification
      }));
      return true;
    }
    return false;
  }

  endSession(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    this.broadcastToRoom(roomId, {
      type: 'session-ended',
      payload: { reason: 'ended_by_system' }
    });

    room.participants.forEach((participant) => {
      if (participant.ws.readyState === WebSocket.OPEN) {
        participant.ws.close();
      }
    });

    this.rooms.delete(roomId);
    return true;
  }
}
