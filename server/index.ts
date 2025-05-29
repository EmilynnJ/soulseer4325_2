import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { log } from './vite';
import { initializeAppwrite } from './appwrite-admin';

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

// Middleware
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdn.jsdelivr.net",
      "connect-src 'self' https://cloud.appwrite.io https://js.stripe.com https://api.stripe.com https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https://*",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-src https://js.stripe.com",
      "object-src 'none'"
    ].join('; ')
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
