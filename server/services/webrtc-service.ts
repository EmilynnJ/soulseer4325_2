import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { storage } from '../storage';

export class WebRTCService {
  private io: SocketIOServer;
  private rooms: Map<string, Set<string>> = new Map();
  // Use string based user IDs to match the database UUID type
  private userSocketMap: Map<string, string> = new Map();
  private socketUserMap: Map<string, string> = new Map();
  private readingRooms: Map<number, Set<string>> = new Map();

  constructor(server: Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Authentication
      socket.on('authenticate', (data: { userId: string }) => {
        const { userId } = data;
        if (!userId) return;

        this.userSocketMap.set(userId, socket.id);
        this.socketUserMap.set(socket.id, userId);
        console.log(`User ${userId} authenticated with socket ${socket.id}`);
      });

      // Join a reading room
      socket.on('join_reading', async (data: { readingId: number; userId: string; role: 'reader' | 'client' }) => {
        try {
          const { readingId, userId, role } = data;
          
          // Validate the reading and user
          const reading = await storage.getReading(readingId);
          if (!reading) {
            socket.emit('error', { message: 'Reading not found' });
            return;
          }

          // Check if user is authorized for this reading
          if ((role === 'reader' && reading.readerId !== userId) ||
              (role === 'client' && reading.clientId !== userId)) {
            socket.emit('error', { message: 'Not authorized for this reading' });
            return;
          }

          const roomId = `reading_${readingId}`;
          
          // Add socket to room
          socket.join(roomId);
          
          // Track room membership
          if (!this.readingRooms.has(readingId)) {
            this.readingRooms.set(readingId, new Set());
          }
          this.readingRooms.get(readingId)?.add(socket.id);
          
          console.log(`${role} ${userId} joined reading ${readingId}`);
          
          // Notify room that user joined
          socket.to(roomId).emit('user_joined', { 
            userId, 
            role,
            socketId: socket.id
          });
          
          // Emit success to the client
          socket.emit('joined_reading', { 
            readingId,
            roomId
          });
        } catch (error) {
          console.error('Error joining reading:', error);
          socket.emit('error', { message: 'Failed to join reading' });
        }
      });

      // WebRTC signaling
      socket.on('offer', (data) => {
        const { target, offer } = data;
        socket.to(target).emit('offer', {
          offer,
          from: socket.id
        });
      });

      socket.on('answer', (data) => {
        const { target, answer } = data;
        socket.to(target).emit('answer', {
          answer,
          from: socket.id
        });
      });

      socket.on('ice_candidate', (data) => {
        const { target, candidate } = data;
        socket.to(target).emit('ice_candidate', {
          candidate,
          from: socket.id
        });
      });

      // Handle billing events
      socket.on('start_billing', async (data) => {
        const { readingId } = data;
        const userId = this.socketUserMap.get(socket.id);
        
        if (!userId) return;
        
        try {
          const reading = await storage.getReading(readingId);
          if (!reading) return;
          
          // Only client can start billing
            if (reading.clientId !== userId) return;
          
          const roomId = `reading_${readingId}`;
          
          // Notify room that billing has started
          this.io.to(roomId).emit('billing_started', {
            readingId,
            startTime: new Date().toISOString()
          });
          
          // Start billing timer
          this.startBillingTimer(readingId, reading.pricePerMinute);
        } catch (error) {
          console.error('Error starting billing:', error);
        }
      });

      socket.on('end_call', async (data: { readingId: number }) => {
        const { readingId } = data;
        const userId = this.socketUserMap.get(socket.id);
        
        if (!userId) return;
        
        try {
          const reading = await storage.getReading(readingId);
          if (!reading) return;
          
          // Check if user is authorized
          if (reading.readerId !== userId && reading.clientId !== userId) return;
          
          const roomId = `reading_${readingId}`;
          const role = reading.readerId === userId ? 'reader' : 'client';
          
          // Notify room that call has ended
          this.io.to(roomId).emit('call_ended', {
            readingId,
            endedBy: userId,
            role
          });
          
          // Clean up room
          this.cleanupRoom(readingId);
        } catch (error) {
          console.error('Error ending call:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        const userId = this.socketUserMap.get(socket.id);
        if (userId) {
          this.userSocketMap.delete(userId);
          this.socketUserMap.delete(socket.id);
        }
        
        // Check if socket was in any reading rooms
        for (const [readingId, sockets] of this.readingRooms.entries()) {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            
            // If room is empty, clean it up
            if (sockets.size === 0) {
              this.readingRooms.delete(readingId);
            } else {
              // Notify remaining users that someone disconnected
              const roomId = `reading_${readingId}`;
              this.io.to(roomId).emit('user_disconnected', {
                socketId: socket.id,
                userId
              });
            }
          }
        }
        
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  private billingTimers: Map<number, NodeJS.Timeout> = new Map();
  private billingData: Map<number, {
    startTime: Date;
    elapsedSeconds: number;
    pricePerMinute: number;
  }> = new Map();

  private startBillingTimer(readingId: number, pricePerMinute: number) {
    // Clear existing timer if any
    if (this.billingTimers.has(readingId)) {
      clearInterval(this.billingTimers.get(readingId));
    }
    
    // Initialize billing data
    this.billingData.set(readingId, {
      startTime: new Date(),
      elapsedSeconds: 0,
      pricePerMinute
    });
    
    // Create new timer that ticks every second
    const timer = setInterval(() => {
      this.processBillingTick(readingId);
    }, 1000);
    
    this.billingTimers.set(readingId, timer);
  }

  private processBillingTick(readingId: number) {
    const billingData = this.billingData.get(readingId);
    if (!billingData) return;
    
    // Increment elapsed time
    billingData.elapsedSeconds += 1;
    
    // Calculate current cost (in cents)
    const elapsedMinutes = billingData.elapsedSeconds / 60;
    const currentCost = Math.ceil(elapsedMinutes * billingData.pricePerMinute);
    
    // Emit billing tick event to room
    const roomId = `reading_${readingId}`;
    this.io.to(roomId).emit('billing_tick', {
      readingId,
      elapsedSeconds: billingData.elapsedSeconds,
      elapsedMinutes,
      currentCost
    });
    
    // Every minute, check client's balance
    if (billingData.elapsedSeconds % 60 === 0) {
      this.checkClientBalance(readingId, currentCost);
    }
  }

  private async checkClientBalance(readingId: number, currentCost: number) {
    try {
      const reading = await storage.getReading(readingId);
      if (!reading) return;
      
      const client = await storage.getUser(reading.clientId);
      if (!client) return;
      
      const balance = client.accountBalance || 0;
      const remainingBalance = balance - currentCost;
      
      // If balance is running low (less than 5 minutes remaining)
      const fiveMinutesCost = reading.pricePerMinute * 5;
      if (remainingBalance < fiveMinutesCost) {
        const roomId = `reading_${readingId}`;
        this.io.to(roomId).emit('low_balance', {
          readingId,
          remainingBalance: remainingBalance / 100, // Convert to dollars for display
          criticallyLow: remainingBalance <= 0
        });
        
        // If balance is depleted, end the call
        if (remainingBalance <= 0) {
          this.endBilling(readingId, 'insufficient_balance');
        }
      }
    } catch (error) {
      console.error('Error checking client balance:', error);
    }
  }

  private async endBilling(readingId: number, reason: string) {
    const billingData = this.billingData.get(readingId);
    if (!billingData) return;
    
    // Clear the timer
    if (this.billingTimers.has(readingId)) {
      clearInterval(this.billingTimers.get(readingId));
      this.billingTimers.delete(readingId);
    }
    
    // Calculate final cost
    const elapsedMinutes = billingData.elapsedSeconds / 60;
    const totalCost = Math.ceil(elapsedMinutes * billingData.pricePerMinute);
    
    // Emit billing ended event
    const roomId = `reading_${readingId}`;
    this.io.to(roomId).emit('billing_ended', {
      readingId,
      elapsedSeconds: billingData.elapsedSeconds,
      elapsedMinutes,
      totalCost: totalCost / 100, // Convert to dollars for display
      reason
    });
    
    // Update reading in database
    try {
      const reading = await storage.getReading(readingId);
      if (!reading) return;
      
      await storage.updateReading(readingId, {
        status: 'completed',
        duration: billingData.elapsedSeconds,
        totalPrice: totalCost,
        completedAt: new Date()
      });
      
      // Process payment from client to reader
      await this.processPayment(reading.clientId, reading.readerId, totalCost);
    } catch (error) {
      console.error('Error updating reading after billing ended:', error);
    }
    
    // Clean up
    this.billingData.delete(readingId);
    this.cleanupRoom(readingId);
  }

  private async processPayment(clientId: string, readerId: string, amount: number) {
    try {
      // Get client and reader
      const client = await storage.getUser(clientId);
      const reader = await storage.getUser(readerId);
      
      if (!client || !reader) return;
      
      // Check if client has sufficient balance
      const clientBalance = Number(client.accountBalance) || 0;
      if (clientBalance < amount) {
        console.warn(`Client ${clientId} has insufficient balance for payment: ${clientBalance} < ${amount}`);
        return;
      }
      
      // Calculate reader's share (70%)
      const readerShare = Math.floor(amount * 0.7);
      
      // Update client's balance
      await storage.updateUser(clientId, {
        accountBalance: clientBalance - amount
      });
      
      // Update reader's balance
      const readerBalance = Number(reader.accountBalance) || 0;
      await storage.updateUser(readerId, {
        accountBalance: readerBalance + readerShare
      });
      
      console.log(`Payment processed: ${amount} cents from client ${clientId} to reader ${readerId} (${readerShare} cents)`);
    } catch (error) {
      console.error('Error processing payment:', error);
    }
  }

  private cleanupRoom(readingId: number) {
    // Clear any billing timers
    if (this.billingTimers.has(readingId)) {
      clearInterval(this.billingTimers.get(readingId));
      this.billingTimers.delete(readingId);
    }
    
    // Remove billing data
    this.billingData.delete(readingId);
    
    // Remove room tracking
    this.readingRooms.delete(readingId);
  }
}

let webRTCService: WebRTCService | null = null;

export function initializeWebRTCService(server: Server): WebRTCService {
  if (!webRTCService) {
    webRTCService = new WebRTCService(server);
  }
  return webRTCService;
}

export function getWebRTCService(): WebRTCService | null {
  return webRTCService;
}