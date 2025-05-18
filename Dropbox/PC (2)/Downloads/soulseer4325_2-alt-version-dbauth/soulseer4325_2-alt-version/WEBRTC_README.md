# SoulSeer WebRTC System

This document outlines the implementation details of the WebRTC-based psychic reading platform for SoulSeer.

## Overview

The SoulSeer WebRTC system provides a complete, production-ready solution for real-time communication between psychic readers and clients. It supports:

- Pay-per-minute chat, audio, and video readings
- One-time payment scheduled readings
- Live streaming with real-time gifting
- Premium messaging

## Architecture

The system is built with the following components:

### Backend

- **Signaling Server**: Custom WebSocket server for WebRTC handshaking
- **Billing System**: Manages per-minute billing and client balance
- **REST API**: Endpoints for session management, payments, and user information
- **Database**: Neon PostgreSQL for storing session data, user balances, and reader rates

### Frontend

- **React Components**: Modern UI components for video calls, chat, and session management
- **WebRTC Hooks**: Custom React hooks for managing WebRTC connections
- **Media Control**: Components for controlling local audio/video streams

## Key Features

### 1. Session Types

- **Chat**: Text-only sessions with real-time messaging
- **Audio**: Voice-only calls between reader and client
- **Video**: Full video+audio sessions between reader and client

### 2. Payment Models

- **Pay-per-minute**: Client prepays by adding funds to their balance, paying only for minutes used
- **Scheduled Sessions**: Fixed flat-rate payments for scheduled sessions of 15, 30, 45, or 60 minutes

### 3. Real-time Billing

The system implements real-time billing with the following features:

- Billing timer starts when a session becomes active
- Charges are processed in one-minute intervals
- Client balance is updated in real-time
- Session ends automatically if client balance falls below the reader's per-minute rate
- Revenue is split between reader (70%) and platform (30%)

### 4. WebRTC Implementation

The WebRTC system is built from scratch using the native WebRTC APIs:

- **RTCPeerConnection**: Manages peer-to-peer connections
- **getUserMedia**: Accesses local audio and video streams
- **ICE/STUN/TURN**: Handles NAT traversal and connection negotiation
- **RTCDataChannel**: Enables real-time text messaging

### 5. Notifications

- Readers receive notifications for new session requests
- Clients receive notifications for session status changes
- Both users receive balance/earnings updates during sessions

## Technical Flow

1. **Session Request**:
   - Client selects a reader and session type
   - System checks client balance
   - Session request is created and reader is notified

2. **Session Acceptance**:
   - Reader accepts the session request
   - Both parties join the WebRTC signaling channel
   - WebRTC handshaking occurs (offer/answer/ICE candidates)

3. **Active Session**:
   - Media streams are connected
   - Billing timer starts
   - Per-minute charges are processed
   - Balances are updated in real-time

4. **Session End**:
   - Either party can end the session
   - Final duration and charges are calculated
   - Session details are stored in the database

## Security Considerations

- All WebRTC connections are secured with DTLS/SRTP
- Authentication is handled through Appwrite
- Session IDs are UUIDs to prevent guessing
- Access control ensures only authorized users can join sessions

## Environment Configuration

The system requires the following environment variables:

```
WEBRTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"stun:stun1.l.google.com:19302"}]
WEBRTC_TURN_SERVERS=relay1.expressturn.com:3480
WEBRTC_TURN_SERVERS_USERNAME=relay1.expressturn.com:3480
WEBRTC_TURN_SERVERS_PASSWORD=M5zys3Dh++iwdoCz4xJF3SWHS2M=
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SIGNING_SECRET=your_webhook_signing_secret
DATABASE_URL=postgresql://neondb_owner:npg_Aj2RfUtlYc4I@ep-snowy-tooth-a4pqf58x-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Database Schema

The system uses the following database tables:

- `rtc_sessions`: Stores session information
- `reader_rates`: Stores reader pricing information
- `client_balances`: Tracks client balances
- `reader_availability`: Tracks reader online status
- `notifications`: Stores user notifications

## API Endpoints

### Reader Endpoints

- `GET /api/webrtc/reader/rates`: Get reader's rates
- `POST /api/webrtc/reader/rates`: Set reader's rates
- `POST /api/webrtc/reader/availability`: Update availability status
- `GET /api/webrtc/reader/sessions`: Get active sessions
- `POST /api/webrtc/reader/accept-session/:sessionId`: Accept a session request

### Client Endpoints

- `GET /api/webrtc/client/balance`: Get client's balance
- `POST /api/webrtc/client/add-funds`: Add funds to client's balance
- `GET /api/webrtc/client/available-readers`: Get available readers
- `POST /api/webrtc/client/request-session`: Request a pay-per-minute session
- `POST /api/webrtc/client/schedule-session`: Schedule a flat-rate session

### Shared Endpoints

- `GET /api/webrtc/session/:sessionId`: Get session details
- `POST /api/webrtc/webhook`: Stripe webhook endpoint

## WebSocket Signaling Protocol

The WebRTC signaling server uses a custom protocol with the following message types:

- `join`: Join a session
- `offer`: WebRTC offer
- `answer`: WebRTC answer
- `ice-candidate`: ICE candidate
- `chat-message`: Chat message
- `start-session`: Start a session
- `end-session`: End a session
- `notification`: System notification

## Usage Example

```javascript
// Client-side code example
import { useWebRTC } from '../../hooks/useWebRTC';

function ReadingSession({ userId, sessionId }) {
  const {
    localStream,
    remoteStreams,
    joinSession,
    leaveSession,
    toggleAudio,
    toggleVideo,
    sendChatMessage
  } = useWebRTC({
    sessionType: 'video',
    userId,
    autoAcceptCalls: true
  });

  useEffect(() => {
    joinSession(sessionId);
    return () => leaveSession();
  }, [sessionId]);

  // Render video elements, chat interface, and controls
}
```

## Testing and Debugging

To test the WebRTC system locally:

1. Run the server: `npm run dev`
2. Open two browser tabs/windows
3. Log in as different users (reader/client)
4. Request a session and test the connection

For debugging:

- Check the browser console for WebRTC connection details
- Use the Chrome WebRTC internals: `chrome://webrtc-internals/`
- Monitor WebSocket messages in the Network tab

## Deployment Considerations

When deploying to production:

- Ensure proper TURN server configuration for NAT traversal
- Set up HTTPS for secure WebRTC connections
- Configure Stripe webhook endpoints
- Set appropriate timeouts for WebSocket connections
- Monitor server resources (CPU, memory) as WebRTC can be resource-intensive 