import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import WebRTCVideoCall from '@/components/readings/WebRTCVideoCall';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import EnhancedChat from '@/components/readings/enhanced-chat';
import { useWebSocket } from '@/hooks/use-websocket';

export default function ReadingSessionPage() {
  const { readingId } = useParams<{ readingId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { socket, connected } = useWebSocket();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);
  
  useEffect(() => {
    if (!user || !connected || !readingId) return;
    
    const fetchReading = async () => {
      try {
        setLoading(true);
        
        // Fetch reading details from API
        const response = await fetch(`/api/readings/${readingId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch reading details');
        }
        
        const data = await response.json();
        setReading(data);
        
        // Check if user is authorized to access this reading
        if (data.clientId !== user.id && data.readerId !== user.id) {
          throw new Error('You are not authorized to access this reading');
        }
        
        // Check if reading is in progress
        if (data.status !== 'in_progress' && data.status !== 'scheduled') {
          setShowSummary(true);
        }
      } catch (error) {
        console.error('Error fetching reading:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
        
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load reading session',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchReading();
    
    // Listen for reading status updates
    socket.on('reading_status_update', handleReadingStatusUpdate);
    
    return () => {
      socket.off('reading_status_update', handleReadingStatusUpdate);
    };
  }, [user, connected, readingId]);
  
  const handleReadingStatusUpdate = (data: any) => {
    if (data.readingId === Number(readingId)) {
      setReading(prev => ({ ...prev, status: data.status }));
      
      if (data.status === 'completed') {
        setShowSummary(true);
      }
    }
  };
  
  const handleCallEnded = () => {
    setShowSummary(true);
  };
  
  const handleReturnToDashboard = () => {
    navigate('/dashboard');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-6">{error}</p>
            <Button onClick={handleReturnToDashboard}>Return to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!reading) {
    return null;
  }
  
  if (showSummary) {
    return (
      <div className="container mx-auto py-10 px-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Reading Session Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="text-center">
                <p className="text-lg mb-2">
                  {reading.status === 'completed' 
                    ? 'Your reading session has ended.' 
                    : 'This reading session is not active.'}
                </p>
                
                {reading.status === 'completed' && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h3 className="text-xl font-semibold mb-2">Session Details</h3>
                    <div className="grid grid-cols-2 gap-2 max-w-md mx-auto text-left">
                      <p className="text-muted-foreground">Type:</p>
                      <p className="font-medium capitalize">{reading.type}</p>
                      
                      <p className="text-muted-foreground">Reader:</p>
                      <p className="font-medium">{reading.reader?.fullName || reading.reader?.username}</p>
                      
                      <p className="text-muted-foreground">Client:</p>
                      <p className="font-medium">{reading.client?.fullName || reading.client?.username}</p>
                      
                      <p className="text-muted-foreground">Rate:</p>
                      <p className="font-medium">${(reading.pricePerMinute / 100).toFixed(2)}/min</p>
                      
                      {reading.totalPrice && (
                        <>
                          <p className="text-muted-foreground">Total Cost:</p>
                          <p className="font-medium">${(reading.totalPrice / 100).toFixed(2)}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                <Button onClick={handleReturnToDashboard} className="mt-6">
                  Return to Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Video call */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>
                {reading.type === 'video' ? 'Video Call' : reading.type === 'voice' ? 'Voice Call' : 'Chat'} with {
                  user?.id === reading.clientId 
                    ? reading.reader?.fullName || reading.reader?.username 
                    : reading.client?.fullName || reading.client?.username
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WebRTCVideoCall
                readingId={Number(readingId)}
                readerId={reading.readerId}
                clientId={reading.clientId}
                readingType={reading.type}
                pricePerMinute={reading.pricePerMinute}
                onCallEnded={handleCallEnded}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Sidebar - Chat */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <EnhancedChat
                readingId={Number(readingId)}
                userId={user?.id || 0}
                recipientId={user?.id === reading.clientId ? reading.readerId : reading.clientId}
                recipientName={
                  user?.id === reading.clientId 
                    ? reading.reader?.fullName || reading.reader?.username 
                    : reading.client?.fullName || reading.client?.username
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}