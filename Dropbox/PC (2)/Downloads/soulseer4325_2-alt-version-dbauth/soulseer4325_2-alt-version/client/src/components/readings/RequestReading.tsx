import React, { useState, useEffect } from 'react';
import { useNavigate } from 'wouter';
import { Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';
import axios from 'axios';

interface RequestReadingProps {
  readerId: number;
  readerName: string;
  clientId: number;
  clientName: string;
}

interface ReaderRates {
  chatRate: number;
  audioRate: number;
  videoRate: number;
  flatRate15Min?: number;
  flatRate30Min?: number;
  flatRate45Min?: number;
  flatRate60Min?: number;
}

export default function RequestReading({ readerId, readerName, clientId, clientName }: RequestReadingProps) {
  const [sessionType, setSessionType] = useState<'chat' | 'audio' | 'video'>('chat');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(addDays(new Date(), 1));
  const [scheduledTime, setScheduledTime] = useState('12:00');
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30);
  const [readerRates, setReaderRates] = useState<ReaderRates | null>(null);
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Fetch reader rates and client balance
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ratesResponse, balanceResponse] = await Promise.all([
          axios.get(`/api/webrtc/reader/${readerId}/rates`),
          axios.get('/api/webrtc/client/balance')
        ]);
        
        setReaderRates(ratesResponse.data);
        setBalance(balanceResponse.data.balance);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load reader rates or client balance');
      }
    };
    
    fetchData();
  }, [readerId]);

  // Calculate the rate for the current selection
  const calculateRate = (): number => {
    if (!readerRates) return 0;
    
    if (isScheduled) {
      switch (duration) {
        case 15:
          return readerRates.flatRate15Min || 0;
        case 30:
          return readerRates.flatRate30Min || 0;
        case 45:
          return readerRates.flatRate45Min || 0;
        case 60:
          return readerRates.flatRate60Min || 0;
        default:
          return 0;
      }
    } else {
      switch (sessionType) {
        case 'chat':
          return readerRates.chatRate;
        case 'audio':
          return readerRates.audioRate;
        case 'video':
          return readerRates.videoRate;
        default:
          return 0;
      }
    }
  };

  // Check if the current selection is available
  const isSelectionAvailable = (): boolean => {
    if (!readerRates) return false;
    
    if (isScheduled) {
      switch (duration) {
        case 15:
          return !!readerRates.flatRate15Min;
        case 30:
          return !!readerRates.flatRate30Min;
        case 45:
          return !!readerRates.flatRate45Min;
        case 60:
          return !!readerRates.flatRate60Min;
        default:
          return false;
      }
    } else {
      return true; // Pay-per-minute is always available if reader has set rates
    }
  };

  // Calculate the total cost for scheduled sessions
  const calculateTotalCost = (): number => {
    if (!isScheduled) return 0;
    return calculateRate();
  };

  // Check if client has sufficient balance for pay-per-minute
  const hasSufficientBalance = (): boolean => {
    if (isScheduled) return true; // For scheduled sessions, payment is handled separately
    return balance >= calculateRate(); // For pay-per-minute, need at least enough for 1 minute
  };

  // Format date and time for display
  const formatDateTime = (): string => {
    if (!scheduledDate) return '';
    
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const date = new Date(scheduledDate);
    date.setHours(hours, minutes);
    
    return format(date, 'EEEE, MMMM d, yyyy h:mm a');
  };

  // Handle session request submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSelectionAvailable()) {
      setError('The selected session type or duration is not available');
      return;
    }
    
    if (!hasSufficientBalance() && !isScheduled) {
      setError('Insufficient balance for this reading');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      if (isScheduled) {
        // Create a scheduled session
        const scheduledDateTime = new Date(scheduledDate);
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        scheduledDateTime.setHours(hours, minutes);
        
        const response = await axios.post('/api/webrtc/client/schedule-session', {
          readerId,
          sessionType,
          scheduledStartTime: scheduledDateTime.toISOString(),
          duration
        });
        
        setSuccess('Scheduled reading session created successfully');
        
        // Redirect to checkout for scheduled session payment
        navigate(`/checkout/scheduled-session/${response.data.sessionId}`);
      } else {
        // Create a pay-per-minute session
        const response = await axios.post('/api/webrtc/client/request-session', {
          readerId,
          sessionType
        });
        
        setSuccess('Reading request sent successfully');
        
        // Redirect to the session page
        navigate(`/session/${response.data.sessionId}`);
      }
    } catch (error: any) {
      console.error('Error requesting session:', error);
      setError(error.response?.data?.message || 'Failed to create reading session');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate time slots for selection (every 30 minutes)
  const generateTimeSlots = () => {
    const slots = [];
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 30]) {
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        const time = `${formattedHour}:${formattedMinute}`;
        const displayTime = format(new Date().setHours(hour, minute), 'h:mm a');
        
        slots.push(
          <option key={time} value={time}>
            {displayTime}
          </option>
        );
      }
    }
    
    return slots;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-white">Request Reading with {readerName}</h2>
      
      {error && (
        <div className="mb-6 p-3 bg-red-900 text-white rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-3 bg-green-800 text-white rounded">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Reading Type Tabs */}
        <div className="mb-6 border-b border-gray-700 flex">
          <button
            type="button"
            className={`py-2 px-4 ${!isScheduled ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setIsScheduled(false)}
          >
            Pay Per Minute
          </button>
          <button
            type="button"
            className={`py-2 px-4 ${isScheduled ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setIsScheduled(true)}
          >
            Schedule a Reading
          </button>
        </div>

        {/* Session Type */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-300">
            Reading Type
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              className={`${sessionType === 'chat' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} p-3 rounded-lg text-white`}
              onClick={() => setSessionType('chat')}
            >
              Chat
              {readerRates && (
                <div className="mt-1 text-xs">
                  ${isScheduled ? '' : readerRates.chatRate}/min
                </div>
              )}
            </button>
            <button
              type="button"
              className={`${sessionType === 'audio' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} p-3 rounded-lg text-white`}
              onClick={() => setSessionType('audio')}
            >
              Audio
              {readerRates && (
                <div className="mt-1 text-xs">
                  ${isScheduled ? '' : readerRates.audioRate}/min
                </div>
              )}
            </button>
            <button
              type="button"
              className={`${sessionType === 'video' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} p-3 rounded-lg text-white`}
              onClick={() => setSessionType('video')}
            >
              Video
              {readerRates && (
                <div className="mt-1 text-xs">
                  ${isScheduled ? '' : readerRates.videoRate}/min
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Scheduled Reading Options */}
        {isScheduled && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={format(scheduledDate, 'yyyy-MM-dd')}
                    onChange={(e) => setScheduledDate(new Date(e.target.value))}
                    min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                    className="bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 w-full"
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Time
                </label>
                <select
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 w-full"
                >
                  {generateTimeSlots()}
                </select>
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-300">
                Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  className={`${duration === 15 ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} p-2 rounded-lg text-white ${!readerRates?.flatRate15Min && 'opacity-50 cursor-not-allowed'}`}
                  onClick={() => setDuration(15)}
                  disabled={!readerRates?.flatRate15Min}
                >
                  15 min
                  {readerRates?.flatRate15Min && (
                    <div className="mt-1 text-xs font-medium">
                      ${readerRates.flatRate15Min}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  className={`${duration === 30 ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} p-2 rounded-lg text-white ${!readerRates?.flatRate30Min && 'opacity-50 cursor-not-allowed'}`}
                  onClick={() => setDuration(30)}
                  disabled={!readerRates?.flatRate30Min}
                >
                  30 min
                  {readerRates?.flatRate30Min && (
                    <div className="mt-1 text-xs font-medium">
                      ${readerRates.flatRate30Min}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  className={`${duration === 45 ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} p-2 rounded-lg text-white ${!readerRates?.flatRate45Min && 'opacity-50 cursor-not-allowed'}`}
                  onClick={() => setDuration(45)}
                  disabled={!readerRates?.flatRate45Min}
                >
                  45 min
                  {readerRates?.flatRate45Min && (
                    <div className="mt-1 text-xs font-medium">
                      ${readerRates.flatRate45Min}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  className={`${duration === 60 ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} p-2 rounded-lg text-white ${!readerRates?.flatRate60Min && 'opacity-50 cursor-not-allowed'}`}
                  onClick={() => setDuration(60)}
                  disabled={!readerRates?.flatRate60Min}
                >
                  60 min
                  {readerRates?.flatRate60Min && (
                    <div className="mt-1 text-xs font-medium">
                      ${readerRates.flatRate60Min}
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-gray-300">Date & Time:</span>
                <span className="text-white font-medium">{formatDateTime()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Total:</span>
                <span className="text-white font-bold">${calculateTotalCost()}</span>
              </div>
            </div>
          </>
        )}

        {/* Pay Per Minute Info */}
        {!isScheduled && (
          <div className="p-4 bg-gray-700 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-gray-300">Rate:</span>
              <span className="text-white font-medium">${calculateRate()}/minute</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Your Balance:</span>
              <span className={`font-bold ${hasSufficientBalance() ? 'text-green-400' : 'text-red-400'}`}>
                ${balance.toFixed(2)}
              </span>
            </div>
            {!hasSufficientBalance() && (
              <div className="mt-2 text-sm text-red-400">
                Insufficient balance. <a href="/add-funds" className="underline">Add funds</a>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !isSelectionAvailable() || (!isScheduled && !hasSufficientBalance())}
          className={`w-full py-3 px-4 ${
            isLoading || !isSelectionAvailable() || (!isScheduled && !hasSufficientBalance())
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          } text-white font-medium rounded-lg`}
        >
          {isLoading ? 'Processing...' : isScheduled ? 'Schedule & Pay' : 'Start Reading Now'}
        </button>
      </form>
    </div>
  );
} 