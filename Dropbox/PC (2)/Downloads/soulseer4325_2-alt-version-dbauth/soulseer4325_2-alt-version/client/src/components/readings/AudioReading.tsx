import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, DollarSign, Clock, User, Volume2, VolumeX, MessageSquare, X } from 'lucide-react';
import { format } from 'date-fns';
import axios from 'axios';
import { useWebRTC, ChatMessage } from '../../hooks/useWebRTC';

interface AudioReadingProps {
  sessionId: string;
  userId: number;
  userName: string;
  isReader: boolean;
  readerId?: number;
  clientId?: number;
  onEndSession: () => void;
}

export default function AudioReading({
  sessionId,
  userId,
  userName,
  isReader,
  readerId,
  clientId,
  onEndSession
}: AudioReadingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [duration, setDuration] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [audioDeviceId, setAudioDeviceId] = useState<string | null>(null);
  
  const audioContext = useRef<AudioContext | null>(null);
  const audioAnalyser = useRef<AnalyserNode | null>(null);
  const audioData = useRef<Uint8Array | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const audioCanvas = useRef<HTMLCanvasElement>(null);

  // Initialize WebRTC
  const {
    localStream,
    remoteStreams,
    isConnected,
    isMuted,
    connectionState,
    chatMessages,
    toggleAudio,
    sendChatMessage,
    joinSession,
    leaveSession,
    startSession,
    endSession,
    initializeLocalStream,
    changeAudioDevice
  } = useWebRTC({
    sessionType: 'audio',
    userId,
    autoAcceptCalls: true
  });

  // Fetch session details
  useEffect(() => {
    const fetchSessionDetails = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/webrtc/session/${sessionId}`);
        setSessionDetails(response.data);
        
        // Set rate based on session type
        if (response.data.reader?.readerRates?.length > 0) {
          setRate(response.data.reader.readerRates[0].audioRate);
        }
        
        // Start timer if session is active
        if (response.data.status === 'active') {
          // Calculate initial duration if session already started
          if (response.data.startTime) {
            const startTime = new Date(response.data.startTime).getTime();
            const now = new Date().getTime();
            const elapsedSeconds = Math.floor((now - startTime) / 1000);
            setDuration(elapsedSeconds);
          }
        }
        
        // Fetch client balance if not a reader
        if (!isReader) {
          const balanceResponse = await axios.get('/api/webrtc/client/balance');
          setBalance(balanceResponse.data.balance);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching session details:', err);
        setError('Failed to load session details. Please try again later.');
        setIsLoading(false);
      }
    };
    
    fetchSessionDetails();
    
    // Join the session
    const init = async () => {
      await initializeLocalStream();
      await joinSession(sessionId);
    };
    
    init();
    
    // Start duration timer
    const durationInterval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    
    return () => {
      // Clean up
      leaveSession();
      clearInterval(durationInterval);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [sessionId, userId, isReader, onEndSession, initializeLocalStream, joinSession, leaveSession]);

  // Set up audio visualization
  useEffect(() => {
    if (remoteStreams.size > 0 && audioCanvas.current) {
      try {
        // Get the first remote stream
        const firstPeerId = Array.from(remoteStreams.keys())[0];
        const firstPeerStreams = remoteStreams.get(firstPeerId) || [];
        
        if (firstPeerStreams.length > 0) {
          const stream = firstPeerStreams[0];
          
          // Create audio context
          audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioContext.current.createMediaStreamSource(stream);
          audioAnalyser.current = audioContext.current.createAnalyser();
          audioAnalyser.current.fftSize = 256;
          
          source.connect(audioAnalyser.current);
          
          const bufferLength = audioAnalyser.current.frequencyBinCount;
          audioData.current = new Uint8Array(bufferLength);
          
          // Start visualization
          const visualize = () => {
            if (!audioAnalyser.current || !audioData.current || !audioCanvas.current) return;
            
            animationFrameId.current = requestAnimationFrame(visualize);
            
            const canvasCtx = audioCanvas.current.getContext('2d');
            if (!canvasCtx) return;
            
            audioAnalyser.current.getByteFrequencyData(audioData.current);
            
            canvasCtx.clearRect(0, 0, audioCanvas.current.width, audioCanvas.current.height);
            
            const barWidth = (audioCanvas.current.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
              barHeight = audioData.current[i] / 2;
              
              canvasCtx.fillStyle = `rgb(${barHeight + 100}, ${barHeight + 50}, 255)`;
              canvasCtx.fillRect(x, audioCanvas.current.height - barHeight, barWidth, barHeight);
              
              x += barWidth + 1;
            }
          };
          
          visualize();
        }
      } catch (err) {
        console.error('Error setting up audio visualization:', err);
      }
    }
  }, [remoteStreams]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle sending a chat message
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    
    setIsSendingChat(true);
    
    sendChatMessage(chatInput, userName);
    setChatInput('');
    setIsSendingChat(false);
  };

  // Get other party's name
  const getOtherPartyName = (): string => {
    if (isReader) {
      return sessionDetails?.client?.fullName || 'Client';
    } else {
      return sessionDetails?.reader?.fullName || 'Reader';
    }
  };

  // Handle ending the session
  const handleEndSession = () => {
    endSession();
    onEndSession();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
      {/* Main audio interface */}
      <div className={`flex-1 flex flex-col ${showChat ? 'hidden md:flex' : ''}`}>
        {/* Header */}
        <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center">
            <div className="bg-indigo-600 rounded-full p-2 mr-3">
              <Phone size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-medium text-white">Audio Reading with {getOtherPartyName()}</h2>
              <div className="text-sm text-gray-400">
                {sessionDetails?.isPayPerMinute ? 'Pay-per-minute' : 'Flat rate'} session
              </div>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="bg-gray-700 px-3 py-1 rounded-full flex items-center mr-3">
              <Clock size={16} className="text-indigo-400 mr-1" />
              <span className="text-white font-medium">{formatDuration(duration)}</span>
            </div>
            
            {!isReader && (
              <div className="bg-gray-700 px-3 py-1 rounded-full flex items-center mr-3">
                <DollarSign size={16} className="text-green-400 mr-1" />
                <span className="text-white">${balance.toFixed(2)}</span>
              </div>
            )}
            
            {!isReader && sessionDetails?.isPayPerMinute && (
              <div className="bg-gray-700 px-3 py-1 rounded-full flex items-center mr-3">
                <DollarSign size={16} className="text-yellow-400 mr-1" />
                <span className="text-white">${rate}/min</span>
              </div>
            )}
            
            <button
              onClick={() => setShowChat(!showChat)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 md:hidden"
              title="Toggle Chat"
            >
              <MessageSquare size={20} />
            </button>
          </div>
        </div>
        
        {/* Audio call content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center mb-8 overflow-hidden">
            {sessionDetails?.isReader ? (
              sessionDetails?.client?.profileImage ? (
                <img 
                  src={sessionDetails.client.profileImage} 
                  alt={sessionDetails.client.fullName} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="text-4xl font-bold text-gray-500">
                  {getOtherPartyName().charAt(0)}
                </div>
              )
            ) : (
              sessionDetails?.reader?.profileImage ? (
                <img 
                  src={sessionDetails.reader.profileImage} 
                  alt={sessionDetails.reader.fullName} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="text-4xl font-bold text-gray-500">
                  {getOtherPartyName().charAt(0)}
                </div>
              )
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">{getOtherPartyName()}</h2>
          <div className="text-gray-400 mb-8">{connectionState === 'connected' ? 'Connected' : 'Connecting...'}</div>
          
          {/* Audio visualizer */}
          <div className="w-full max-w-md h-24 mb-8">
            <canvas 
              ref={audioCanvas} 
              width={600} 
              height={100} 
              className="w-full h-full bg-gray-800 rounded-lg"
            />
          </div>
          
          {/* Control buttons */}
          <div className="flex justify-center space-x-6">
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-full ${isMuted ? 'bg-red-600' : 'bg-indigo-600'}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
            </button>
            
            <button
              onClick={handleEndSession}
              className="p-4 bg-red-600 rounded-full"
              title="End Call"
            >
              <Phone size={24} className="text-white transform rotate-135" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Chat panel */}
      {showChat && (
        <div className="w-full md:w-1/3 max-w-md border-l border-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-medium text-white">Chat</h3>
            <button 
              onClick={() => setShowChat(false)}
              className="text-gray-400 hover:text-white md:hidden"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No messages yet
              </div>
            ) : (
              <div className="space-y-4">
                {chatMessages.map((message: ChatMessage) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === userId ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.senderId === userId
                          ? 'bg-indigo-600 rounded-tr-none'
                          : 'bg-gray-700 rounded-tl-none'
                      }`}
                    >
                      <div className="text-sm text-gray-300 mb-1">
                        {message.senderId === userId ? 'You' : message.senderName || getOtherPartyName()}
                      </div>
                      <div className="text-white whitespace-pre-wrap">{message.content}</div>
                      <div className="text-xs text-right mt-1 text-gray-400">
                        {format(new Date(message.timestamp), 'h:mm a')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded-full px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              />
              <button
                onClick={handleSendChat}
                disabled={isSendingChat || !chatInput.trim()}
                className={`p-2 rounded-full ${
                  isSendingChat || !chatInput.trim()
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 