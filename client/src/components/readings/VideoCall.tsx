import React, { useRef, useEffect, useState } from 'react';
import { useWebRTC, ChatMessage } from '../../hooks/useWebRTC';
import { Mic, MicOff, Video, VideoOff, Phone, MessageSquare, X, SendHorizontal, DollarSign } from 'lucide-react';
import { useParams, useNavigate } from 'wouter';
import { formatDistance } from 'date-fns';
import axios from 'axios';

interface VideoCallProps {
  userId: number;
  userName: string;
  sessionType: 'chat' | 'audio' | 'video';
  isReader: boolean;
  readerId?: number;
  clientId?: number;
}

export default function VideoCall({ userId, userName, sessionType, isReader, readerId, clientId }: VideoCallProps) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [remoteUserName, setRemoteUserName] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [showChat, setShowChat] = useState<boolean>(sessionType === 'chat');
  const [chatInput, setChatInput] = useState<string>('');
  const [balance, setBalance] = useState<number>(0);
  const [minuteRate, setMinuteRate] = useState<number>(0);
  const [isAccepted, setIsAccepted] = useState<boolean>(false);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const navigate = useNavigate();
  
  // Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize WebRTC
  const {
    localStream,
    remoteStreams,
    isConnected,
    isMuted,
    isVideoEnabled,
    connectionState,
    chatMessages,
    joinSession,
    leaveSession,
    startSession,
    endSession,
    toggleAudio,
    toggleVideo,
    sendChatMessage,
    initializeLocalStream
  } = useWebRTC({
    sessionType,
    userId,
    autoAcceptCalls: true
  });

  // Fetch session details from backend
  useEffect(() => {
    if (sessionId) {
      axios.get(`/api/webrtc/session/${sessionId}`)
        .then(response => {
          setSessionDetails(response.data);
          
          // Set remote user name
          if (isReader) {
            setRemoteUserName(response.data.client?.fullName || 'Client');
          } else {
            setRemoteUserName(response.data.reader?.fullName || 'Reader');
            setMinuteRate(getSessionRate(response.data));
          }
          
          // Check if session is already active
          if (response.data.status === 'active') {
            setIsAccepted(true);
          }
        })
        .catch(error => {
          console.error('Error fetching session details:', error);
          // Redirect to home if session not found
          navigate('/');
        });
    }
  }, [sessionId, isReader, navigate]);

  // Get the appropriate rate based on session type
  const getSessionRate = (session: any): number => {
    if (!session || !session.reader || !session.reader.readerRates) return 0;
    
    const rates = session.reader.readerRates[0];
    if (!rates) return 0;
    
    switch (sessionType) {
      case 'chat':
        return Number(rates.chatRate);
      case 'audio':
        return Number(rates.audioRate);
      case 'video':
        return Number(rates.videoRate);
      default:
        return 0;
    }
  };

  // Fetch client balance
  useEffect(() => {
    if (!isReader) {
      axios.get('/api/webrtc/client/balance')
        .then(response => {
          setBalance(response.data.balance);
        })
        .catch(error => {
          console.error('Error fetching balance:', error);
        });
    }
  }, [isReader]);

  // Join the session when the component mounts
  useEffect(() => {
    if (sessionId) {
      const initSession = async () => {
        await initializeLocalStream();
        const joined = await joinSession(sessionId);
        
        if (!joined) {
          console.error('Failed to join session');
          navigate('/');
        }
      };
      
      initSession();
    }
    
    // Clean up when the component unmounts
    return () => {
      leaveSession();
    };
  }, [sessionId, initializeLocalStream, joinSession, leaveSession, navigate]);

  // Start session timer
  useEffect(() => {
    if (isAccepted) {
      const timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [isAccepted]);

  // Update local video element when local stream changes
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Update remote video element when remote streams change
  useEffect(() => {
    if (remoteStreams.size > 0 && remoteVideoRef.current) {
      // Get the first stream from the first peer
      const firstPeerId = Array.from(remoteStreams.keys())[0];
      const firstPeerStreams = remoteStreams.get(firstPeerId);
      
      if (firstPeerStreams && firstPeerStreams.length > 0) {
        remoteVideoRef.current.srcObject = firstPeerStreams[0];
      }
    }
  }, [remoteStreams]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle accept session
  const handleAcceptSession = async () => {
    if (isReader && sessionId) {
      try {
        await axios.post(`/api/webrtc/reader/accept-session/${sessionId}`);
        startSession();
        setIsAccepted(true);
      } catch (error) {
        console.error('Error accepting session:', error);
      }
    }
  };

  // Handle ending a call
  const handleEndCall = () => {
    endSession();
    navigate('/');
  };

  // Handle sending a chat message
  const handleSendMessage = () => {
    if (chatInput.trim()) {
      sendChatMessage(chatInput, userName);
      setChatInput('');
    }
  };

  // Format duration as mm:ss
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg">{remoteUserName}</span>
          {!isReader && (
            <div className="flex items-center text-green-400">
              <DollarSign size={16} />
              <span className="text-sm">${minuteRate}/min</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {isAccepted && (
            <div className="px-3 py-1 bg-indigo-600 rounded-full text-sm">
              {formatDuration(duration)}
            </div>
          )}
          {!isReader && (
            <div className="px-3 py-1 bg-green-600 rounded-full text-sm">
              Balance: ${balance.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video container */}
        <div className={`flex-1 relative ${showChat && 'hidden md:flex'}`}>
          {sessionType === 'video' ? (
            <>
              {/* Remote video (full size) */}
              {remoteStreams.size > 0 ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-gray-800">
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">{remoteUserName.charAt(0)}</span>
                    </div>
                    <p className="text-xl">{isAccepted ? 'Connecting...' : 'Waiting for connection...'}</p>
                  </div>
                </div>
              )}

              {/* Local video (picture-in-picture) */}
              <div className="absolute bottom-4 right-4 w-1/4 h-1/4 md:w-1/5 md:h-1/5 rounded-lg overflow-hidden border-2 border-gray-700 shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            </>
          ) : sessionType === 'audio' ? (
            <div className="flex items-center justify-center w-full h-full bg-gray-800">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-indigo-700 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">{remoteUserName.charAt(0)}</span>
                </div>
                <p className="text-xl">{remoteUserName}</p>
                {isAccepted ? (
                  <p className="text-green-400">Call in progress - {formatDuration(duration)}</p>
                ) : (
                  <p className="text-yellow-400">Waiting for connection...</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-gray-800">
              <p className="text-xl">Chat session with {remoteUserName}</p>
            </div>
          )}

          {/* Accept call button (for readers only) */}
          {isReader && !isAccepted && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <button
                onClick={handleAcceptSession}
                className="px-6 py-3 bg-green-600 rounded-full flex items-center space-x-2 hover:bg-green-700 transition-colors"
              >
                <Phone />
                <span>Accept {sessionType} session</span>
              </button>
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div className={`${showChat ? 'flex' : 'hidden'} md:flex md:w-1/3 max-w-md flex-col bg-gray-800 border-l border-gray-700`}>
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold">Chat</h3>
            <button 
              onClick={() => setShowChat(false)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((message: ChatMessage) => (
              <div 
                key={message.id} 
                className={`max-w-3/4 ${
                  message.isSystem 
                    ? 'mx-auto text-center text-gray-400 text-sm py-2' 
                    : message.senderId === userId 
                      ? 'ml-auto bg-indigo-600 rounded-lg p-3 rounded-tr-none' 
                      : 'mr-auto bg-gray-700 rounded-lg p-3 rounded-tl-none'
                }`}
              >
                {!message.isSystem && (
                  <div className="text-xs text-gray-300 mb-1">
                    {message.senderId === userId ? 'You' : message.senderName || remoteUserName}
                  </div>
                )}
                <div>{message.content}</div>
                <div className="text-xs text-right mt-1 text-gray-300">
                  {formatDistance(message.timestamp, new Date(), { addSuffix: true })}
                </div>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 mt-8">
                No messages yet. Start the conversation!
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded-full px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSendMessage}
                className="p-2 bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors"
              >
                <SendHorizontal size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer controls */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 flex justify-center items-center space-x-4">
        {/* Audio toggle */}
        <button
          onClick={toggleAudio}
          className={`p-3 rounded-full ${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'} transition-colors`}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        
        {/* Video toggle (only in video calls) */}
        {sessionType === 'video' && (
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${!isVideoEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'} transition-colors`}
          >
            {!isVideoEnabled ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}
        
        {/* Chat toggle button (mobile only) */}
        <button
          onClick={() => setShowChat(!showChat)}
          className={`md:hidden p-3 rounded-full ${showChat ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} transition-colors`}
        >
          <MessageSquare size={20} />
        </button>
        
        {/* End call button */}
        <button
          onClick={handleEndCall}
          className="p-3 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
        >
          <Phone size={20} className="transform rotate-135" />
        </button>
      </div>
    </div>
  );
} 