import { useEffect, useRef, useState } from 'react';

export class WebRTCClient {
  private userId: number;
  private role: 'client' | 'reader';
  private sessionId: string;
  private peerConnections: Map<number, RTCPeerConnection>;
