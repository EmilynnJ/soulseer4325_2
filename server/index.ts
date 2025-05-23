import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { log } from './vite';
import { initializeWebRTCService } from './services/webrtc-service';
import webrtcRoutes from './routes/webrtc-routes';
import { initializeAppwrite } from './appwrite-admin';
import { setupSignalingServer } from './webrtc/signaling';
import { startBillingService } from './webrtc/billing';

// Load environment variables
config();

// Initialize Appwrite Admin
initializeAppwrite();

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize WebRTC service
const io = initializeWebRTCService(server);

// Middleware
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com"
  );
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'soulseer-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// API routes
app.use('/api', webrtcRoutes);

// Add WebRTC routes
app.use('/api/webrtc', webrtcRoutes);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist/public')));

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Set up WebSocket for WebRTC signaling
setupSignalingServer(server);

// Start the WebRTC billing service
const stopBillingService = startBillingService();

// Clean up on server shutdown
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  stopBillingService();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  stopBillingService();
  server.close();
  process.exit(0);
});

// Start listening
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default server;