import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { log } from './vite';
<<<<<<< HEAD
import webrtcRoutes from './routes/webrtc-routes';
import { initializeAppwrite } from './appwrite-admin';
import { setupSignalingServer } from './webrtc/signaling';
import { startBillingService } from './webrtc/billing';
=======
import { setupAuth } from './auth';
import { registerRoutes } from './routes';
// import { initializeAppwrite } from './appwrite-admin'; // Removed Appwrite admin import
>>>>>>> refs/remotes/origin/master

// Load environment variables
config();

// Initialize Appwrite Admin (REMOVED)
// initializeAppwrite();

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
// Initialize authentication routes
setupAuth(app);

<<<<<<< HEAD
=======
// Register application routes and obtain the HTTP server instance
const server = await registerRoutes(app);

>>>>>>> refs/remotes/origin/master
// Middleware
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", `
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdn.jsdelivr.net;
    connect-src 'self' https://api.stripe.com https://fonts.googleapis.com https://fonts.gstatic.com; # Removed https://cloud.appwrite.io
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https:;
    frame-src https://js.stripe.com;
    object-src 'none';
  `.trim().replace(/\s{2,}/g, ' '));
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

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist/public')));

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Start listening
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default server;
