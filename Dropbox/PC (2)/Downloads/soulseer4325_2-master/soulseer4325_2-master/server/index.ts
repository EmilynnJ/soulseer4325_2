import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the dist/public directory
app.use(express.static(join(__dirname, 'public')));

// WebRTC proxy routes - forward to standalone WebRTC service
app.use('/api/webrtc', async (req, res) => {
  try {
    const webrtcServiceUrl = process.env.WEBRTC_SERVICE_URL || 'http://localhost:3002';
    const targetUrl = `${webrtcServiceUrl}${req.originalUrl}`;
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || ''
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('WebRTC service proxy error:', error);
    res.status(500).json({ error: 'WebRTC service unavailable' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'soulseer-main-app',
    webrtcServiceUrl: process.env.WEBRTC_SERVICE_URL || 'not-configured'
  });
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SoulSeer main app running on port ${PORT}`);
  console.log(`WebRTC service URL: ${process.env.WEBRTC_SERVICE_URL || 'http://localhost:3002'}`);
});
