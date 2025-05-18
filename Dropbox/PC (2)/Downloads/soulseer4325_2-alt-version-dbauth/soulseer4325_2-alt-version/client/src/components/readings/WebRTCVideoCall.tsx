import React, { useEffect, useRef, useState } from 'react';
import { webRTCClient } from '@/lib/webrtc-client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface WebRTCVideoCallProps {
  readingId: number;
  readerId: number;
  clientId: number;
  onCallEnded?: () => void;
  readingType?: 'video' | 'voice';
  pricePerMinute: number;
}

export default function WebRTCVideoCall({
  readingId,
  readerId,
  clientId,
  onCallEnded,
  readingType = 'video',
  pricePerMinute
}: WebRTCVideoCallProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { socket, connected } = useWebSocket();
  
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(readingType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentCost, setCurrentCost] = useState(0);
  const [remainingBalance, setRemainingBalance] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const isReader = user?.id === readerId;
  const isClient = user?.id === clientId;
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Format cost as $XX.XX
  const formatCost = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  useEffect(() => {
    if (!user || !connected) return;
    
    const setupCall = async () => {
      try {
        setIsConnecting(true);
        
        // Join the reading room
        await webRTCClient.joinReading(
          readingId,
          user.id,
          isReader ? 'reader' : 'client'
        );
        
        // Start local stream
        const localStream = await webRTCClient.startLocalStream(
          readingType === 'video',
          true
        );
        
        // Display local stream
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
        }
        
        // Handle remote stream
        webRTCClient.onRemoteStream((stream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        });
        
        // Handle connection state changes
        webRTCClient.onConnectionStateChange((state) => {
          if (state === 'connected') {
            setIsConnected(true);
            setIsConnecting(false);
            
            // Start billing if client
            if (isClient) {
              socket.emit('start_billing', { readingId });
            }
          } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            setIsConnected(false);
          }
        });
        
        // Initiate call if reader, otherwise wait for offer
        if (isReader) {
          await webRTCClient.initiateCall();
        } else {
          await webRTCClient.acceptCall();
        }
      } catch (error) {
        console.error('Error setting up call:', error);
        toast({
          title: 'Connection Error',
          description: 'Failed to establish connection. Please try again.',
          variant: 'destructive'
        });
        setIsConnecting(false);
        onCallEnded?.();
      }
    };
    
    setupCall();
    
    // Set up socket event listeners for billing
    socket.on('billing_started', handleBillingStarted);
    socket.on('billing_tick', handleBillingTick);
    socket.on('billing_paused', handleBillingPaused);
    socket.on('billing_ended', handleBillingEnded);
    socket.on('low_balance', handleLowBalance);
    socket.on('call_ended', handleCallEnded);
    
    return () => {
      socket.off('billing_started', handleBillingStarted);
      socket.off('billing_tick', handleBillingTick);
      socket.off('billing_paused', handleBillingPaused);
      socket.off('billing_ended', handleBillingEnded);
      socket.off('low_balance', handleLowBalance);
      socket.off('call_ended', handleCallEnded);
      
      // End call and clean up
      webRTCClient.endCall();
    };
  }, [user, connected, readingId]);
  
  const handleBillingStarted = (data: any) => {
    if (data.readingId !== readingId) return;
    setElapsedSeconds(0);
    setCurrentCost(0);
  };
  
  const handleBillingTick = (data: any) => {
    if (data.readingId !== readingId) return;
    setElapsedSeconds(data.elapsedSeconds);
    setCurrentCost(data.currentCost);
  };
  
  const handleBillingPaused = (data: any) => {
    if (data.readingId !== readingId) return;
    setElapsedSeconds(data.elapsedSeconds);
    
    toast({
      title: 'Session Paused',
      description: `Reason: ${data.reason}`,
      variant: 'default'
    });
  };
  
  const handleBillingEnded = (data: any) => {
    if (data.readingId !== readingId) return;
    setElapsedSeconds(data.elapsedSeconds);
    setCurrentCost(data.totalCost * 100); // Convert from dollars to cents
    
    toast({
      title: 'Session Ended',
      description: `Total time: ${formatTime(data.elapsedSeconds)}, Cost: ${formatCost(data.totalCost * 100)}`,
      variant: 'default'
    });
    
    onCallEnded?.();
  };
  
  const handleLowBalance = (data: any) => {
    if (data.readingId !== readingId) return;
    setRemainingBalance(data.remainingBalance * 100); // Convert from dollars to cents
    
    if (data.criticallyLow) {
      toast({
        title: 'Insufficient Balance',
        description: 'Your session will end due to insufficient balance.',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Low Balance Warning',
        description: 'Your balance is running low. Please add funds to continue.',
        variant: 'warning'
      });
    }
  };
  
  const handleCallEnded = (data: any) => {
    if (data.readingId !== readingId) return;
    
    toast({
      title: 'Call Ended',
      description: `The call has been ended by ${data.role === 'reader' ? 'the reader' : 'the client'}.`,
      variant: 'default'
    });
    
    onCallEnded?.();
  };
  
  const toggleVideo = () => {
    if (readingType !== 'video') return;
    
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    webRTCClient.toggleVideo(newState);
  };
  
  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    webRTCClient.toggleAudio(newState);
  };
  
  const endCall = () => {
    webRTCClient.endCall();
    onCallEnded?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Video container */}
      <div className="relative flex-grow bg-black rounded-lg overflow-hidden">
        {/* Remote video (full size) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Local video (picture-in-picture) */}
        {readingType === 'video' && (
          <div className="absolute bottom-4 right-4 w-1/4 h-1/4 border-2 border-primary rounded-lg overflow-hidden bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        {/* Connection status overlay */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-white">Connecting...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Controls and info */}
      <Card className="mt-4 p-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          {/* Session info */}
          <div className="mb-4 md:mb-0">
            <div className="flex items-center space-x-4">
              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="text-lg font-semibold">{formatTime(elapsedSeconds)}</p>
              </div>
              
              {isClient && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Cost</p>
                    <p className="text-lg font-semibold">{formatCost(currentCost)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Rate</p>
                    <p className="text-lg font-semibold">{formatCost(pricePerMinute)}/min</p>
                  </div>
                </>
              )}
              
              {isReader && (
                <div>
                  <p className="text-sm text-muted-foreground">Earnings</p>
                  <p className="text-lg font-semibold">{formatCost(currentCost)}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex space-x-4">
            {readingType === 'video' && (
              <Button
                variant={isVideoEnabled ? "default" : "outline"}
                size="icon"
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <Video /> : <VideoOff />}
              </Button>
            )}
            
            <Button
              variant={isAudioEnabled ? "default" : "outline"}
              size="icon"
              onClick={toggleAudio}
            >
              {isAudioEnabled ? <Mic /> : <MicOff />}
            </Button>
            
            <Button
              variant="destructive"
              size="icon"
              onClick={endCall}
            >
              <PhoneOff />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}