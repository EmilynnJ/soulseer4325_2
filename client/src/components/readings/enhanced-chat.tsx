import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';

interface ChatMessage {
  id?: string;
  readingId: number;
  senderId: number;
  senderName?: string;
  message: string;
  timestamp: number;
}

interface EnhancedChatProps {
  readingId: number;
  userId: number;
  recipientId: number;
  recipientName: string;
}

export default function EnhancedChat({
  readingId,
  userId,
  recipientId,
  recipientName
}: EnhancedChatProps) {
  const { socket, connected } = useWebSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch previous messages on component mount
  useEffect(() => {
    if (!readingId || !connected) return;

    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/readings/${readingId}/messages`);
        
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // Listen for new messages
    socket.on('chat_message', handleNewMessage);

    return () => {
      socket.off('chat_message', handleNewMessage);
    };
  }, [readingId, connected]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewMessage = (message: ChatMessage) => {
    if (message.readingId === readingId) {
      setMessages(prev => [...prev, message]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !connected || !user) return;

    const newMessage: ChatMessage = {
      readingId,
      senderId: userId,
      senderName: user.fullName || user.username,
      message: inputMessage.trim(),
      timestamp: Date.now()
    };

    // Emit message to server
    socket.emit('chat_message', newMessage);

    // Add message to local state (optimistic update)
    setMessages(prev => [...prev, newMessage]);
    
    // Clear input
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages area */}
      <ScrollArea className="flex-grow mb-4 p-2">
        {messages.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isSender = msg.senderId === userId;
              const senderName = isSender ? 'You' : (msg.senderName || recipientName);
              
              return (
                <div
                  key={msg.id || index}
                  className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex ${isSender ? 'flex-row-reverse' : 'flex-row'} items-start gap-2 max-w-[80%]`}>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{senderName}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.timestamp), 'h:mm a')}
                        </span>
                      </div>
                      
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          isSender
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>
      
      {/* Input area */}
      <div className="flex gap-2">
        <Input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your message..."
          className="flex-grow"
          disabled={!connected}
        />
        <Button
          onClick={sendMessage}
          disabled={!inputMessage.trim() || !connected}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}