import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'wouter';
import { Clock, Calendar, Video, MessageSquare, Phone, CheckCircle, XCircle, User, DollarSign, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';

interface ReadingDashboardProps {
  userId: number;
  isReader: boolean;
}

type ReadingSession = {
  id: number;
  sessionId: string;
  readerId: number;
  clientId: number;
  sessionType: 'chat' | 'audio' | 'video';
  startTime?: Date;
  endTime?: Date;
  scheduledStartTime?: Date;
  scheduledDuration?: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  totalMinutes?: number;
  amountCharged?: number;
  isPayPerMinute: boolean;
  client?: {
    fullName: string;
    profileImage?: string;
  };
  reader?: {
    fullName: string;
    profileImage?: string;
  };
};

export default function ReadingDashboard({ userId, isReader }: ReadingDashboardProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'scheduled' | 'completed'>('active');
  const [activeSessions, setActiveSessions] = useState<ReadingSession[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<ReadingSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState<ReadingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Fetch sessions data
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      setError('');

      try {
        const endpoints = isReader
          ? [
              '/api/webrtc/reader/sessions',
              '/api/webrtc/reader/scheduled-sessions',
              '/api/webrtc/reader/completed-sessions'
            ]
          : [
              '/api/webrtc/client/sessions',
              '/api/webrtc/client/scheduled-sessions',
              '/api/webrtc/client/completed-sessions'
            ];

        const [activeResponse, scheduledResponse, completedResponse] = await Promise.all(
          endpoints.map(endpoint => axios.get(endpoint))
        );

        setActiveSessions(activeResponse.data);
        setScheduledSessions(scheduledResponse.data);
        setCompletedSessions(completedResponse.data);
      } catch (err) {
        console.error('Error fetching sessions:', err);
        setError('Failed to load sessions. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();

    // Set up polling for active sessions (refresh every 30 seconds)
    const interval = setInterval(() => {
      if (activeTab === 'active') {
        fetchSessions();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userId, isReader, activeTab]);

  // Handle accepting a session (for readers)
  const handleAcceptSession = async (sessionId: string) => {
    try {
      await axios.post(`/api/webrtc/reader/accept-session/${sessionId}`);
      navigate(`/session/${sessionId}`);
    } catch (err) {
      console.error('Error accepting session:', err);
      setError('Failed to accept the session. Please try again.');
    }
  };

  // Handle cancelling a session
  const handleCancelSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to cancel this session?')) return;

    try {
      await axios.post(`/api/webrtc/session/${sessionId}/cancel`);
      
      // Update scheduled sessions list
      setScheduledSessions(prev => prev.filter(session => session.sessionId !== sessionId));
    } catch (err) {
      console.error('Error cancelling session:', err);
      setError('Failed to cancel the session. Please try again.');
    }
  };

  // Get icon based on session type
  const getSessionTypeIcon = (type: 'chat' | 'audio' | 'video') => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="text-blue-500" size={20} />;
      case 'audio':
        return <Phone className="text-indigo-500" size={20} />;
      case 'video':
        return <Video className="text-purple-500" size={20} />;
    }
  };

  // Render session cards
  const renderSessionCards = (sessions: ReadingSession[], type: 'active' | 'scheduled' | 'completed') => {
    if (sessions.length === 0) {
      return (
        <div className="text-center py-10 bg-gray-800 rounded-lg">
          <p className="text-gray-400">
            {type === 'active' 
              ? 'No active sessions at the moment.' 
              : type === 'scheduled' 
                ? 'No scheduled sessions.' 
                : 'No completed sessions.'}
          </p>
          {!isReader && type !== 'active' && (
            <Link href="/readers">
              <a className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Find a Reader
              </a>
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map(session => (
          <div key={session.sessionId} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors">
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center">
                  {getSessionTypeIcon(session.sessionType)}
                  <span className="ml-2 font-medium capitalize">
                    {session.sessionType} Reading
                  </span>
                </div>
                <div className="px-2 py-1 rounded-full text-xs font-medium bg-gray-700">
                  {session.isPayPerMinute ? 'Pay-per-minute' : 'Flat rate'}
                </div>
              </div>

              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                  {isReader 
                    ? session.client?.profileImage 
                      ? <img src={session.client.profileImage} alt="Client" className="w-10 h-10 rounded-full object-cover" />
                      : <User size={20} />
                    : session.reader?.profileImage
                      ? <img src={session.reader.profileImage} alt="Reader" className="w-10 h-10 rounded-full object-cover" />
                      : <User size={20} />
                  }
                </div>
                <div>
                  <div className="font-medium">
                    {isReader ? session.client?.fullName : session.reader?.fullName}
                  </div>
                  <div className="text-sm text-gray-400">
                    {isReader ? 'Client' : 'Reader'}
                  </div>
                </div>
              </div>

              {type === 'active' && (
                <div className="mb-3 bg-gray-700 p-2 rounded flex justify-between">
                  <div className="text-sm">
                    <span className="text-gray-400">Started:</span>{' '}
                    {session.startTime ? format(new Date(session.startTime), 'MMM d, h:mm a') : 'N/A'}
                  </div>
                  <div className="flex items-center text-green-400">
                    <Clock size={16} className="mr-1" />
                    <span className="text-sm">Active</span>
                  </div>
                </div>
              )}

              {type === 'scheduled' && (
                <div className="mb-3 bg-gray-700 p-2 rounded">
                  <div className="flex justify-between items-center">
                    <div className="text-sm">
                      <div className="flex items-center text-gray-300">
                        <Calendar size={16} className="mr-1" />
                        {session.scheduledStartTime 
                          ? format(new Date(session.scheduledStartTime), 'MMM d, h:mm a')
                          : 'Flexible time'}
                      </div>
                    </div>
                    {session.scheduledDuration && (
                      <div className="text-sm text-gray-300">
                        {session.scheduledDuration} minutes
                      </div>
                    )}
                  </div>
                </div>
              )}

              {type === 'completed' && (
                <div className="mb-3 bg-gray-700 p-2 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-sm text-gray-300">
                      {session.startTime ? format(new Date(session.startTime), 'MMM d, h:mm a') : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-300">
                      {session.totalMinutes?.toFixed(1) || 0} minutes
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-400">Completed</div>
                    <div className="text-sm font-medium text-green-400">
                      ${session.amountCharged?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4">
                {type === 'active' && (
                  <button
                    onClick={() => navigate(`/session/${session.sessionId}`)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    Join Session
                  </button>
                )}

                {type === 'scheduled' && (
                  <div className="flex space-x-2">
                    {isReader && session.status === 'scheduled' && (
                      <button
                        onClick={() => handleAcceptSession(session.sessionId)}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Accept
                      </button>
                    )}

                    {session.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancelSession(session.sessionId)}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}

                    {!isReader && session.status === 'active' && (
                      <button
                        onClick={() => navigate(`/session/${session.sessionId}`)}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                      >
                        Join Session
                      </button>
                    )}
                  </div>
                )}

                {type === 'completed' && (
                  <Link href={`/session/${session.sessionId}/summary`}>
                    <a className="block w-full py-2 text-center bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                      View Summary
                    </a>
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Add a reading (for clients only)
  const handleAddReading = () => {
    navigate('/readers');
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">
          {isReader ? 'My Reading Sessions' : 'My Readings'}
        </h1>
        {!isReader && (
          <button
            onClick={handleAddReading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Find a Reader
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900 text-white rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-6 border-b border-gray-700">
        <div className="flex space-x-4">
          <button
            className={`py-3 px-4 font-medium ${
              activeTab === 'active'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('active')}
          >
            Active
          </button>
          <button
            className={`py-3 px-4 font-medium ${
              activeTab === 'scheduled'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('scheduled')}
          >
            Scheduled
          </button>
          <button
            className={`py-3 px-4 font-medium ${
              activeTab === 'completed'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div>
          {activeTab === 'active' && renderSessionCards(activeSessions, 'active')}
          {activeTab === 'scheduled' && renderSessionCards(scheduledSessions, 'scheduled')}
          {activeTab === 'completed' && renderSessionCards(completedSessions, 'completed')}
        </div>
      )}
    </div>
  );
} 