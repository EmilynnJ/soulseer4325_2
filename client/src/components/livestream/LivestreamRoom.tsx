import React, { useState, useEffect, useRef } from 'react';
import { Gift, Heart, Users, MessageSquare, DollarSign, Send, X } from 'lucide-react';
import axios from 'axios';
import { useParams, useLocation } from 'wouter';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

// Types
interface LivestreamProps {
  userId: number;
  userName: string;
  isStreamer: boolean;
}

interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: Date;
  isGift?: boolean;
  giftAmount?: number;
  giftType?: string;
}

interface GiftOption {
  id: string;
  name: string;
  icon: string;
  amount: number;
}

// Gift options
const giftOptions: GiftOption[] = [
  { id: 'heart', name: 'Heart', icon: '❤️', amount: 1 },
  { id: 'star', name: 'Star', icon: '⭐', amount: 5 },
  { id: 'fire', name: 'Fire', icon: '🔥', amount: 10 },
  { id: 'diamond', name: 'Diamond', icon: '💎', amount: 20 },
  { id: 'crown', name: 'Crown', icon: '👑', amount: 50 },
  { id: 'rocket', name: 'Rocket', icon: '🚀', amount: 100 }
];

export default function LivestreamRoom({ userId, userName, isStreamer }: LivestreamProps) {
  const { streamId } = useParams<{ streamId: string }>();
  const [, navigate] = useLocation();
  
  // Stream states
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  
  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  
  // Gift states
  const [showGiftPanel, setShowGiftPanel] = useState<boolean>(false);
  const [selectedGift, setSelectedGift] = useState<GiftOption | null>(null);
  const [giftMessage, setGiftMessage] = useState<string>('');
  const [balance, setBalance] = useState<number>(0);
  const [lastGift, setLastGift] = useState<{userId: number, giftType: string, amount: number} | null>(null);
  
  // Animation states
  const [giftAnimation, setGiftAnimation] = useState<{gift: GiftOption, visible: boolean} | null>(null);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  // Initialize the livestream
  useEffect(() => {
    const initializeLivestream = async () => {
      try {
        // Fetch stream details
        const response = await axios.get(`/api/webrtc/livestream/${streamId}`);
        setStreamInfo(response.data);
        
        // Initialize WebSocket for signaling and chat
        initializeSocket();
        
        // If user is the streamer, initialize the media stream
        if (isStreamer) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          
          // Start broadcasting
          startBroadcasting(stream);
        }
        
        // If user is a viewer, initialize for viewing
        if (!isStreamer) {
          // Fetch user balance
          try {
            const balanceResponse = await axios.get('/api/webrtc/client/balance');
            setBalance(balanceResponse.data.balance);
          } catch (err) {
            console.error('Error fetching balance:', err);
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing livestream:', err);
        setError('Failed to load the livestream. Please try again later.');
        setIsLoading(false);
      }
    };
    
    initializeLivestream();
    
    // Cleanup function
    return () => {
      // Close WebSocket
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      // Stop all media tracks
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [streamId, isStreamer]);
  
  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  // Handle gift animations
  useEffect(() => {
    if (lastGift) {
      const gift = giftOptions.find(g => g.id === lastGift.giftType);
      if (gift) {
        setGiftAnimation({ gift, visible: true });
        
        // Hide animation after 3 seconds
        const timer = setTimeout(() => {
          setGiftAnimation(prev => prev ? { ...prev, visible: false } : null);
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [lastGift]);
  
  // Initialize WebSocket for signaling and chat
  const initializeSocket = () => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/rtc-signaling`;
    socketRef.current = new WebSocket(wsUrl);
    
    socketRef.current.onopen = () => {
      console.log('WebSocket connection established');
      
      // Join the stream
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'join-stream',
          data: {
            streamId,
            userId,
            userName,
            isStreamer
          }
        }));
      }
      
      // Send ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
      
      return () => clearInterval(pingInterval);
    };
    
    socketRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'viewer-count':
            setViewerCount(message.data.count);
            break;
            
          case 'chat-message':
            // Add message to chat
            setChatMessages(prev => [
              ...prev,
              {
                id: uuidv4(),
                senderId: message.senderId,
                senderName: message.data.senderName,
                content: message.data.content,
                timestamp: new Date()
              }
            ]);
            break;
            
          case 'gift':
            // Add gift message to chat
            setChatMessages(prev => [
              ...prev,
              {
                id: uuidv4(),
                senderId: message.data.senderId,
                senderName: message.data.senderName,
                content: message.data.message || `Sent a ${message.data.giftType}!`,
                timestamp: new Date(),
                isGift: true,
                giftAmount: message.data.amount,
                giftType: message.data.giftType
              }
            ]);
            
            // Set last gift for animation
            setLastGift({
              userId: message.data.senderId,
              giftType: message.data.giftType,
              amount: message.data.amount
            });
            
            // Update total revenue for streamer
            if (isStreamer) {
              setTotalRevenue(prev => prev + message.data.amount);
            }
            break;
            
          case 'offer':
            if (!isStreamer) {
              handleOffer(message.data);
            }
            break;
            
          case 'ice-candidate':
            handleIceCandidate(message.data);
            break;
            
          case 'stream-ended':
            // Handle stream end
            setChatMessages(prev => [
              ...prev,
              {
                id: uuidv4(),
                senderId: 0,
                senderName: 'System',
                content: 'The livestream has ended.',
                timestamp: new Date()
              }
            ]);
            
            // Redirect after 5 seconds
            setTimeout(() => {
              navigate('/');
            }, 5000);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error. Please try refreshing the page.');
    };
    
    socketRef.current.onclose = () => {
      console.log('WebSocket connection closed');
    };
  };
  
  // Start broadcasting (for streamer)
  const startBroadcasting = async (stream: MediaStream) => {
    try {
      // Initialize RTCPeerConnection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      
      peerConnectionRef.current = new RTCPeerConnection(configuration);
      
      // Add all tracks from stream to the peer connection
      stream.getTracks().forEach(track => {
        peerConnectionRef.current?.addTrack(track, stream);
      });
      
      // Set up ICE candidate event handler
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            data: event.candidate,
            streamId
          }));
        }
      };
      
      // Create and send offer to signaling server
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'offer',
          data: offer,
          streamId
        }));
      }
      
      // Update stream status to 'live' on the server
      await axios.post(`/api/webrtc/livestream/${streamId}/start`);
      
    } catch (error) {
      console.error('Error starting broadcast:', error);
      setError('Failed to start broadcasting. Please try again.');
    }
  };
  
  // Handle WebRTC offer (for viewers)
  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      // Initialize RTCPeerConnection if not already done
      if (!peerConnectionRef.current) {
        const configuration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        };
        
        peerConnectionRef.current = new RTCPeerConnection(configuration);
        
        // Set up track event handler
        peerConnectionRef.current.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };
        
        // Set up ICE candidate event handler
        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.send(JSON.stringify({
              type: 'ice-candidate',
              data: event.candidate,
              streamId
            }));
          }
        };
      }
      
      // Set remote description (the offer)
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Create and send answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'answer',
          data: answer,
          streamId
        }));
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      setError('Failed to connect to livestream. Please try refreshing the page.');
    }
  };
  
  // Handle ICE candidate
  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };
  
  // End the stream (for streamer)
  const endStream = async () => {
    try {
      await axios.post(`/api/webrtc/livestream/${streamId}/end`);
      
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'stream-ended',
          streamId
        }));
      }
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Error ending stream:', error);
      setError('Failed to end stream. Please try again.');
    }
  };
  
  // Send a chat message
  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: 'chat-message',
        data: {
          content: chatInput,
          senderName: userName
        },
        streamId,
        senderId: userId
      }));
      
      // Add message to local chat
      setChatMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          senderId: userId,
          senderName: userName,
          content: chatInput,
          timestamp: new Date()
        }
      ]);
      
      // Clear input
      setChatInput('');
    }
  };
  
  // Send a gift
  const sendGift = async () => {
    if (!selectedGift) return;
    
    // Check if user has enough balance
    if (balance < selectedGift.amount) {
      setError('Insufficient balance to send this gift. Please add funds.');
      return;
    }
    
    try {
      // Send gift to server
      await axios.post(`/api/webrtc/livestream/${streamId}/gift`, {
        senderId: userId,
        senderName: userName,
        giftType: selectedGift.id,
        amount: selectedGift.amount,
        message: giftMessage
      });
      
      // Update user balance
      setBalance(prev => prev - selectedGift.amount);
      
      // Send gift message via WebSocket
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'gift',
          data: {
            senderId: userId,
            senderName: userName,
            giftType: selectedGift.id,
            amount: selectedGift.amount,
            message: giftMessage
          },
          streamId
        }));
      }
      
      // Reset gift panel
      setShowGiftPanel(false);
      setSelectedGift(null);
      setGiftMessage('');
    } catch (error) {
      console.error('Error sending gift:', error);
      setError('Failed to send gift. Please try again.');
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-xl">Loading livestream...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-center max-w-md p-6 bg-gray-800 rounded-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl mb-4">Something went wrong</h2>
          <p className="mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg">{streamInfo?.title || 'Livestream'}</span>
          <span className="text-sm text-gray-400">with {streamInfo?.reader?.fullName || 'Reader'}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm">
            <Users size={16} className="mr-1 text-indigo-400" />
            <span>{viewerCount}</span>
          </div>
          {isStreamer && (
            <div className="flex items-center text-sm">
              <DollarSign size={16} className="mr-1 text-green-400" />
              <span>${totalRevenue.toFixed(2)}</span>
            </div>
          )}
          {!isStreamer && (
            <div className="flex items-center text-sm">
              <DollarSign size={16} className="mr-1 text-green-400" />
              <span>Balance: ${balance.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video container */}
        <div className={`flex-1 relative ${isChatOpen && 'hidden md:flex'}`}>
          {isStreamer ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Gift animation overlay */}
          {giftAnimation && giftAnimation.visible && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="animate-bounce flex flex-col items-center">
                <div className="text-7xl">{giftAnimation.gift.icon}</div>
                <div className="text-2xl font-bold text-indigo-400 mt-2">
                  ${giftAnimation.gift.amount}
                </div>
              </div>
            </div>
          )}
          
          {/* Streamer controls */}
          {isStreamer && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4">
              <button
                onClick={endStream}
                className="px-6 py-3 bg-red-600 rounded-full flex items-center space-x-2 hover:bg-red-700 transition-colors"
              >
                <span>End Stream</span>
              </button>
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div className={`${isChatOpen ? 'flex' : 'hidden'} md:flex md:w-1/3 max-w-md flex-col bg-gray-800 border-l border-gray-700`}>
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold">Live Chat</h3>
            <div className="flex items-center space-x-2">
              {!isStreamer && (
                <button
                  onClick={() => setShowGiftPanel(true)}
                  className="p-2 text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Gift size={20} />
                </button>
              )}
              <button
                onClick={() => setIsChatOpen(false)}
                className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          {/* Chat messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {chatMessages.map((message) => (
              <div 
                key={message.id}
                className={`max-w-[85%] ${message.isGift ? 'mx-auto bg-indigo-900 border border-indigo-700' : message.senderId === userId ? 'ml-auto bg-indigo-600' : 'mr-auto bg-gray-700'} rounded-lg p-3 ${message.senderId === userId ? 'rounded-tr-none' : 'rounded-tl-none'}`}
              >
                <div className="flex items-center mb-1">
                  <span className={`text-xs font-medium ${message.isGift ? 'text-indigo-300' : 'text-gray-300'}`}>
                    {message.senderId === userId ? 'You' : message.senderName}
                  </span>
                  {message.isGift && (
                    <span className="ml-2 text-xs bg-indigo-800 px-2 py-0.5 rounded-full text-indigo-200">
                      ${message.giftAmount} Gift
                    </span>
                  )}
                </div>
                
                {message.isGift && message.giftType && (
                  <div className="text-center text-2xl my-1">
                    {giftOptions.find(g => g.id === message.giftType)?.icon || '🎁'}
                  </div>
                )}
                
                <div className={message.isGift ? 'text-center' : ''}>{message.content}</div>
                
                <div className="text-right text-xs text-gray-400 mt-1">
                  {format(message.timestamp, 'h:mm a')}
                </div>
              </div>
            ))}
            
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 mt-8">
                No messages yet. Be the first to chat!
              </div>
            )}
          </div>
          
          {/* Chat input */}
          <div className="p-3 border-t border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded-full px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={sendChatMessage}
                className="p-2 bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile chat toggle */}
      <div className="md:hidden fixed bottom-4 right-4 z-10">
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="p-3 bg-indigo-600 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
          >
            <MessageSquare size={24} />
          </button>
        )}
      </div>

      {/* Gift panel modal */}
      {showGiftPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Send a Gift</h3>
              <button
                onClick={() => setShowGiftPanel(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="text-sm text-gray-400 mb-2">Choose a gift:</div>
              <div className="grid grid-cols-3 gap-3">
                {giftOptions.map((gift) => (
                  <button
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    className={`p-3 rounded-lg flex flex-col items-center ${selectedGift?.id === gift.id ? 'bg-indigo-600 border-2 border-indigo-400' : 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'} transition-colors`}
                  >
                    <span className="text-2xl mb-1">{gift.icon}</span>
                    <span className="text-sm">{gift.name}</span>
                    <span className="text-xs text-gray-300">${gift.amount}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">Add a message (optional):</div>
              <input
                type="text"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="Your message here..."
                maxLength={100}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400">Your balance:</span>
              <span className={`font-bold ${balance >= (selectedGift?.amount || 0) ? 'text-green-400' : 'text-red-400'}`}>
                ${balance.toFixed(2)}
              </span>
            </div>
            
            {selectedGift && balance < selectedGift.amount && (
              <div className="text-red-400 text-sm mb-4">
                Insufficient balance. <a href="/add-funds" className="underline">Add funds</a>
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowGiftPanel(false)}
                className="px-4 py-2 border border-gray-600 rounded-lg mr-2 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendGift}
                disabled={!selectedGift || (selectedGift && balance < selectedGift.amount)}
                className={`px-4 py-2 rounded-lg ${!selectedGift || (selectedGift && balance < selectedGift.amount) ? 'bg-gray-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} transition-colors`}
              >
                Send Gift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 