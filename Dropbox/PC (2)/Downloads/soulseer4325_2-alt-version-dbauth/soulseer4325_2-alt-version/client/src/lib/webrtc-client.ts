import { apiRequest } from './queryClient';

class WebRTCClient {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private readingId: number | null = null;
  private userId: number | null = null;
  private role: 'reader' | 'client' | null = null;
  private socket: any = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;

  // Initialize WebRTC client with socket connection
  public initialize(socket: any) {
    this.socket = socket;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    if (!this.socket) return;

    // Handle incoming offers
    this.socket.on('offer', async (data: any) => {
      try {
        const { offer, from } = data;
        
        if (!this.peerConnection) {
          await this.createPeerConnection();
        }
        
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Create answer
        const answer = await this.peerConnection?.createAnswer();
        await this.peerConnection?.setLocalDescription(answer);
        
        // Send answer back
        this.socket.emit('answer', {
          target: from,
          answer
        });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    // Handle incoming answers
    this.socket.on('answer', async (data: any) => {
      try {
        const { answer } = data;
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    // Handle ICE candidates
    this.socket.on('ice_candidate', async (data: any) => {
      try {
        const { candidate } = data;
        if (candidate && this.peerConnection) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    });

    // Handle user joined event
    this.socket.on('user_joined', (data: any) => {
      console.log('User joined:', data);
      // If we're the reader and a client joined, initiate the call
      if (this.role === 'reader' && data.role === 'client') {
        this.initiateCall();
      }
    });

    // Handle joined reading confirmation
    this.socket.on('joined_reading', (data: any) => {
      console.log('Successfully joined reading:', data);
    });
  }

  // Join a reading session
  public async joinReading(readingId: number, userId: number, role: 'reader' | 'client'): Promise<void> {
    this.readingId = readingId;
    this.userId = userId;
    this.role = role;
    
    if (!this.socket) {
      throw new Error('Socket not initialized');
    }
    
    // Join the reading room
    this.socket.emit('join_reading', {
      readingId,
      userId,
      role
    });
    
    // Notify server that we're starting the WebRTC session
    await apiRequest('POST', `/api/webrtc/start/${readingId}`);
  }

  // Start local media stream
  public async startLocalStream(video: boolean, audio: boolean): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video,
        audio
      });
      
      return this.localStream;
    } catch (error) {
      console.error('Error getting user media:', error);
      throw error;
    }
  }

  // Create peer connection
  private async createPeerConnection(): Promise<void> {
    try {
      // Get ICE servers configuration
      const response = await apiRequest('GET', `/api/webrtc/config/${this.readingId}`);
      const config = await response.json();
      
      this.peerConnection = new RTCPeerConnection({
        iceServers: config.iceServers
      });
      
      // Add local tracks to peer connection
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection?.addTrack(track, this.localStream!);
        });
      }
      
      // Set up remote stream
      this.remoteStream = new MediaStream();
      
      // Handle incoming tracks
      this.peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream?.addTrack(track);
        });
        
        if (this.onRemoteStreamCallback && this.remoteStream) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      };
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('ice_candidate', {
            target: this.role === 'reader' ? 'client' : 'reader',
            candidate: event.candidate
          });
        }
      };
      
      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        if (this.onConnectionStateChangeCallback) {
          this.onConnectionStateChangeCallback(this.peerConnection!.connectionState);
        }
      };
    } catch (error) {
      console.error('Error creating peer connection:', error);
      throw error;
    }
  }

  // Initiate call (for reader)
  public async initiateCall(): Promise<void> {
    try {
      if (!this.peerConnection) {
        await this.createPeerConnection();
      }
      
      // Create offer
      const offer = await this.peerConnection?.createOffer();
      await this.peerConnection?.setLocalDescription(offer);
      
      // Send offer to client
      this.socket.emit('offer', {
        target: 'client',
        offer
      });
    } catch (error) {
      console.error('Error initiating call:', error);
      throw error;
    }
  }

  // Accept call (for client)
  public async acceptCall(): Promise<void> {
    try {
      if (!this.peerConnection) {
        await this.createPeerConnection();
      }
      
      // Wait for offer from reader
      console.log('Waiting for offer from reader...');
    } catch (error) {
      console.error('Error accepting call:', error);
      throw error;
    }
  }

  // End call
  public endCall(): void {
    // Notify server
    if (this.socket && this.readingId) {
      this.socket.emit('end_call', {
        readingId: this.readingId
      });
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Reset state
    this.remoteStream = null;
    this.readingId = null;
    this.userId = null;
    this.role = null;
  }

  // Toggle video
  public toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
      }
    }
  }

  // Toggle audio
  public toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
      }
    }
  }

  // Set callback for remote stream
  public onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
    
    // If remote stream already exists, call the callback immediately
    if (this.remoteStream) {
      callback(this.remoteStream);
    }
  }

  // Set callback for connection state changes
  public onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateChangeCallback = callback;
    
    // If peer connection already exists, call the callback with current state
    if (this.peerConnection) {
      callback(this.peerConnection.connectionState);
    }
  }
}

export const webRTCClient = new WebRTCClient();