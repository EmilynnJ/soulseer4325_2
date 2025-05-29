import React, { useState, useEffect } from 'react';
import { webrtcClient } from '../services/webrtc-client';
import { useAuth } from '../hooks/useAuth';

const WebRTCSession = ({ 
  readerId, 
  sessionType, 
  readerData, 
  onSessionCreated, 
  onSessionEnded, 
  onError 
}) => {
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const createSession = async () => {
    if (!user || !readerId) {
      setError('Missing required data');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Prepare session data
      const sessionPayload = {
        clientId: user.$id,
        readerId: readerId,
        sessionType: sessionType, // 'chat', 'phone', 'video'
        billingType: 'per_minute',
        rate: readerData?.rates?.[sessionType] || 0,
        clientName: user.name || user.email,
        readerName: readerData?.name || 'Reader',
        clientStripeCustomerId: user.stripeCustomerId,
        readerStripeAccountId: readerData?.stripeAccountId,
        externalSessionId: `soulseer_${Date.now()}_${user.$id}` // Track in your main app
      };

      // Create session with WebRTC service
      const response = await webrtcClient.createSession(sessionPayload);

      if (response.success && response.session) {
        setSessionData(response.session);
        
        // Generate session URL
        const sessionUrl = webrtcClient.generateSessionUrl(
          response.session.roomId,
          user.$id,
          'client',
          sessionType
        );

        // Notify parent component
        if (onSessionCreated) {
          onSessionCreated({
            session: response.session,
            sessionUrl,
            roomId: response.session.roomId
          });
        }

        // Redirect to WebRTC session
        window.open(sessionUrl, '_blank', 'width=1200,height=800');

      } else {
        throw new Error(response.error || 'Failed to create session');
      }

    } catch (err) {
      console.error('Session creation error:', err);
      setError(err.message);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!sessionData?.id) return;

    try {
      const response = await webrtcClient.endSession(sessionData.id, 'user_ended');
      
      if (onSessionEnded) {
        onSessionEnded(response);
      }
      
      setSessionData(null);
    } catch (err) {
      console.error('Error ending session:', err);
      setError(err.message);
    }
  };

  return (
    <div className="webrtc-session-controls p-4 bg-white rounded-lg shadow-md">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {!sessionData ? (
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-4">
            Start {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Reading
          </h3>
          
          <div className="mb-4 text-sm text-gray-600">
            <p>Reader: {readerData?.name}</p>
            <p>Rate: ${readerData?.rates?.[sessionType] || 0}/minute</p>
            <p>Type: {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}</p>
          </div>

          <button
            onClick={createSession}
            disabled={loading}
            className={`px-6 py-3 rounded-lg text-white font-semibold ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {loading ? 'Starting Session...' : 'Start Reading'}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-4 text-green-600">
            Session Active
          </h3>
          
          <div className="mb-4 text-sm text-gray-600">
            <p>Session ID: {sessionData.id}</p>
            <p>Room ID: {sessionData.roomId}</p>
            <p>Status: {sessionData.status}</p>
          </div>

          <div className="space-x-3">
            <button
              onClick={() => {
                const sessionUrl = webrtcClient.generateSessionUrl(
                  sessionData.roomId,
                  user.$id,
                  'client',
                  sessionType
                );
                window.open(sessionUrl, '_blank', 'width=1200,height=800');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Rejoin Session
            </button>
            
            <button
              onClick={endSession}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              End Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebRTCSession;
