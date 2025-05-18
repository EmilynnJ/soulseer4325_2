import React, { useState, useEffect, useRef } from 'react';
import { Send, DollarSign, MessageSquare, User, Clock, Edit, X, Check, Lock } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';

interface PremiumMessagingProps {
  userId: number;
  isReader: boolean;
  recipientId: number;
  recipientName: string;
  recipientImage?: string;
}

interface Message {
  id: number;
  senderId: number;
  content: string;
  timestamp: string;
  isPaid: boolean;
  price?: number;
  isRead: boolean;
}

export default function PremiumMessaging({
  userId,
  isReader,
  recipientId,
  recipientName,
  recipientImage
}: PremiumMessagingProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(0);
  const [isPricedMessage, setIsPricedMessage] = useState(false);
  const [messagePrice, setMessagePrice] = useState(0);
  const [showPriceConfirmation, setShowPriceConfirmation] = useState(false);
  const [showPayConfirmation, setShowPayConfirmation] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        const response = await axios.get(`/api/messages/${isReader ? recipientId : userId}/${isReader ? userId : recipientId}`);
        setMessages(response.data);
        
        // If client, also fetch balance
        if (!isReader) {
          const balanceResponse = await axios.get('/api/webrtc/client/balance');
          setBalance(balanceResponse.data.balance);
        }
        
        // Mark messages as read
        if (response.data.length > 0) {
          await axios.post('/api/messages/mark-read', {
            userId,
            recipientId
          });
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError('Failed to load messages. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMessages();
    
    // Set up polling for new messages
    const interval = setInterval(fetchMessages, 15000); // Poll every 15 seconds
    
    return () => clearInterval(interval);
  }, [userId, recipientId, isReader]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setIsSending(true);
    setError('');
    
    try {
      const messageData = {
        senderId: userId,
        receiverId: recipientId,
        content: newMessage,
        isPaid: isReader && isPricedMessage,
        price: isReader && isPricedMessage ? messagePrice : undefined
      };
      
      const response = await axios.post('/api/messages/send', messageData);
      
      // Add the new message to the list
      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
      
      // Reset pricing settings if applicable
      if (isReader) {
        setIsPricedMessage(false);
        setMessagePrice(0);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle paying for a message
  const handlePayForMessage = async (messageId: number, price: number) => {
    if (balance < price) {
      setError('Insufficient balance. Please add funds to your account.');
      return;
    }
    
    try {
      await axios.post(`/api/messages/${messageId}/pay`);
      
      // Update message in the list
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, isPaid: true } : msg
        )
      );
      
      // Update balance
      setBalance(prev => prev - price);
      
      // Close confirmation dialog
      setShowPayConfirmation(null);
    } catch (err) {
      console.error('Error paying for message:', err);
      setError('Failed to process payment. Please try again.');
    }
  };

  // Handle confirming message price
  const handleConfirmPrice = () => {
    if (messagePrice <= 0) {
      setError('Please enter a valid price greater than 0.');
      return;
    }
    
    setShowPriceConfirmation(false);
    setIsPricedMessage(true);
  };

  // Render message item
  const renderMessage = (message: Message) => {
    const isOwnMessage = message.senderId === userId;
    const isPendingPayment = !isOwnMessage && message.isPaid && !message.isRead;
    
    return (
      <div 
        key={message.id}
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div 
          className={`max-w-3/4 rounded-lg p-3 ${
            isOwnMessage 
              ? 'bg-indigo-600 rounded-tr-none' 
              : 'bg-gray-700 rounded-tl-none'
          }`}
        >
          {!isOwnMessage && !isReader && message.isPaid && !message.isRead && (
            <div className="mb-2 flex items-center justify-between bg-gray-800 p-2 rounded">
              <div className="flex items-center text-yellow-400">
                <Lock size={16} className="mr-1" />
                <span className="text-sm font-medium">Paid Message</span>
              </div>
              <div className="text-sm font-medium text-green-400 flex items-center">
                <DollarSign size={14} className="mr-0.5" />
                {message.price?.toFixed(2)}
              </div>
            </div>
          )}
          
          {(!message.isPaid || isOwnMessage || (message.isPaid && message.isRead)) && (
            <div className="text-white">{message.content}</div>
          )}
          
          {!isOwnMessage && message.isPaid && !message.isRead && !isReader && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => setShowPayConfirmation(message.id)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm flex items-center"
              >
                <DollarSign size={14} className="mr-1" />
                Unlock Message
              </button>
            </div>
          )}
          
          <div className="text-xs text-right mt-1 text-gray-300">
            {format(new Date(message.timestamp), 'h:mm a, MMM d')}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">
          {recipientImage ? (
            <img src={recipientImage} alt={recipientName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <User size={20} />
          )}
        </div>
        <div>
          <h2 className="font-medium text-white">{recipientName}</h2>
          <div className="text-sm text-gray-400">
            {isReader ? 'Client' : 'Reader'}
          </div>
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Input area */}
      <div className="p-4 border-t border-gray-700">
        {error && (
          <div className="mb-3 p-2 bg-red-900 text-white text-sm rounded">
            {error}
          </div>
        )}
        
        {isReader && isPricedMessage && (
          <div className="mb-3 p-2 bg-yellow-800 rounded flex items-center justify-between">
            <div className="flex items-center">
              <DollarSign size={16} className="text-yellow-400 mr-1" />
              <span className="text-yellow-100 text-sm font-medium">
                This is a paid message (${messagePrice.toFixed(2)})
              </span>
            </div>
            <button
              onClick={() => setIsPricedMessage(false)}
              className="text-yellow-200 hover:text-yellow-100"
            >
              <X size={16} />
            </button>
          </div>
        )}
        
        {!isReader && (
          <div className="mb-3 flex justify-between items-center">
            <div className="text-sm text-gray-400 flex items-center">
              <Clock size={14} className="mr-1" />
              <span>Response time may vary</span>
            </div>
            <div className="text-sm flex items-center text-green-400">
              <DollarSign size={14} className="mr-1" />
              <span>Balance: ${balance.toFixed(2)}</span>
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          {isReader && !isPricedMessage && (
            <button
              onClick={() => setShowPriceConfirmation(true)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-2 rounded-full"
              title="Set message price"
            >
              <DollarSign size={20} />
            </button>
          )}
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded-full px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          
          <button
            onClick={handleSendMessage}
            disabled={isSending || !newMessage.trim()}
            className={`p-2 rounded-full ${
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
        </div>
      </div>
      
      {/* Price setting modal */}
      {showPriceConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Set Message Price</h3>
            
            <p className="text-gray-300 mb-4">
              Your client will need to pay this amount to view this message. You'll receive 70% of this amount.
            </p>
            
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Price</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign size={16} className="text-gray-400" />
                </div>
                <input
                  type="number"
                  value={messagePrice || ''}
                  onChange={(e) => setMessagePrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  min="0.01"
                  step="0.01"
                  className="bg-gray-700 border border-gray-600 text-white rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPriceConfirmation(false)}
                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPrice}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
              >
                <Check size={18} className="mr-2" />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Payment confirmation modal */}
      {showPayConfirmation !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Unlock Message</h3>
            
            {balance < (messages.find(m => m.id === showPayConfirmation)?.price || 0) ? (
              <>
                <div className="p-3 bg-red-900 rounded-lg mb-4">
                  <p className="text-white font-medium">Insufficient Balance</p>
                  <p className="text-sm text-red-200 mt-1">
                    You don't have enough funds to unlock this message.
                  </p>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-300">Your Balance:</span>
                  <span className="text-red-400 font-medium">${balance.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-300">Message Price:</span>
                  <span className="text-white font-medium">
                    ${messages.find(m => m.id === showPayConfirmation)?.price?.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowPayConfirmation(null)}
                    className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => window.location.href = '/add-funds'}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                  >
                    <DollarSign size={18} className="mr-2" />
                    Add Funds
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-300 mb-4">
                  Unlock this message from {recipientName} by paying the required amount.
                </p>
                
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-300">Message Price:</span>
                  <span className="text-green-400 font-medium">
                    ${messages.find(m => m.id === showPayConfirmation)?.price?.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-300">Your Balance After:</span>
                  <span className="text-white font-medium">
                    ${(balance - (messages.find(m => m.id === showPayConfirmation)?.price || 0)).toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowPayConfirmation(null)}
                    className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handlePayForMessage(
                      showPayConfirmation,
                      messages.find(m => m.id === showPayConfirmation)?.price || 0
                    )}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
                  >
                    <Lock size={18} className="mr-2" />
                    Unlock Message
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 