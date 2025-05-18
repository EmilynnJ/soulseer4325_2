import React, { useState, useEffect, useRef } from 'react';
import { Send, Clock, User, DollarSign, Phone, MessageSquare, X } from 'lucide-react';
import { format } from 'date-fns';
import axios from 'axios';

interface ChatReadingProps {
  sessionId: string;
  userId: number;
  userName: string;
  isReader: boolean;
  readerId?: number;
  clientId?: number;
  onEndSession: () => void;
}

interface ChatMessage {
  id: string;
  senderId: number;
  content: string;
  timestamp: Date;
  senderName: string;
}

export default function ChatReading({
  sessionId,
  userId,
  userName,
  isReader,
  readerId,
  clientId,
  onEndSession
}: ChatReadingProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [duration, setDuration] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch session details
  useEffect(() => {
    const fetchSessionDetails = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/webrtc/session/${sessionId}`);
        setSessionDetails(response.data);
        
        // Set rate based on session type
        if (response.data.reader?.readerRates?.length > 0) {
          setRate(response.data.reader.readerRates[0].chatRate);
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
    
    // Initialize WebSocket for real-time messaging
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/rtc-signaling`;
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      // Join the session
      socket.send(JSON.stringify({
        type: 'join',
        data: {
          userId,
          role: isReader ? 'reader' : 'client',
          sessionId,
          peerId: userId
        },
        sessionId
      }));
      
      // Send ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
      
      return () => clearInterval(pingInterval);
    };
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'chat-message') {
        // Add message to the list
        const chatMessage: ChatMessage = {
          id: message.data.id || uuidv4(),
          senderId: message.senderId,
          content: message.data.content,
          timestamp: new Date(message.data.timestamp || new Date()),
          senderName: message.data.senderName || 'User'
        };
        
        setMessages(prev => [...prev, chatMessage]);
      } else if (message.type === 'session-started') {
        // Session has started, update UI
        setDuration(0);
      } else if (message.type === 'session-ended') {
        // Session has ended, redirect
        onEndSession();
      } else if (message.type === 'notification' && message.data.type === 'balance-update') {
        // Update balance for client
        if (!isReader && message.data.currentBalance !== undefined) {
          setBalance(message.data.currentBalance);
        }
      }
    };
    
    // Start duration timer
    const durationInterval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    
    return () => {
      // Clean up
      socket.close();
      clearInterval(durationInterval);
    };
  }, [sessionId, userId, isReader, onEndSession]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send a message
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    setIsSending(true);
    
    // Create a new message object
    const message = {
      id: uuidv4(),
      senderId: userId,
      content: newMessage,
      timestamp: new Date(),
      senderName: userName
    };
    
    // Add to local state
    setMessages(prev => [...prev, message]);
    
    // Send via WebSocket
    if (window.WebSocket) {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/rtc-signaling`;
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: 'chat-message',
          data: {
            content: newMessage,
            senderName: userName,
            timestamp: new Date().toISOString()
          },
          sessionId,
          senderId: userId
        }));
        
        // Close socket after sending message
        socket.close();
        setIsSending(false);
        setNewMessage('');
      };
      
      socket.onerror = () => {
        setError('Failed to send message. Please try again.');
        setIsSending(false);
      };
    } else {
      // Fallback to HTTP if WebSockets not supported
      axios.post(`/api/webrtc/session/${sessionId}/message`, {
        content: newMessage,
        senderName: userName
      })
        .then(() => {
          setIsSending(false);
          setNewMessage('');
        })
        .catch(err => {
          console.error('Error sending message:', err);
          setError('Failed to send message. Please try again.');
          setIsSending(false);
        });
    }
  };

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // End the session
  const handleEndSession = async () => {
    try {
      // Send end session message via WebSocket
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/rtc-signaling`;
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: 'end-session',
          data: {},
          sessionId
        }));
        
        // Close socket after sending message
        socket.close();
        onEndSession();
      };
    } catch (err) {
      console.error('Error ending session:', err);
      setError('Failed to end session. Please try again.');
    }
  };

  // Get other party's name
  const getOtherPartyName = (): string => {
    if (isReader) {
      return sessionDetails?.client?.fullName || 'Client';
    } else {
      return sessionDetails?.reader?.fullName || 'Reader';
    }
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
    <div className="h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center">
          <div className="bg-indigo-600 rounded-full p-2 mr-3">
            <MessageSquare size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-medium text-white">Chat Reading with {getOtherPartyName()}</h2>
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
        </div>
      </div>
      
      {/* Chat area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 p-4 overflow-y-auto flex flex-col space-y-4"
      >
        {/* Welcome message */}
        <div className="bg-gray-800 p-3 rounded-lg text-center">
          <p className="text-gray-300">
            {sessionDetails?.status === 'active'
              ? 'Your chat reading session has started. Messages sent here are not saved after the session ends.'
              : 'Waiting for the session to start...'}
          </p>
        </div>
        
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.senderId === userId ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg p-3 ${
                message.senderId === userId
                  ? 'bg-indigo-600 rounded-tr-none'
                  : 'bg-gray-700 rounded-tl-none'
              }`}
            >
              <div className="text-sm text-gray-300 mb-1">
                {message.senderId === userId ? 'You' : message.senderName}
              </div>
              <div className="text-white whitespace-pre-wrap">{message.content}</div>
              <div className="text-xs text-right mt-1 text-gray-400">
                {format(new Date(message.timestamp), 'h:mm a')}
              </div>
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        {error && (
          <div className="mb-3 p-2 bg-red-900 text-white text-sm rounded-lg">
            {error}
          </div>
        )}
        
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
          </div>
          
          <div className="flex flex-col space-y-2">
            <button
              onClick={handleSendMessage}
              disabled={isSending || !newMessage.trim()}
              className={`p-3 rounded-lg ${
                isSending || !newMessage.trim()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <Send size={20} />
              )}
            </button>
            
            <button
              onClick={handleEndSession}
              className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              title="End Session"
            >
              <Phone size={20} className="transform rotate-135" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 