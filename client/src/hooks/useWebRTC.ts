import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Types
type SessionType = 'chat' | 'audio' | 'video';
type SignalingMessage = {
  type: string;
  data: any;
  sessionId?: string;
  senderId?: number;
  recipientId?: number;
};

type PeerConnection = {
  connection: RTCPeerConnection;
  userId: number;
  streams: MediaStream[];
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
  dataChannel?: RTCDataChannel;
};

export type ChatMessage = {
  id: string;
  senderId: number;
  content: string;
  timestamp: Date;
  senderName?: string;
  isSystem?: boolean;
};

export type WebRTCOptions = {
  onSignalingMessage?: (message: SignalingMessage) => void;
  onConnectionStateChanged?: (state: string, peerId: number) => void;
  onRemoteStream?: (stream: MediaStream, userId: number) => void;
  onDataChannelMessage?: (message: string, userId: number) => void;
  onError?: (error: Error) => void;
  sessionType: SessionType;
  autoAcceptCalls?: boolean;
  userId: number;
  websocketUrl?: string;
};

export default function useWebRTC(options: WebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<number, MediaStream[]>>(new Map());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(options.sessionType === 'video');
  const [mediaDevices, setMediaDevices] = useState<{ audio: MediaDeviceInfo[], video: MediaDeviceInfo[] }>({ audio: [], video: [] });
  const [currentAudioDevice, setCurrentAudioDevice] = useState<string | null>(null);
  const [currentVideoDevice, setCurrentVideoDevice] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'>('new');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Refs
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<number, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  
  const {
    onSignalingMessage,
    onConnectionStateChanged,
    onRemoteStream,
    onDataChannelMessage,
    onError,
    sessionType,
    autoAcceptCalls = true,
    userId,
    websocketUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/rtc-signaling`
  } = options;
  
  // Initialize WebSocket connection
  const initializeSocket = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      socketRef.current = new WebSocket(websocketUrl);
      
      socketRef.current.onopen = () => {
        console.log('WebSocket connection established');
        // Send a ping to keep the connection alive
        setInterval(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };
      
      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SignalingMessage;
          
          if (onSignalingMessage) {
            onSignalingMessage(message);
          }
          
          handleSignalingMessage(message);
        } catch (error) {
          console.error('Error parsing signaling message:', error);
        }
      };
      
      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError(new Error('WebSocket connection error'));
        if (onError) onError(new Error('WebSocket connection error'));
      };
      
      socketRef.current.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
        setConnectionState('disconnected');
        
        // Try to reconnect after a delay
        setTimeout(() => {
          initializeSocket();
        }, 5000);
      };
    } catch (err) {
      console.error('Error initializing WebSocket:', err);
      setError(err instanceof Error ? err : new Error('Unknown WebSocket error'));
      if (onError) onError(err instanceof Error ? err : new Error('Unknown WebSocket error'));
    }
  }, [websocketUrl, onSignalingMessage, onError]);
  
  // Get media devices
  const getMediaDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      setMediaDevices({
        audio: audioInputs,
        video: videoInputs
      });
      
      // Set default devices if available
      if (audioInputs.length > 0 && !currentAudioDevice) {
        setCurrentAudioDevice(audioInputs[0].deviceId);
      }
      
      if (videoInputs.length > 0 && !currentVideoDevice && sessionType === 'video') {
        setCurrentVideoDevice(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Error getting media devices:', err);
    }
  }, [currentAudioDevice, currentVideoDevice, sessionType]);
  
  // Initialize local media stream
  const initializeLocalStream = useCallback(async () => {
    try {
      // Close any existing stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Configure constraints based on session type
      const constraints: MediaStreamConstraints = {
        audio: currentAudioDevice ? { deviceId: { exact: currentAudioDevice } } : true
      };
      
      if (sessionType === 'video') {
        constraints.video = currentVideoDevice ? { deviceId: { exact: currentVideoDevice } } : true;
      } else {
        constraints.video = false;
      }
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Update state and refs
      setLocalStream(stream);
      localStreamRef.current = stream;
      
      // Set initial media states
      setIsMuted(false);
      setIsVideoEnabled(sessionType === 'video');
      
      return stream;
    } catch (err) {
      console.error('Error initializing local stream:', err);
      setError(err instanceof Error ? err : new Error('Failed to access media devices'));
      if (onError) onError(err instanceof Error ? err : new Error('Failed to access media devices'));
      return null;
    }
  }, [currentAudioDevice, currentVideoDevice, sessionType, onError]);
  
  // Create RTCPeerConnection
  const createPeerConnection = useCallback((peerId: number) => {
    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: iceServersRef.current.length > 0 ? iceServersRef.current : [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      // Add local stream tracks to the connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (localStreamRef.current) {
            peerConnection.addTrack(track, localStreamRef.current);
          }
        });
      }
      
      // Create data channel for text chat
      const dataChannel = peerConnection.createDataChannel('chat', {
        ordered: true
      });
      
      // Set up data channel event handlers
      dataChannel.onopen = () => {
        console.log(`Data channel with peer ${peerId} opened`);
      };
      
      dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Add message to chat history
          const chatMessage: ChatMessage = {
            id: uuidv4(),
            senderId: peerId,
            content: message.content,
            timestamp: new Date(),
            senderName: message.senderName
          };
          
          setChatMessages(prev => [...prev, chatMessage]);
          
          if (onDataChannelMessage) {
            onDataChannelMessage(event.data, peerId);
          }
        } catch (error) {
          console.error('Error parsing data channel message:', error);
        }
      };
      
      dataChannel.onerror = (error) => {
        console.error(`Data channel error with peer ${peerId}:`, error);
      };
      
      dataChannel.onclose = () => {
        console.log(`Data channel with peer ${peerId} closed`);
      };
      
      // Set up ICE candidate event handler
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Send ICE candidate to remote peer via signaling server
          sendSignalingMessage({
            type: 'ice-candidate',
            data: event.candidate,
            recipientId: peerId,
            sessionId
          });
        }
      };
      
      // Handle incoming tracks
      peerConnection.ontrack = (event) => {
        const stream = event.streams[0];
        
        if (!stream) return;
        
        console.log(`Received remote stream from peer ${peerId}`);
        
        // Update remote streams
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          
          if (!newStreams.has(peerId)) {
            newStreams.set(peerId, [stream]);
          } else {
            const peerStreams = newStreams.get(peerId) || [];
            // Check if this stream is already in the array
            if (!peerStreams.some(s => s.id === stream.id)) {
              newStreams.set(peerId, [...peerStreams, stream]);
            }
          }
          
          return newStreams;
        });
        
        if (onRemoteStream) {
          onRemoteStream(stream, peerId);
        }
      };
      
      // Set up connection state change handler
      peerConnection.onconnectionstatechange = () => {
        console.log(`Peer ${peerId} connection state changed:`, peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connected') {
          setIsConnected(true);
          setConnectionState('connected');
        } else if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
          setConnectionState(peerConnection.connectionState as any);
        }
        
        if (onConnectionStateChanged) {
          onConnectionStateChanged(peerConnection.connectionState, peerId);
        }
      };
      
      // Handle incoming data channels
      peerConnection.ondatachannel = (event) => {
        const incomingDataChannel = event.channel;
        
        incomingDataChannel.onmessage = (e) => {
          try {
            const message = JSON.parse(e.data);
            
            // Add message to chat history
            const chatMessage: ChatMessage = {
              id: uuidv4(),
              senderId: peerId,
              content: message.content,
              timestamp: new Date(),
              senderName: message.senderName
            };
            
            setChatMessages(prev => [...prev, chatMessage]);
            
            if (onDataChannelMessage) {
              onDataChannelMessage(e.data, peerId);
            }
          } catch (error) {
            console.error('Error parsing incoming data channel message:', error);
          }
        };
      };
      
      // Create and store peer connection
      const peerConnectionInfo: PeerConnection = {
        connection: peerConnection,
        userId: peerId,
        streams: [],
        dataChannel
      };
      
      peerConnectionsRef.current.set(peerId, peerConnectionInfo);
      
      return peerConnectionInfo;
    } catch (err) {
      console.error('Error creating peer connection:', err);
      setError(err instanceof Error ? err : new Error('Failed to create peer connection'));
      if (onError) onError(err instanceof Error ? err : new Error('Failed to create peer connection'));
      return null;
    }
  }, [sessionId, onConnectionStateChanged, onDataChannelMessage, onRemoteStream, onError]);
  
  // Send a signaling message
  const sendSignalingMessage = useCallback((message: SignalingMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not open');
      setError(new Error('WebSocket is not open'));
    }
  }, []);
  
  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(async (message: SignalingMessage) => {
    switch (message.type) {
      case 'ice-servers':
        // Store ICE servers from the server
        iceServersRef.current = message.data.iceServers;
        break;
        
      case 'peers':
        // Handle list of peers in the session
        console.log('Received peer list:', message.data.peers);
        break;
        
      case 'peer-joined':
        // A new peer has joined the session
        console.log('Peer joined:', message.data.peerId);
        
        // If autoAcceptCalls is true, create an offer for the new peer
        if (autoAcceptCalls) {
          const peerConnection = createPeerConnection(message.data.peerId);
          
          if (peerConnection) {
            try {
              const offer = await peerConnection.connection.createOffer();
              await peerConnection.connection.setLocalDescription(offer);
              
              sendSignalingMessage({
                type: 'offer',
                data: offer,
                recipientId: message.data.peerId,
                sessionId
              });
            } catch (err) {
              console.error('Error creating offer:', err);
            }
          }
        }
        break;
        
      case 'peer-left':
        // A peer has left the session
        console.log('Peer left:', message.data.peerId);
        
        // Clean up the peer connection
        const peerToRemove = peerConnectionsRef.current.get(message.data.peerId);
        if (peerToRemove) {
          peerToRemove.connection.close();
          peerConnectionsRef.current.delete(message.data.peerId);
          
          // Remove remote streams for this peer
          setRemoteStreams(prev => {
            const newStreams = new Map(prev);
            newStreams.delete(message.data.peerId);
            return newStreams;
          });
        }
        
        // Add system message to chat
        setChatMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            senderId: 0,
            content: 'The other user has left the session',
            timestamp: new Date(),
            isSystem: true
          }
        ]);
        break;
        
      case 'offer':
        // Received an offer from a peer
        console.log('Received offer from peer:', message.senderId);
        
        if (!message.senderId) return;
        
        // Create or get peer connection
        let peerConnection = peerConnectionsRef.current.get(message.senderId);
        
        if (!peerConnection) {
          peerConnection = createPeerConnection(message.senderId);
        }
        
        if (peerConnection) {
          try {
            await peerConnection.connection.setRemoteDescription(new RTCSessionDescription(message.data));
            
            const answer = await peerConnection.connection.createAnswer();
            await peerConnection.connection.setLocalDescription(answer);
            
            sendSignalingMessage({
              type: 'answer',
              data: answer,
              recipientId: message.senderId,
              sessionId
            });
          } catch (err) {
            console.error('Error handling offer:', err);
          }
        }
        break;
        
      case 'answer':
        // Received an answer from a peer
        console.log('Received answer from peer:', message.senderId);
        
        if (!message.senderId) return;
        
        // Get peer connection
        const peerWithAnswer = peerConnectionsRef.current.get(message.senderId);
        
        if (peerWithAnswer) {
          try {
            await peerWithAnswer.connection.setRemoteDescription(new RTCSessionDescription(message.data));
          } catch (err) {
            console.error('Error handling answer:', err);
          }
        }
        break;
        
      case 'ice-candidate':
        // Received an ICE candidate from a peer
        if (!message.senderId) return;
        
        // Get peer connection
        const peerWithCandidate = peerConnectionsRef.current.get(message.senderId);
        
        if (peerWithCandidate) {
          try {
            await peerWithCandidate.connection.addIceCandidate(new RTCIceCandidate(message.data));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
        break;
        
      case 'chat-message':
        // Received a chat message
        if (!message.senderId) return;
        
        // Add message to chat history
        setChatMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            senderId: message.senderId!,
            content: message.data.content,
            timestamp: new Date(),
            senderName: message.data.senderName
          }
        ]);
        break;
        
      case 'error':
        // Received an error message from the server
        console.error('Signaling server error:', message.data.message);
        setError(new Error(message.data.message));
        if (onError) onError(new Error(message.data.message));
        break;
        
      case 'session-started':
        // Session has started
        console.log('Session started:', message.data);
        
        // Add system message to chat
        setChatMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            senderId: 0,
            content: 'The session has started',
            timestamp: new Date(),
            isSystem: true
          }
        ]);
        break;
        
      case 'session-ended':
        // Session has ended
        console.log('Session ended:', message.data);
        
        // Add system message to chat
        setChatMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            senderId: 0,
            content: 'The session has ended',
            timestamp: new Date(),
            isSystem: true
          }
        ]);
        
        // Close all peer connections
        peerConnectionsRef.current.forEach(peer => {
          peer.connection.close();
        });
        
        peerConnectionsRef.current.clear();
        setRemoteStreams(new Map());
        setIsConnected(false);
        setConnectionState('closed');
        break;
        
      case 'notification':
        // Notification from the server
        console.log('Notification:', message.data);
        
        // Check if it's a balance notification
        if (message.data.type === 'balance-update') {
          // Add system message to chat
          setChatMessages(prev => [
            ...prev,
            {
              id: uuidv4(),
              senderId: 0,
              content: message.data.message,
              timestamp: new Date(),
              isSystem: true
            }
          ]);
        }
        break;
        
      case 'pong':
        // Response to our ping - do nothing
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }, [createPeerConnection, sessionId, sendSignalingMessage, autoAcceptCalls, onError]);
  
  // Join a session
  const joinSession = useCallback(async (newSessionId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not open');
      setError(new Error('WebSocket is not open'));
      return false;
    }
    
    try {
      // Initialize local stream if not already done
      if (!localStreamRef.current) {
        const stream = await initializeLocalStream();
        if (!stream) return false;
      }
      
      // Set session ID
      setSessionId(newSessionId);
      
      // Join the session by sending a join message to the signaling server
      sendSignalingMessage({
        type: 'join',
        data: {
          userId,
          role: 'user',
          sessionId: newSessionId,
          peerId: userId
        },
        sessionId: newSessionId
      });
      
      setConnectionState('connecting');
      
      return true;
    } catch (err) {
      console.error('Error joining session:', err);
      setError(err instanceof Error ? err : new Error('Failed to join session'));
      if (onError) onError(err instanceof Error ? err : new Error('Failed to join session'));
      return false;
    }
  }, [userId, initializeLocalStream, sendSignalingMessage, onError]);
  
  // Leave a session
  const leaveSession = useCallback(() => {
    if (sessionId) {
      // Send leave message to signaling server
      sendSignalingMessage({
        type: 'leave',
        data: {},
        sessionId
      });
      
      // Close all peer connections
      peerConnectionsRef.current.forEach(peer => {
        peer.connection.close();
      });
      
      peerConnectionsRef.current.clear();
      setRemoteStreams(new Map());
      setIsConnected(false);
      setConnectionState('closed');
      setSessionId(null);
    }
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, [sessionId, sendSignalingMessage]);
  
  // Start a session
  const startSession = useCallback(() => {
    if (sessionId) {
      sendSignalingMessage({
        type: 'start-session',
        data: {},
        sessionId
      });
    }
  }, [sessionId, sendSignalingMessage]);
  
  // End a session
  const endSession = useCallback(() => {
    if (sessionId) {
      sendSignalingMessage({
        type: 'end-session',
        data: {},
        sessionId
      });
      
      leaveSession();
    }
  }, [sessionId, sendSignalingMessage, leaveSession]);
  
  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      
      setIsMuted(!isMuted);
    }
  }, [isMuted]);
  
  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current && sessionType === 'video') {
      const videoTracks = localStreamRef.current.getVideoTracks();
      
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [isVideoEnabled, sessionType]);
  
  // Change audio device
  const changeAudioDevice = useCallback(async (deviceId: string) => {
    setCurrentAudioDevice(deviceId);
    await initializeLocalStream();
  }, [initializeLocalStream]);
  
  // Change video device
  const changeVideoDevice = useCallback(async (deviceId: string) => {
    setCurrentVideoDevice(deviceId);
    await initializeLocalStream();
  }, [initializeLocalStream]);
  
  // Send a chat message
  const sendChatMessage = useCallback((content: string, senderName?: string) => {
    if (!sessionId) return false;
    
    // Create message object
    const message = {
      content,
      senderName: senderName || 'User',
      timestamp: new Date().toISOString()
    };
    
    // Add to local chat history
    const chatMessage: ChatMessage = {
      id: uuidv4(),
      senderId: userId,
      content,
      timestamp: new Date(),
      senderName: senderName || 'You'
    };
    
    setChatMessages(prev => [...prev, chatMessage]);
    
    // Send via data channels if connected
    let dataSent = false;
    
    peerConnectionsRef.current.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(message));
        dataSent = true;
      }
    });
    
    // If data channels aren't working, send via signaling server
    if (!dataSent) {
      sendSignalingMessage({
        type: 'chat-message',
        data: message,
        sessionId
      });
    }
    
    return true;
  }, [userId, sessionId, sendSignalingMessage]);
  
  // Initialize on mount
  useEffect(() => {
    // Initialize WebSocket
    initializeSocket();
    
    // Get available media devices
    getMediaDevices();
    
    // Request media permissions early
    navigator.mediaDevices.getUserMedia({ audio: true, video: sessionType === 'video' })
      .then(stream => {
        // Stop tracks right away, we'll request them again when needed
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(err => {
        console.error('Error requesting media permissions:', err);
      });
    
    // Clean up on unmount
    return () => {
      // Close WebSocket
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      // Close all peer connections
      peerConnectionsRef.current.forEach(peer => {
        peer.connection.close();
      });
      
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeSocket, getMediaDevices, sessionType]);
  
  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      getMediaDevices();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [getMediaDevices]);
  
  return {
    localStream,
    remoteStreams,
    isConnected,
    isMuted,
    isVideoEnabled,
    sessionId,
    error,
    connectionState,
    mediaDevices,
    chatMessages,
    joinSession,
    leaveSession,
    startSession,
    endSession,
    toggleAudio,
    toggleVideo,
    changeAudioDevice,
    changeVideoDevice,
    sendChatMessage,
    initializeLocalStream
  };
} 