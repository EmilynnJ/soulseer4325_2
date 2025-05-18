import React, { useState, useEffect } from 'react';
import { DollarSign, Save, Info } from 'lucide-react';
import axios from 'axios';

interface ReaderRateManagerProps {
  readerId: number;
}

interface RateSettings {
  chatRate: number;
  audioRate: number;
  videoRate: number;
  flatRate15Min: number;
  flatRate30Min: number;
  flatRate45Min: number;
  flatRate60Min: number;
  isAvailableForChat: boolean;
  isAvailableForAudio: boolean;
  isAvailableForVideo: boolean;
}

export default function ReaderRateManager({ readerId }: ReaderRateManagerProps) {
  const [rates, setRates] = useState<RateSettings>({
    chatRate: 0,
    audioRate: 0,
    videoRate: 0,
    flatRate15Min: 0,
    flatRate30Min: 0,
    flatRate45Min: 0,
    flatRate60Min: 0,
    isAvailableForChat: true,
    isAvailableForAudio: true,
    isAvailableForVideo: true
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch reader rates
  useEffect(() => {
    const fetchRates = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        const response = await axios.get(`/api/webrtc/reader/rates`);
        if (response.data) {
          setRates({
            chatRate: Number(response.data.chatRate) || 0,
            audioRate: Number(response.data.audioRate) || 0,
            videoRate: Number(response.data.videoRate) || 0,
            flatRate15Min: Number(response.data.flatRate15Min) || 0,
            flatRate30Min: Number(response.data.flatRate30Min) || 0,
            flatRate45Min: Number(response.data.flatRate45Min) || 0,
            flatRate60Min: Number(response.data.flatRate60Min) || 0,
            isAvailableForChat: response.data.isAvailableForChat ?? true,
            isAvailableForAudio: response.data.isAvailableForAudio ?? true,
            isAvailableForVideo: response.data.isAvailableForVideo ?? true
          });
        }
      } catch (err) {
        console.error('Error fetching rates:', err);
        setError('Failed to load your rates. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRates();
  }, [readerId]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setRates(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      // Parse number inputs
      const numberValue = value === '' ? 0 : parseFloat(value);
      if (isNaN(numberValue) || numberValue < 0) return;
      
      setRates(prev => ({
        ...prev,
        [name]: numberValue
      }));
    }
    
    // Clear success message when form is modified
    if (success) setSuccess('');
  };

  // Save rates
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await axios.post('/api/webrtc/reader/rates', rates);
      setSuccess('Your rates have been updated successfully!');
    } catch (err) {
      console.error('Error saving rates:', err);
      setError('Failed to save your rates. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold text-white mb-6">Your Reading Rates</h2>
      
      {error && (
        <div className="mb-6 p-3 bg-red-900 text-white rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-3 bg-green-800 text-white rounded-lg">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Pay-per-minute rates */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-4">Pay-Per-Minute Rates</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="flex justify-between">
                <span className="text-gray-300">Chat Reading Rate</span>
                <span className="text-xs text-gray-400 flex items-center">
                  Per Minute <Info size={12} className="ml-1" />
                </span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign size={16} className="text-gray-400" />
                </div>
                <input
                  type="number"
                  name="chatRate"
                  value={rates.chatRate || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center mt-1">
                <input
                  type="checkbox"
                  name="isAvailableForChat"
                  checked={rates.isAvailableForChat}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                />
                <label className="ml-2 text-sm text-gray-300">
                  Available for chat readings
                </label>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="flex justify-between">
                <span className="text-gray-300">Audio Reading Rate</span>
                <span className="text-xs text-gray-400 flex items-center">
                  Per Minute <Info size={12} className="ml-1" />
                </span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign size={16} className="text-gray-400" />
                </div>
                <input
                  type="number"
                  name="audioRate"
                  value={rates.audioRate || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center mt-1">
                <input
                  type="checkbox"
                  name="isAvailableForAudio"
                  checked={rates.isAvailableForAudio}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                />
                <label className="ml-2 text-sm text-gray-300">
                  Available for audio readings
                </label>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="flex justify-between">
                <span className="text-gray-300">Video Reading Rate</span>
                <span className="text-xs text-gray-400 flex items-center">
                  Per Minute <Info size={12} className="ml-1" />
                </span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign size={16} className="text-gray-400" />
                </div>
                <input
                  type="number"
                  name="videoRate"
                  value={rates.videoRate || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center mt-1">
                <input
                  type="checkbox"
                  name="isAvailableForVideo"
                  checked={rates.isAvailableForVideo}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                />
                <label className="ml-2 text-sm text-gray-300">
                  Available for video readings
                </label>
              </div>
            </div>
          </div>
        </div>
        
        {/* Flat rates */}
        <div className="mt-8 mb-6">
          <h3 className="text-lg font-medium text-white mb-4">Flat Rate Sessions</h3>
          <p className="text-gray-400 text-sm mb-4">
            Set prices for scheduled sessions with fixed durations. Leave blank if you don't want to offer a specific duration.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-gray-300">15 Minute Session</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign size={16} className="text-gray-400" />
                </div>
                <input
                  type="number"
                  name="flatRate15Min"
                  value={rates.flatRate15Min || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-gray-300">30 Minute Session</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign size={16} className="text-gray-400" />
                </div>
                <input
                  type="number"
                  name="flatRate30Min"
                  value={rates.flatRate30Min || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-gray-300">45 Minute Session</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign size={16} className="text-gray-400" />
                </div>
                <input
                  type="number"
                  name="flatRate45Min"
                  value={rates.flatRate45Min || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-gray-300">60 Minute Session</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign size={16} className="text-gray-400" />
                </div>
                <input
                  type="number"
                  name="flatRate60Min"
                  value={rates.flatRate60Min || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-8">
          <button
            type="submit"
            disabled={isSaving}
            className={`px-4 py-2 rounded-lg flex items-center ${
              isSaving ? 'bg-gray-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white transition-colors`}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Save Rates
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 