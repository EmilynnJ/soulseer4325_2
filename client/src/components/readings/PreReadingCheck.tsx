import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Video, VideoOff, Mic, MicOff, RefreshCw } from 'lucide-react';
import { useWebRTC } from '../../hooks/useWebRTC';

interface PreReadingCheckProps {
  sessionType: 'chat' | 'audio' | 'video';
  userId: number;
  onReady: (devices: {
    audioDevice: string | null;
    videoDevice: string | null;
  }) => void;
  onCancel: () => void;
}

export default function PreReadingCheck({
  sessionType,
  userId,
  onReady,
  onCancel
}: PreReadingCheckProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | null>(null);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize WebRTC for testing devices
  const {
    localStream,
    mediaDevices,
    toggleAudio,
    toggleVideo,
    changeAudioDevice,
    changeVideoDevice,
    initializeLocalStream
  } = useWebRTC({
    sessionType,
    userId,
    autoAcceptCalls: false
  });

  // Set up local video preview
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Initialize devices
  useEffect(() => {
    const init = async () => {
      try {
        await initializeLocalStream();
        
        // If there's at least one device of each type, select the first one
        if (mediaDevices.audio.length > 0) {
          setSelectedAudioDevice(mediaDevices.audio[0].deviceId);
        }
        
        if (sessionType === 'video' && mediaDevices.video.length > 0) {
          setSelectedVideoDevice(mediaDevices.video[0].deviceId);
        }
        
        setIsReady(true);
      } catch (err) {
        console.error('Error initializing devices:', err);
        setError('Failed to access your camera or microphone. Please check your device permissions.');
      }
    };
    
    init();
  }, [initializeLocalStream, mediaDevices, sessionType]);

  // Handle audio device change
  const handleAudioDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedAudioDevice(deviceId);
    await changeAudioDevice(deviceId);
  };

  // Handle video device change
  const handleVideoDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedVideoDevice(deviceId);
    await changeVideoDevice(deviceId);
  };

  // Handle toggling microphone
  const handleToggleMic = () => {
    toggleAudio();
    setIsMicMuted(prev => !prev);
  };

  // Handle toggling camera
  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoEnabled(prev => !prev);
  };

  // Handle continue to session
  const handleContinue = () => {
    onReady({
      audioDevice: selectedAudioDevice,
      videoDevice: sessionType === 'video' ? selectedVideoDevice : null
    });
  };

  // Handle refreshing devices
  const handleRefreshDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: sessionType === 'video' });
      await initializeLocalStream();
    } catch (err) {
      console.error('Error refreshing devices:', err);
      setError('Failed to refresh devices. Please check your permissions.');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-6">Check Your Devices</h2>
      
      {error && (
        <div className="mb-6 p-3 bg-red-900 text-white rounded-lg flex items-start">
          <X className="text-red-300 mr-2 mt-0.5 flex-shrink-0" size={18} />
          <div>
            <p className="font-medium">Device Error</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={handleRefreshDevices}
              className="mt-2 px-3 py-1 bg-red-800 rounded-md flex items-center text-sm hover:bg-red-700"
            >
              <RefreshCw size={14} className="mr-1" /> Try Again
            </button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Device settings */}
        <div className="space-y-6">
          {/* Microphone settings */}
          <div>
            <label className="block text-gray-300 mb-2 font-medium">Microphone</label>
            <select
              value={selectedAudioDevice || ''}
              onChange={handleAudioDeviceChange}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {mediaDevices.audio.length === 0 ? (
                <option value="">No microphones detected</option>
              ) : (
                mediaDevices.audio.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${mediaDevices.audio.indexOf(device) + 1}`}
                  </option>
                ))
              )}
            </select>
            
            <div className="flex justify-between mt-3">
              <div className="flex items-center text-sm">
                <div className={`w-3 h-3 rounded-full mr-2 ${isMicMuted ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <span>{isMicMuted ? 'Muted' : 'Active'}</span>
              </div>
              
              <button
                onClick={handleToggleMic}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300"
              >
                {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
          </div>
          
          {/* Video settings (only for video sessions) */}
          {sessionType === 'video' && (
            <div>
              <label className="block text-gray-300 mb-2 font-medium">Camera</label>
              <select
                value={selectedVideoDevice || ''}
                onChange={handleVideoDeviceChange}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {mediaDevices.video.length === 0 ? (
                  <option value="">No cameras detected</option>
                ) : (
                  mediaDevices.video.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${mediaDevices.video.indexOf(device) + 1}`}
                    </option>
                  ))
                )}
              </select>
              
              <div className="flex justify-between mt-3">
                <div className="flex items-center text-sm">
                  <div className={`w-3 h-3 rounded-full mr-2 ${isVideoEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>{isVideoEnabled ? 'On' : 'Off'}</span>
                </div>
                
                <button
                  onClick={handleToggleVideo}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300"
                >
                  {isVideoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>
          )}
          
          {/* Audio test instructions */}
          <div className="p-3 bg-gray-700 rounded-lg">
            <h3 className="text-white font-medium mb-2">Test Your Audio</h3>
            <p className="text-sm text-gray-300">
              Speak into your microphone to test the audio. Make sure you can hear yourself clearly.
            </p>
          </div>
        </div>
        
        {/* Right column: Video preview */}
        <div className="flex flex-col space-y-4">
          {sessionType === 'video' ? (
            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
              {isVideoEnabled ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <VideoOff size={48} className="text-gray-600" />
                </div>
              )}
              
              {/* Mic indicator */}
              <div className="absolute bottom-2 left-2 flex items-center bg-black bg-opacity-50 px-2 py-1 rounded">
                {isMicMuted ? (
                  <MicOff size={16} className="text-red-500" />
                ) : (
                  <Mic size={16} className="text-green-500" />
                )}
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Mic size={64} className="text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">{sessionType === 'audio' ? 'Audio Only Session' : 'Chat Only Session'}</p>
              </div>
            </div>
          )}
          
          <div className="bg-indigo-900 bg-opacity-40 p-3 rounded-lg">
            <div className="flex items-start">
              <div className="bg-indigo-500 rounded-full p-1 mr-3 mt-0.5">
                <Check size={16} />
              </div>
              <div>
                <h3 className="font-medium text-white">Ready for your reading?</h3>
                <p className="text-sm text-indigo-200 mt-1">
                  Make sure your devices are working properly before continuing to your session.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex justify-end space-x-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleContinue}
          disabled={!isReady || (sessionType === 'video' && !selectedVideoDevice) || !selectedAudioDevice}
          className={`px-4 py-2 rounded-lg text-white flex items-center ${
            !isReady || (sessionType === 'video' && !selectedVideoDevice) || !selectedAudioDevice
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          } transition-colors`}
        >
          <Check size={18} className="mr-2" />
          Continue to Session
        </button>
      </div>
    </div>
  );
} 