import React, { useState, useEffect } from 'react';
import { webrtcClient } from '../services/webrtc-client';
import { useAuth } from '../hooks/useAuth';

const LiveStream = ({ readerId, readerData, onStreamCreated, onError }) => {
  const [loading, setLoading] = useState(false);
  const [streamData, setStreamData] = useState(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamCategory, setStreamCategory] = useState('general');
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const createStream = async () => {
    if (!user || !streamTitle.trim()) {
      setError('Please enter a stream title');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const streamPayload = {
        readerId: user.$id,
        title: streamTitle.trim(),
        description: streamDescription.trim(),
        category: streamCategory,
        readerName: user.name || user.email,
        readerStripeAccountId: user.stripeAccountId
      };

      const response = await webrtcClient.createStream(streamPayload);

      if (response.success && response.stream) {
        setStreamData(response.stream);
        
        // Generate stream URL for streamer
        const streamUrl = webrtcClient.generateStreamUrl(
          response.stream.roomId,
          user.$id,
          'streamer',
          user.name || user.email
        );

        if (onStreamCreated) {
          onStreamCreated({
            stream: response.stream,
            streamUrl,
            roomId: response.stream.roomId
          });
        }

        // Open streaming window
        window.open(streamUrl, '_blank', 'width=1200,height=800');

      } else {
        throw new Error(response.error || 'Failed to create stream');
      }

    } catch (err) {
      console.error('Stream creation error:', err);
      setError(err.message);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  const endStream = async () => {
    if (!streamData?.id) return;

    try {
      // End stream logic would go here
      setStreamData(null);
      setStreamTitle('');
      setStreamDescription('');
    } catch (err) {
      console.error('Error ending stream:', err);
      setError(err.message);
    }
  };

  return (
    <div className="live-stream-controls p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4">Start Live Stream</h3>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}

      {!streamData ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stream Title *
            </label>
            <input
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="Enter your stream title..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={streamDescription}
              onChange={(e) => setStreamDescription(e.target.value)}
              placeholder="Describe what you'll be doing in this stream..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={streamCategory}
              onChange={(e) => setStreamCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="general">General Reading</option>
              <option value="tarot">Tarot Reading</option>
              <option value="astrology">Astrology</option>
              <option value="psychic">Psychic Reading</option>
              <option value="meditation">Meditation</option>
              <option value="spiritual">Spiritual Guidance</option>
            </select>
          </div>

          <button
            onClick={createStream}
            disabled={loading || !streamTitle.trim()}
            className={`w-full py-3 rounded-lg text-white font-semibold ${
              loading || !streamTitle.trim()
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {loading ? 'Starting Stream...' : 'Go Live'}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">🔴 Stream is Live!</h4>
            <p className="text-sm text-green-600">Stream ID: {streamData.roomId}</p>
            <p className="text-sm text-green-600">Title: {streamData.title}</p>
          </div>

          <div className="space-x-3">
            <button
              onClick={() => {
                const streamUrl = webrtcClient.generateStreamUrl(
                  streamData.roomId,
                  user.$id,
                  'streamer',
                  user.name || user.email
                );
                window.open(streamUrl, '_blank', 'width=1200,height=800');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Open Stream Window
            </button>
            
            <button
              onClick={endStream}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              End Stream
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveStream;
