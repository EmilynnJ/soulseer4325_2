import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'wouter';
import { Clock, Calendar, Video, MessageSquare, Phone, DollarSign, Star, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';

interface ReadingSessionSummaryProps {
  userId: number;
  isReader: boolean;
}

type SessionSummary = {
  id: number;
  sessionId: string;
  readerId: number;
  clientId: number;
  sessionType: 'chat' | 'audio' | 'video';
  startTime: string;
  endTime: string;
  status: string;
  totalMinutes: number;
  amountCharged: number;
  isPayPerMinute: boolean;
  client: {
    id: number;
    fullName: string;
    profileImage?: string;
  };
  reader: {
    id: number;
    fullName: string;
    profileImage?: string;
    rating?: number;
  };
  feedback?: {
    rating: number;
    comment: string;
    createdAt: string;
  };
};

export default function ReadingSessionSummary({ userId, isReader }: ReadingSessionSummaryProps) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const navigate = useNavigate();

  // Fetch session details
  useEffect(() => {
    const fetchSessionSummary = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await axios.get(`/api/webrtc/session/${sessionId}/summary`);
        setSession(response.data);
        
        // If feedback exists, populate the form
        if (response.data.feedback) {
          setRating(response.data.feedback.rating);
          setFeedback(response.data.feedback.comment);
          setFeedbackSubmitted(true);
        }
      } catch (err) {
        console.error('Error fetching session summary:', err);
        setError('Failed to load session summary. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    if (sessionId) {
      fetchSessionSummary();
    }
  }, [sessionId]);

  // Submit feedback (for clients only)
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isReader || !session) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      await axios.post(`/api/webrtc/session/${sessionId}/feedback`, {
        rating,
        comment: feedback
      });
      
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get icon based on session type
  const getSessionTypeIcon = (type: 'chat' | 'audio' | 'video') => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="text-blue-500" size={24} />;
      case 'audio':
        return <Phone className="text-indigo-500" size={24} />;
      case 'video':
        return <Video className="text-purple-500" size={24} />;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6 bg-gray-800 rounded-lg">
        <div className="text-center text-red-400 mb-4">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold">Error</h2>
        </div>
        <p className="text-center text-gray-300 mb-6">{error}</p>
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // No session found
  if (!session) {
    return (
      <div className="max-w-3xl mx-auto p-6 bg-gray-800 rounded-lg">
        <div className="text-center text-yellow-400 mb-4">
          <div className="text-5xl mb-3">🔍</div>
          <h2 className="text-xl font-bold">Session Not Found</h2>
        </div>
        <p className="text-center text-gray-300 mb-6">
          We couldn't find the session you're looking for. It may have been deleted or you might not have permission to view it.
        </p>
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <ArrowLeft size={20} className="mr-1" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white mb-4">Reading Session Summary</h1>
          
          <div className="flex items-center mb-6">
            <div className="mr-4">
              {getSessionTypeIcon(session.sessionType)}
            </div>
            <div>
              <h2 className="text-xl font-medium text-white capitalize">
                {session.sessionType} Reading
              </h2>
              <div className="text-gray-400">
                {session.isPayPerMinute ? 'Pay-per-minute' : 'Flat rate'} session
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-gray-400 text-sm mb-2">Reader</h3>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mr-3">
                  {session.reader.profileImage ? (
                    <img 
                      src={session.reader.profileImage} 
                      alt={session.reader.fullName} 
                      className="w-12 h-12 rounded-full object-cover" 
                    />
                  ) : (
                    <div className="text-xl font-bold text-gray-300">
                      {session.reader.fullName.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-white">{session.reader.fullName}</div>
                  {session.reader.rating && (
                    <div className="flex items-center text-yellow-400">
                      <Star size={14} className="mr-1 fill-current" />
                      <span>{session.reader.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-gray-400 text-sm mb-2">Client</h3>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mr-3">
                  {session.client.profileImage ? (
                    <img 
                      src={session.client.profileImage} 
                      alt={session.client.fullName} 
                      className="w-12 h-12 rounded-full object-cover" 
                    />
                  ) : (
                    <div className="text-xl font-bold text-gray-300">
                      {session.client.fullName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="font-medium text-white">{session.client.fullName}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-medium text-white mb-4">Session Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400 text-sm mb-1">Start Time</div>
                <div className="flex items-center">
                  <Calendar size={16} className="mr-2 text-indigo-400" />
                  <div>{format(new Date(session.startTime), 'MMMM d, yyyy')}</div>
                </div>
                <div className="flex items-center mt-1">
                  <Clock size={16} className="mr-2 text-indigo-400" />
                  <div>{format(new Date(session.startTime), 'h:mm a')}</div>
                </div>
              </div>
              
              <div>
                <div className="text-gray-400 text-sm mb-1">End Time</div>
                <div className="flex items-center">
                  <Calendar size={16} className="mr-2 text-indigo-400" />
                  <div>{format(new Date(session.endTime), 'MMMM d, yyyy')}</div>
                </div>
                <div className="flex items-center mt-1">
                  <Clock size={16} className="mr-2 text-indigo-400" />
                  <div>{format(new Date(session.endTime), 'h:mm a')}</div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-600 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400 text-sm mb-1">Duration</div>
                <div className="text-xl font-medium text-white">
                  {session.totalMinutes.toFixed(1)} minutes
                </div>
              </div>
              
              <div>
                <div className="text-gray-400 text-sm mb-1">Total Amount</div>
                <div className="text-xl font-medium text-green-400 flex items-center">
                  <DollarSign size={20} className="mr-1" />
                  {session.amountCharged.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
          
          {!isReader && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-white mb-4">
                {feedbackSubmitted ? 'Your Feedback' : 'Rate Your Experience'}
              </h3>
              
              {feedbackSubmitted ? (
                <div>
                  <div className="flex items-center mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i}
                        size={24} 
                        className={`${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-500'} mr-1`}
                      />
                    ))}
                    <span className="ml-2 text-white">{rating} out of 5</span>
                  </div>
                  
                  {feedback && (
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Your Comment</div>
                      <div className="bg-gray-800 p-3 rounded-lg text-white">
                        {feedback}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-gray-400 text-sm mt-3">
                    {session.feedback?.createdAt ? (
                      <span>Submitted on {format(new Date(session.feedback.createdAt), 'MMMM d, yyyy')}</span>
                    ) : (
                      <span>Thank you for your feedback!</span>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback}>
                  <div className="mb-4">
                    <div className="text-gray-400 text-sm mb-2">How would you rate your session?</div>
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setRating(i + 1)}
                          className="focus:outline-none"
                        >
                          <Star 
                            size={32} 
                            className={`${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-500 hover:text-gray-400'} mr-2`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-gray-400 text-sm mb-2">
                      Share your thoughts about the reading (optional)
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
                      rows={4}
                      placeholder="Your comments help our readers improve their services..."
                    ></textarea>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || rating === 0}
                      className={`px-6 py-2 rounded-lg ${
                        isSubmitting || rating === 0
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      } text-white transition-colors`}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
          
          {isReader && session.feedback && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-white mb-4">Client Feedback</h3>
              
              <div className="flex items-center mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i}
                    size={24} 
                    className={`${i < session.feedback!.rating ? 'text-yellow-400 fill-current' : 'text-gray-500'} mr-1`}
                  />
                ))}
                <span className="ml-2 text-white">{session.feedback.rating} out of 5</span>
              </div>
              
              {session.feedback.comment && (
                <div>
                  <div className="text-gray-400 text-sm mb-1">Client Comment</div>
                  <div className="bg-gray-800 p-3 rounded-lg text-white">
                    {session.feedback.comment}
                  </div>
                </div>
              )}
              
              <div className="text-gray-400 text-sm mt-3">
                Submitted on {format(new Date(session.feedback.createdAt), 'MMMM d, yyyy')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 