import React, { useState, useEffect, useRef } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:relay1.expressturn.com:3480',
    username: 'efC31HLVNPO2ESV7EI',
    credential: 'p3iL2wVPAhMAlmgD'
  }
];

interface WebRTCSessionProps {
  roomId: string;
  userId: string;
  role: 'client' | 'reader';
}

export const WebRTCSession: React.FC<WebRTCSessionProps> = ({ roomId, userId, role }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    initializeWebRTC();
    return () => cleanup();
  }, []);

  const initializeWebRTC = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            roomId,
            payload: event.candidate
          }));
        }
      };

      pc.onconnectionstatechange = () => {
        setIsConnected(pc.connectionState === 'connected');
      };

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/webrtc`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'join-room',
          roomId,
          userId,
          payload: { userId, role }
        }));
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await handleSignalingMessage(message);
      };

    } catch (error) {
      console.error('Error initializing WebRTC:', error);
    }
  };

  const handleSignalingMessage = async (message: any) => {
    const { type, payload } = message;
    const pc = pcRef.current;
    if (!pc) return;

    switch (type) {
      case 'participant-joined':
        if (payload.role !== role && role === 'reader') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          wsRef.current?.send(JSON.stringify({
            type: 'webrtc-offer',
            roomId,
            payload: offer
          }));
        }
        break;

      case 'webrtc-offer':
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({
          type: 'webrtc-answer',
          roomId,
          payload: answer
        }));
        break;

      case 'webrtc-answer':
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        break;

      case 'ice-candidate':
        await pc.addIceCandidate(new RTCIceCandidate(payload));
        break;
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="flex-1 relative">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <p className="text-xl">
              {isConnected ? 'Connected' : 'Connecting...'}
            </p>
          </div>
        )}

        <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <button
            onClick={cleanup}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg"
          >
            End Call
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebRTCSession;
