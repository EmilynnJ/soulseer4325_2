import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

interface WSClient extends WebSocket {
  userId?: string;
  channels: Set<string>;
}

const channelMap = new Map<string, Set<WSClient>>();
let wss: WebSocketServer | null = null;

export function initializeWebSocketServer(server: Server) {
  if (wss) return wss;
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket: WSClient) => {
    socket.channels = new Set();

    socket.on('message', async (data) => {
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        case 'authenticate':
          if (msg.userId) socket.userId = String(msg.userId);
          break;
        case 'subscribe':
          if (typeof msg.channel === 'string') {
            joinChannel(socket, msg.channel);
          }
          break;
        case 'unsubscribe':
          if (typeof msg.channel === 'string') {
            leaveChannel(socket, msg.channel);
          }
          break;
        case 'chat_message':
          if (msg.livestreamId && msg.message) {
            broadcast(`livestream:${msg.livestreamId}`, {
              type: 'chat_message',
              livestreamId: msg.livestreamId,
              senderId: socket.userId,
              senderName: msg.senderName,
              message: msg.message,
              timestamp: Date.now()
            });
          }
          break;
        case 'ping':
          try { socket.send('pong'); } catch {}
          break;
      }
    });

    socket.on('close', () => {
      for (const ch of Array.from(socket.channels)) {
        leaveChannel(socket, ch);
      }
    });
  });

  return wss;
}

function joinChannel(socket: WSClient, channel: string) {
  if (!channelMap.has(channel)) channelMap.set(channel, new Set());
  channelMap.get(channel)!.add(socket);
  socket.channels.add(channel);
  handleViewerCount(channel, 1);
}

function leaveChannel(socket: WSClient, channel: string) {
  const set = channelMap.get(channel);
  if (set) {
    set.delete(socket);
    if (set.size === 0) channelMap.delete(channel);
  }
  socket.channels.delete(channel);
  handleViewerCount(channel, -1);
}

async function handleViewerCount(channel: string, delta: number) {
  const match = /^livestream:(\d+)$/.exec(channel);
  if (!match) return;
  const id = parseInt(match[1]);
  const stream = await storage.getLivestream(id);
  if (!stream) return;
  const newCount = Math.max((stream.viewerCount || 0) + delta, 0);
  await storage.updateLivestream(id, { viewerCount: newCount });
  broadcast(channel, { type: 'viewer_count_update', livestreamId: id, viewerCount: newCount });
}

export function broadcast(channel: string, data: any) {
  const set = channelMap.get(channel);
  if (!set) return;
  const message = JSON.stringify(data);
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(message); } catch {}
    }
  }
}

export function notifyNewGift(gift: any, senderUsername: string, recipientUsername: string) {
  if (!gift.livestreamId) return;
  broadcast(`livestream:${gift.livestreamId}`, {
    type: 'new_gift',
    gift,
    senderUsername,
    recipientUsername,
    livestreamId: gift.livestreamId
  });
}
