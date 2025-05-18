import React, { useState, useEffect } from 'react';
import { Circle, CheckCircle } from 'lucide-react';
import axios from 'axios';

interface ReaderAvailabilityToggleProps {
  userId: number;
  initialStatus?: boolean;
  onStatusChange?: (isOnline: boolean) => void;
}

export default function ReaderAvailabilityToggle({
  userId,
  initialStatus = false,
  onStatusChange
}: ReaderAvailabilityToggleProps) {
  const [isOnline, setIsOnline] = useState(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  // Initialize status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get('/api/webrtc/reader/availability');
        setIsOnline(response.data.isOnline);
      } catch (err) {
        console.error('Error fetching availability status:', err);
      }
    };

    if (!initialStatus) {
      fetchStatus();
    }
  }, [initialStatus]);

  const toggleAvailability = async () => {
    setIsUpdating(true);
    setError('');

    try {
      const newStatus = !isOnline;
      
      await axios.post('/api/webrtc/reader/availability', {
        isOnline: newStatus
      });
      
      setIsOnline(newStatus);
      
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
    } catch (err) {
      console.error('Error updating availability:', err);
      setError('Failed to update your availability status.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col">
      <button
        onClick={toggleAvailability}
        disabled={isUpdating}
        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
          isUpdating ? 'cursor-not-allowed opacity-70' : ''
        } ${
          isOnline
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
        }`}
      >
        {isOnline ? (
          <CheckCircle size={18} className="mr-2" />
        ) : (
          <Circle size={18} className="mr-2" />
        )}
        <span>{isOnline ? 'Available for Readings' : 'Set as Available'}</span>
        
        {isUpdating && (
          <div className="ml-2 animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
        )}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
} 