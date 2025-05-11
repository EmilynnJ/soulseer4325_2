import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./migrations/migration-manager";
import { config } from "dotenv";
import { Server as SocketIOServer } from "socket.io";
import { initializeSignalingService } from "./services/signaling";

// Load environment variables
config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add health check endpoint for Render
app.get('/api/health', (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VITE_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize database before registering routes
    await initializeDatabase();
    log('Database initialized successfully', 'database');
  } catch (error) {
    log(`Failed to initialize database: ${error}`, 'database');
    // Continue with server startup even if database initialization fails
  }
  
  const server = await registerRoutes(app);
  
  // Initialize Socket.io for WebRTC signaling
  const io = initializeSignalingService(server);
  
  // Set up reading-specific signaling namespace
  const readingNamespace = io.of('/signal/reading/:readingId');
  
  readingNamespace.on('connection', (socket) => {
    const readingId = socket.handshake.query.readingId as string;
    log(`New connection to reading ${readingId} namespace`, 'signaling');
    
    // Join the reading room
    socket.join(`reading-${readingId}`);
    
    // Handle join event
    socket.on('join', (data) => {
      const { userId, role } = data;
      log(`User ${userId} (${role}) joined reading ${readingId}`, 'signaling');
      
      // Notify others in the room
      socket.to(`reading-${readingId}`).emit('user_joined', {
        userId,
        role
      });
      
      // Store user data in socket
      socket.data.userId = userId;
      socket.data.role = role;
      socket.data.readingId = readingId;
    });
    
    // Handle WebRTC signaling events
    socket.on('offer', (data) => {
      socket.to(`reading-${readingId}`).emit('offer', {
        ...data,
        senderId: socket.data.userId
      });
    });
    
    socket.on('answer', (data) => {
      socket.to(`reading-${readingId}`).emit('answer', {
        ...data,
        senderId: socket.data.userId
      });
    });
    
    socket.on('ice-candidate', (data) => {
      socket.to(`reading-${readingId}`).emit('ice-candidate', {
        ...data,
        senderId: socket.data.userId
      });
    });
    
    // Handle billing ticks
    socket.on('billing-tick', (data) => {
      const { elapsedMinutes, currentAmount } = data;
      
      // Emit to all clients in the room
      io.to(`reading-${readingId}`).emit('billing-update', {
        elapsedMinutes,
        currentAmount,
        timestamp: new Date().toISOString()
      });
      
      log(`Billing tick: ${elapsedMinutes} minutes, $${currentAmount/100} for reading ${readingId}`, 'billing');
    });
    
    // Handle end call event
    socket.on('end', (data) => {
      const { reason } = data;
      
      // Emit to all clients in the room
      io.to(`reading-${readingId}`).emit('call-ended', {
        userId: socket.data.userId,
        role: socket.data.role,
        reason,
        timestamp: new Date().toISOString()
      });
      
      log(`Call ended by ${socket.data.userId} in reading ${readingId}`, 'signaling');
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      log(`User ${socket.data.userId} disconnected from reading ${readingId}`, 'signaling');
      
      // Notify others in the room
      socket.to(`reading-${readingId}`).emit('user_left', {
        userId: socket.data.userId,
        role: socket.data.role
      });
    });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);
    res.status(status).json({ message });
    // Don't rethrow the error, as it can crash the application
  });
  
  // Set up a heartbeat interval for active reading sessions
  setInterval(() => {
    const rooms = io.of('/signal/reading').adapter.rooms;
    for (const [roomName, room] of rooms.entries()) {
      if (roomName.startsWith('reading-')) {
        const readingId = roomName.replace('reading-', '');
        io.to(roomName).emit('heartbeat', {
          timestamp: new Date().toISOString(),
          readingId
        });
      }
    }
  }, 30000); // Send heartbeat every 30 seconds

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
