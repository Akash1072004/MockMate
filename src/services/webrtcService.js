import { supabase } from '../lib/supabase';

/**
 * Centralized STUN / TURN Configuration.
 * 
 * Supports:
 * 1. Standard JSON string via VITE_WEBRTC_ICE_SERVERS
 *    e.g. '[{"urls":"stun:stun.l.google.com:19302"},{"urls":["turn:turn.example.com:3478?transport=udp"],"username":"user","credential":"pwd"}]'
 * 2. Comma-separated URL string via VITE_WEBRTC_ICE_SERVERS
 *    e.g. 'stun:stun.l.google.com:19302,turn:turn.example.com:3478'
 * 3. Discrete TURN environment variables:
 *    - VITE_TURN_URL or VITE_TURN_SERVER_URL
 *    - VITE_TURN_USERNAME
 *    - VITE_TURN_CREDENTIAL or VITE_TURN_PASSWORD
 * 4. Fallback Google STUN servers
 */
export function getIceServers() {
  const servers = [];

  // Default Google STUN servers
  const defaultStuns = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  if (typeof window !== 'undefined') {
    const rawEnvIce = import.meta.env?.VITE_WEBRTC_ICE_SERVERS;

    // 1. Try parsing VITE_WEBRTC_ICE_SERVERS
    if (rawEnvIce && typeof rawEnvIce === 'string') {
      const trimmed = rawEnvIce.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          if (list.length > 0) {
            servers.push(...list);
          }
        } catch (err) {
          console.warn('[WebRTC] Failed to parse VITE_WEBRTC_ICE_SERVERS JSON, attempting comma fallback:', err.message);
        }
      } else if (trimmed.length > 0) {
        // Comma-separated list of URLs
        const urls = trimmed.split(',').map((u) => u.trim()).filter(Boolean);
        if (urls.length > 0) {
          servers.push({ urls });
        }
      }
    }

    // 2. Try discrete TURN environment variables
    const turnUrl = import.meta.env?.VITE_TURN_URL || import.meta.env?.VITE_TURN_SERVER_URL;
    const turnUsername = import.meta.env?.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env?.VITE_TURN_CREDENTIAL || import.meta.env?.VITE_TURN_PASSWORD;

    if (turnUrl) {
      const urls = turnUrl.split(',').map((u) => u.trim()).filter(Boolean);
      const turnConfig = { urls };
      if (turnUsername) turnConfig.username = turnUsername;
      if (turnCredential) turnConfig.credential = turnCredential;
      servers.push(turnConfig);
    }
  }

  // If no STUN is included in custom servers, append Google STUN
  const hasStun = servers.some((s) => {
    const u = Array.isArray(s.urls) ? s.urls : [s.urls];
    return u.some((url) => typeof url === 'string' && url.startsWith('stun:'));
  });

  if (!hasStun) {
    servers.unshift(...defaultStuns);
  }

  return servers.length > 0 ? servers : defaultStuns;
}

export function getRtcConfig() {
  const iceServers = getIceServers();
  const hasTurn = iceServers.some((s) => {
    const u = Array.isArray(s.urls) ? s.urls : [s.urls];
    return u.some((url) => typeof url === 'string' && (url.startsWith('turn:') || url.startsWith('turns:')));
  });

  return {
    iceServers,
    iceCandidatePoolSize: 10,
    hasTurnConfigured: hasTurn,
  };
}

export const RTC_CONFIG = {
  get iceServers() {
    return getIceServers();
  },
  iceCandidatePoolSize: 10,
};

/**
 * User-friendly error message generator for getUserMedia errors.
 */
export function mapMediaError(err) {
  if (!err) return 'Unknown media error occurred.';
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'Camera and microphone access was denied. Please enable camera and microphone permissions in your browser address bar and try again.';
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'No camera or microphone was detected. Please check that your input devices are connected.';
  }
  if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
    return 'Your camera or microphone is currently being used by another application. Please close any other video tools and try again.';
  }
  if (err.name === 'OverconstrainedError') {
    return 'Camera resolution requested is not supported by your hardware.';
  }
  if (err.name === 'SecurityError') {
    return 'Media devices require a secure context (HTTPS or localhost).';
  }
  return err.message || 'Could not access camera or microphone.';
}

/**
 * WebRTCManager
 * Handles peer connection lifecycle, deterministic signaling roles (Interviewer = Initiator),
 * ICE candidate exchange with robust queuing, and local/remote MediaStream bindings.
 */
export class WebRTCManager {
  constructor({
    interviewId,
    userId,
    userRole = 'candidate', // 'interviewer' | 'candidate'
    onRemoteStream,
    onConnectionStateChange,
    onPeerMediaStateChange,
    onSignalingStateChange,
  }) {
    this.interviewId = interviewId;
    this.userId = userId;
    this.userRole = userRole;
    this.isInitiator = userRole === 'interviewer';
    this.isPolite = userRole === 'candidate';

    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onPeerMediaStateChange = onPeerMediaStateChange;
    this.onSignalingStateChange = onSignalingStateChange;

    this.peerConnection = null;
    this.channel = null;
    this.localStream = null;
    this.remoteStream = null;
    this.screenStream = null;
    this.pendingCandidates = [];
    this.gatheredCandidateTypes = new Set();

    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
    this.isCleanedUp = false;
    this.readinessPulseTimer = null;
  }

  /**
   * Request local camera & microphone media stream with quality constraints.
   */
  async initLocalMedia({ video = true, audio = true } = {}) {
    if (this.isCleanedUp) return null;

    console.log('[WebRTC] getUserMedia', { video, audio });
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 24, max: 30 } } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
      });

      this.logStreamDetails(this.localStream);

      if (this.peerConnection && this.localStream) {
        this.attachLocalTracksToPeerConnection();
      }

      return this.localStream;
    } catch (err) {
      console.warn('[WebRTC] getUserMedia standard constraints failed, attempting fallback:', err.name);
      try {
        // Fallback 1: basic video + audio
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        this.logStreamDetails(this.localStream);
        if (this.peerConnection && this.localStream) {
          this.attachLocalTracksToPeerConnection();
        }
        return this.localStream;
      } catch (fb1Err) {
        console.warn('[WebRTC] Fallback 1 failed, attempting audio-only fallback:', fb1Err.name);
        try {
          // Fallback 2: Audio-only if camera is blocked/in-use/missing
          this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          this.logStreamDetails(this.localStream);
          if (this.peerConnection && this.localStream) {
            this.attachLocalTracksToPeerConnection();
          }
          return this.localStream;
        } catch (fb2Err) {
          console.error('[WebRTC] getUserMedia completely failed:', fb2Err);
          throw fb2Err;
        }
      }
    }
  }

  logStreamDetails(stream) {
    if (!stream) {
      console.log('[WebRTC] local stream', null);
      console.log('[WebRTC] audio tracks', []);
      console.log('[WebRTC] video tracks', []);
      return;
    }
    console.log('[WebRTC] local stream', stream.id);
    console.log(
      '[WebRTC] audio tracks',
      stream.getAudioTracks().map((t) => ({ id: t.id, label: t.label, enabled: t.enabled, readyState: t.readyState }))
    );
    console.log(
      '[WebRTC] video tracks',
      stream.getVideoTracks().map((t) => ({ id: t.id, label: t.label, enabled: t.enabled, readyState: t.readyState }))
    );
  }

  /**
   * Attach local tracks to the RTCPeerConnection.
   * Ensures tracks are added BEFORE any offer is generated.
   */
  attachLocalTracksToPeerConnection() {
    if (!this.peerConnection || !this.localStream) return;

    const existingSenders = this.peerConnection.getSenders();
    let count = 0;
    this.localStream.getTracks().forEach((track) => {
      const alreadyAdded = existingSenders.some((s) => s.track && s.track.id === track.id);
      if (!alreadyAdded) {
        try {
          this.peerConnection.addTrack(track, this.localStream);
          count++;
        } catch (err) {
          console.warn('[WebRTC] Error adding track to peer connection:', err);
        }
      }
    });
    if (count > 0) {
      console.log('[WebRTC] tracks added', count);
    }
  }

  /**
   * Initialize Supabase Realtime signaling channel isolated to this interview.
   */
  initSignaling() {
    if (!supabase || !this.interviewId || this.isCleanedUp) return;

    const channelName = 'interview_webrtc_' + this.interviewId;
    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || payload.senderId === this.userId || this.isCleanedUp) return;

        try {
          switch (payload.type) {
            case 'ready':
              console.log('[WebRTC] Peer announced readiness (' + (payload.senderRole || 'peer') + ')');
              if (this.isInitiator && !this.makingOffer) {
                // If peer connection was closed or stuck, reset it cleanly
                if (!this.peerConnection || this.peerConnection.connectionState === 'failed' || this.peerConnection.connectionState === 'closed') {
                  await this.createPeerConnection();
                }
                if (this.peerConnection.signalingState === 'stable') {
                  console.log('[WebRTC] Initiating offer as interviewer...');
                  await this.sendOffer();
                }
              } else if (!this.isInitiator) {
                this.broadcastSignal({ type: 'ack-ready', role: this.userRole });
              }
              break;

            case 'ack-ready':
              console.log('[WebRTC] Received ack-ready from peer (' + (payload.role || 'peer') + ')');
              if (this.isInitiator && !this.makingOffer) {
                if (!this.peerConnection || this.peerConnection.connectionState === 'failed' || this.peerConnection.connectionState === 'closed') {
                  await this.createPeerConnection();
                }
                if (this.peerConnection.signalingState === 'stable') {
                  console.log('[WebRTC] Generating offer following ack-ready...');
                  await this.sendOffer();
                }
              }
              break;

            case 'offer':
              console.log('[WebRTC] offer received', { sdpType: payload.sdp?.type });
              await this.handleOffer(payload.sdp);
              break;

            case 'answer':
              console.log('[WebRTC] answer received', { sdpType: payload.sdp?.type });
              await this.handleAnswer(payload.sdp);
              break;

            case 'ice-candidate':
              if (payload.candidate) {
                await this.handleCandidate(payload.candidate);
              }
              break;

            case 'request-ice-restart':
              console.log('[WebRTC] Received request-ice-restart from peer');
              if (this.isInitiator && !this.isCleanedUp) {
                await this.restartIce();
              }
              break;

            case 'media-state':
              if (this.onPeerMediaStateChange && payload.state) {
                this.onPeerMediaStateChange(payload.state);
              }
              break;

            case 'leave':
              console.log('[WebRTC] Peer left the session.');
              this.handlePeerLeft();
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('[WebRTC] Error handling signal payload:', err);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !this.isCleanedUp) {
          console.log('[WebRTC] signaling state: subscribed (as ' + this.userRole + ')');
          if (this.onSignalingStateChange) this.onSignalingStateChange('subscribed');
          this.broadcastSignal({ type: 'ready', role: this.userRole });

          // Start readiness beacon pulse until connected
          this.startReadinessPulse();
        }
      });
  }

  startReadinessPulse() {
    this.stopReadinessPulse();
    this.readinessPulseTimer = setInterval(() => {
      if (this.isCleanedUp) {
        this.stopReadinessPulse();
        return;
      }
      const connState = this.peerConnection?.connectionState;
      if (connState === 'connected') {
        this.stopReadinessPulse();
        return;
      }
      // Broadcast ready pulse to unstick missed signaling handshakes
      this.broadcastSignal({ type: 'ready', role: this.userRole, pulse: true });
    }, 3000);
  }

  stopReadinessPulse() {
    if (this.readinessPulseTimer) {
      clearInterval(this.readinessPulseTimer);
      this.readinessPulseTimer = null;
    }
  }

  /**
   * Create RTCPeerConnection and wire up event listeners.
   */
  async createPeerConnection() {
    if (this.peerConnection) return this.peerConnection;

    const rtcConfig = getRtcConfig();
    console.log('[WebRTC] peer connection created', {
      turnConfigured: rtcConfig.hasTurnConfigured,
      serverCount: rtcConfig.iceServers.length,
    });
    this.peerConnection = new RTCPeerConnection(rtcConfig);

    // Monitor connection states
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'disconnected';
      console.log('[WebRTC] connection state', state);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
      if (state === 'connected') {
        this.stopReadinessPulse();
        this.logActiveCandidatePair();
      } else if (state === 'failed') {
        if (this.isInitiator && !this.isCleanedUp) {
          console.log('[WebRTC] Connection failed. Initiating restart...');
          this.restartIce();
        } else if (!this.isInitiator && !this.isCleanedUp) {
          this.broadcastSignal({ type: 'request-ice-restart' });
        }
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState || 'disconnected';
      console.log('[WebRTC] ICE connection state', iceState);
      if (iceState === 'connected' || iceState === 'completed') {
        if (this.onConnectionStateChange) this.onConnectionStateChange('connected');
        this.stopReadinessPulse();
        this.logActiveCandidatePair();
      } else if (iceState === 'failed') {
        const types = Array.from(this.gatheredCandidateTypes);
        console.warn('[WebRTC] ICE connection state: failed. Gathered types:', types);
        if (!this.gatheredCandidateTypes.has('relay')) {
          console.warn('[WebRTC] Diagnosis: No relay candidates gathered. If peers are behind Symmetric NAT, 4G/5G mobile hotspot, or firewall, direct P2P (STUN) fails. Configure TURN server via VITE_WEBRTC_ICE_SERVERS or VITE_TURN_URL.');
        }

        if (this.onConnectionStateChange) this.onConnectionStateChange('failed');
        if (this.isInitiator && !this.isCleanedUp) {
          console.log('[WebRTC] ICE failed. Attempting ICE restart...');
          this.restartIce();
        } else if (!this.isInitiator && !this.isCleanedUp) {
          this.broadcastSignal({ type: 'request-ice-restart' });
        }
      } else if (iceState === 'disconnected') {
        if (this.onConnectionStateChange) this.onConnectionStateChange('disconnected');
      }
    };

    this.peerConnection.onsignalingstatechange = () => {
      const sigState = this.peerConnection?.signalingState || 'closed';
      console.log('[WebRTC] signaling state', sigState);
      if (this.onSignalingStateChange) this.onSignalingStateChange(sigState);
    };

    // Handle outgoing ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate) {
        const candStr = event.candidate.candidate;
        const typeMatch = candStr.match(/typ\s+(host|srflx|prflx|relay)/i);
        const candidateType = typeMatch ? typeMatch[1].toLowerCase() : event.candidate.type || 'unknown';
        this.gatheredCandidateTypes.add(candidateType);

        console.log('[WebRTC] ICE candidate', {
          direction: 'outgoing',
          type: candidateType,
          protocol: event.candidate.protocol,
          address: event.candidate.address || event.candidate.ip,
          port: event.candidate.port,
        });

        this.broadcastSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Renegotiation handler
    this.peerConnection.onnegotiationneeded = async () => {
      try {
        if (this.isInitiator && !this.makingOffer && !this.isCleanedUp) {
          await this.sendOffer();
        }
      } catch (err) {
        console.warn('[WebRTC] Renegotiation error:', err);
      }
    };

    // Handle incoming remote media tracks
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] remote track', {
        kind: event.track?.kind,
        id: event.track?.id,
        enabled: event.track?.enabled,
        readyState: event.track?.readyState,
        muted: event.track?.muted,
      });

      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      let hasNewTrack = false;

      if (event.track) {
        const alreadyInStream = this.remoteStream.getTracks().some((t) => t.id === event.track.id);
        if (!alreadyInStream) {
          this.remoteStream.addTrack(event.track);
          hasNewTrack = true;
        }

        event.track.onunmute = () => {
          console.log('[WebRTC] remote track unmuted', event.track.kind);
          if (this.onRemoteStream && this.remoteStream) {
            this.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
          }
        };

        event.track.onended = () => {
          console.log('[WebRTC] remote track ended', event.track.kind);
          if (this.onRemoteStream && this.remoteStream) {
            this.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
          }
        };
      }

      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!this.remoteStream.getTracks().some((t) => t.id === track.id)) {
            this.remoteStream.addTrack(track);
            hasNewTrack = true;
          }
        });
      }

      if (hasNewTrack && this.onRemoteStream) {
        this.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
      }
    };

    // Attach local media tracks BEFORE offer/answer
    this.attachLocalTracksToPeerConnection();

    return this.peerConnection;
  }

  /**
   * Log selected candidate pair on connection.
   */
  async logActiveCandidatePair() {
    if (!this.peerConnection) return;
    try {
      const stats = await this.peerConnection.getStats();
      let selectedPair = null;
      stats.forEach((report) => {
        if (report.type === 'transport' && report.selectedCandidatePairId) {
          selectedPair = stats.get(report.selectedCandidatePairId);
        } else if (report.type === 'candidate-pair' && (report.selected || report.state === 'succeeded')) {
          selectedPair = report;
        }
      });

      if (selectedPair) {
        const localCand = stats.get(selectedPair.localCandidateId);
        const remoteCand = stats.get(selectedPair.remoteCandidateId);
        console.log('[WebRTC] Active candidate pair:', {
          localType: localCand?.candidateType,
          remoteType: remoteCand?.candidateType,
          isRelayed: localCand?.candidateType === 'relay' || remoteCand?.candidateType === 'relay',
          localAddress: localCand ? `${localCand.protocol}://${localCand.address || localCand.ip}:${localCand.port}` : 'unknown',
          remoteAddress: remoteCand ? `${remoteCand.protocol}://${remoteCand.address || remoteCand.ip}:${remoteCand.port}` : 'unknown',
        });
      }
    } catch (e) {}
  }

  /**
   * Send SDP Offer (initiator)
   */
  async sendOffer() {
    if (this.isCleanedUp) return;
    if (!this.peerConnection) await this.createPeerConnection();

    try {
      this.makingOffer = true;
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      if (this.peerConnection.signalingState !== 'stable') return;

      await this.peerConnection.setLocalDescription(offer);
      console.log('[WebRTC] offer', {
        type: this.peerConnection.localDescription.type,
        sdpLength: this.peerConnection.localDescription.sdp?.length,
      });

      this.broadcastSignal({
        type: 'offer',
        sdp: this.peerConnection.localDescription,
      });
    } catch (err) {
      console.error('[WebRTC] Error creating or sending offer:', err);
    } finally {
      this.makingOffer = false;
    }
  }

  /**
   * Handle incoming SDP Offer and send SDP Answer (responder)
   */
  async handleOffer(sdp) {
    if (this.isCleanedUp) return;
    if (!this.peerConnection) await this.createPeerConnection();

    const offerCollision =
      this.makingOffer || this.peerConnection.signalingState !== 'stable';

    this.ignoreOffer = !this.isPolite && offerCollision;
    if (this.ignoreOffer) {
      console.warn('[WebRTC] Impolite peer: ignoring incoming colliding offer');
      return;
    }

    try {
      if (offerCollision) {
        await Promise.all([
          this.peerConnection.setLocalDescription({ type: 'rollback' }),
          this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp)),
        ]);
      } else {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      }
      console.log('[WebRTC] remote description', {
        type: this.peerConnection.remoteDescription?.type,
        signalingState: this.peerConnection.signalingState,
      });

      await this.drainPendingCandidates();
      this.attachLocalTracksToPeerConnection();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('[WebRTC] answer', {
        type: this.peerConnection.localDescription.type,
        sdpLength: this.peerConnection.localDescription.sdp?.length,
      });

      this.broadcastSignal({
        type: 'answer',
        sdp: this.peerConnection.localDescription,
      });
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
    }
  }

  /**
   * Handle incoming SDP Answer
   */
  async handleAnswer(sdp) {
    if (this.isCleanedUp || !this.peerConnection) return;

    try {
      this.isSettingRemoteAnswerPending = true;
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log('[WebRTC] remote description', {
        type: this.peerConnection.remoteDescription?.type,
        signalingState: this.peerConnection.signalingState,
      });
      await this.drainPendingCandidates();
    } catch (err) {
      console.error('[WebRTC] Error handling answer:', err);
    } finally {
      this.isSettingRemoteAnswerPending = false;
    }
  }

  /**
   * Handle incoming ICE candidate with queuing support.
   */
  async handleCandidate(candidate) {
    if (this.isCleanedUp || !candidate || !candidate.candidate) return;

    const candStr = candidate.candidate;
    const typeMatch = candStr.match(/typ\s+(host|srflx|prflx|relay)/i);
    const candidateType = typeMatch ? typeMatch[1].toLowerCase() : candidate.type || 'unknown';

    console.log('[WebRTC] ICE candidate', {
      direction: 'incoming',
      type: candidateType,
      protocol: candidate.protocol,
    });

    try {
      const iceCandidate = new RTCIceCandidate(candidate);

      if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        await this.peerConnection.addIceCandidate(iceCandidate);
      } else {
        console.log('[WebRTC] Queued ICE candidate (waiting for remote description)');
        this.pendingCandidates.push(iceCandidate);
      }
    } catch (err) {
      if (!this.ignoreOffer) {
        console.warn('[WebRTC] Failed to add candidate:', err);
      }
    }
  }

  /**
   * Flush queued candidates once remote description is ready.
   */
  async drainPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    if (this.pendingCandidates.length > 0) {
      console.log('[WebRTC] Draining ' + this.pendingCandidates.length + ' queued ICE candidate(s)');
    }

    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (err) {
        console.warn('[WebRTC] Failed to add drained candidate:', err);
      }
    }
  }

  /**
   * Perform ICE restart if connection failed.
   */
  async restartIce() {
    if (!this.peerConnection || this.isCleanedUp) return;
    try {
      this.makingOffer = true;
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      console.log('[WebRTC] offer', {
        type: 'ice-restart',
        sdpLength: this.peerConnection.localDescription.sdp?.length,
      });
      this.broadcastSignal({
        type: 'offer',
        sdp: this.peerConnection.localDescription,
      });
    } catch (err) {
      console.warn('[WebRTC] Failed to restart ICE:', err);
    } finally {
      this.makingOffer = false;
    }
  }

  /**
   * Toggle local camera track on/off without destroying peer connection.
   */
  toggleCamera(enabled) {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled;
      this.broadcastMediaState({ camera: enabled });
      return enabled;
    }
    return false;
  }

  /**
   * Toggle local microphone track on/off without destroying peer connection.
   */
  toggleMic(enabled) {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled;
      this.broadcastMediaState({ mic: enabled });
      return enabled;
    }
    return false;
  }

  /**
   * Toggle screen sharing
   */
  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = this.screenStream.getVideoTracks()[0];

      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }
      }

      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      this.broadcastMediaState({ screenSharing: true });
      return this.screenStream;
    } catch (err) {
      console.warn('[WebRTC] Screen share failed or cancelled:', err);
      return null;
    }
  }

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    if (this.peerConnection && this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      const senders = this.peerConnection.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender && videoTrack) {
        await videoSender.replaceTrack(videoTrack);
      }
    }

    this.broadcastMediaState({ screenSharing: false });
  }

  /**
   * Broadcast media state (camera on/off, mic on/off, screen sharing) to remote peer.
   */
  broadcastMediaState(state) {
    this.broadcastSignal({
      type: 'media-state',
      state,
    });
  }

  /**
   * Broadcast signaling packet over isolated Supabase channel.
   */
  broadcastSignal(data) {
    if (!this.channel || this.isCleanedUp) return;
    try {
      this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          senderId: this.userId,
          senderRole: this.userRole,
          ...data,
        },
      });
    } catch (err) {
      console.warn('[WebRTC] Broadcast send error:', err);
    }
  }

  handlePeerLeft() {
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange('disconnected');
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = null;
    if (this.onRemoteStream) {
      this.onRemoteStream(null);
    }
  }

  /**
   * Complete clean teardown.
   * Stops all local tracks, closes connection, and releases hardware resources.
   */
  cleanup() {
    this.isCleanedUp = true;
    this.stopReadinessPulse();
    this.broadcastSignal({ type: 'leave' });

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
      this.screenStream = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }

    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch (e) {}
      this.channel = null;
    }
  }
}
