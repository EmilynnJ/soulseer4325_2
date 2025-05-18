import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Reading } from '@shared/schema';
import { User } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Mic, MicOff, PhoneOff, Camera, CameraOff } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface VideoCallProps {
  reading: Reading;
  user: User;
  isReader: boolean;
  onEndCall: () => void;
  onTimerUpdate: (seconds: number) => void;
}

export function VideoCall({
  reading,
  user,
  isReader,
  onEndCall,
  onTimerUpdate,
}: VideoCallProps) {
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Setup the video call
  useEffect(() => {
    async function setupVideoCall() {
      try {
        setIsLoading(true);
        
        // Initialize WebRTC connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        });
        
        peerConnectionRef.current = pc;
        
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        // Display local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Add tracks to peer connection
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
        
        // Handle incoming tracks
        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };
        
        // Start the timer for billing purposes
        startTimer();
        
        // Create signaling channel (simplified for example)
        // In a real app, you would implement proper signaling
        
        setIsLoading(false);
        
        toast({
          title: 'Video Call Started',
          description: 'You are now connected to the video call.',
        });
      } catch (error) {
        console.error('Error setting up video call:', error);
        toast({
          title: 'Error',
          description: 'Failed to set up the video call. Please check your camera and microphone permissions.',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    }

    setupVideoCall();

    return () => {
      // Clean up
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      // Stop all media tracks
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [reading.id]);

  // Start timer for billing
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        onTimerUpdate(newTime);
        return newTime;
      });
    }, 1000);
  };

  // Handle toggling video
  const toggleVideo = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const videoTrack = (localVideoRef.current.srcObject as MediaStream)
        .getVideoTracks()[0];
      
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  // Handle toggling audio
  const toggleAudio = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const audioTrack = (localVideoRef.current.srcObject as MediaStream)
        .getAudioTracks()[0];
      
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  // Handle ending the call
  const handleEndCall = () => {
    // Clean up WebRTC connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    // Stop all media tracks
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    
    toast({
      title: 'Call Ended',
      description: 'The video session has been ended.',
    });
    
    onEndCall();
  };

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 h-full">
            {/* Local video */}
            <div className="relative bg-background/10 rounded-lg overflow-hidden h-full">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
                {isReader ? 'You (Reader)' : 'You (Client)'}
              </div>
            </div>
            
            {/* Remote video */}
            <div className="relative bg-background/10 rounded-lg overflow-hidden h-full">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
                {isReader ? 'Client' : 'Reader'}
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <Button
              variant="outline"
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={toggleAudio}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={toggleVideo}
            >
              {isVideoEnabled ? (
                <Camera className="h-5 w-5" />
              ) : (
                <CameraOff className="h-5 w-5" />
              )}
            </Button>
            
            <Button
              variant="destructive"
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={handleEndCall}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}