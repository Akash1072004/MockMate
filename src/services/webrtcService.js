import { supabase } from '../lib/supabase';

/**
 * Centralized STUN / TURN Configuration.
 * Defaults to Google STUN servers. Supports optional custom TURN/ICE servers
 * configured via VITE_WEBRTC_ICE_SERVERS without exposing credentials in code.
 */
export function getIceServers() {
  if (typeof window !== 'undefined' && import.meta.env?.VITE_WEBRTC_ICE_SERVERS) {
    try {
      const parsed = JSON.parse(import.meta.env.VITE_WEBRTC_ICE_SERVERS);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('[WebRTC] Failed to parse VITE_WEBRTC_ICE_SERVERS, falling back to public STUN:', err);
    }
  }

  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];
}

export const RTC_CONFIG = {
  iceServers: getIceServers(),
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
    this.isPolite = userRole === 'candidate'; // Polite peer rolls back in case of offer collision

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

    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
    this.isCleanedUp = false;
  }

  /**
   * Request local camera & microphone media stream with quality constraints.
   */
  async initLocalMedia({ video = true, audio = true } = {}) {
    if (this.isCleanedUp) return null;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
      });

      // If peerConnection already exists, attach tracks immediately
      if (this.peerConnection && this.localStream) {
        this.attachLocalTracksToPeerConnection();
      }

      return this.localStream;
    } catch (err) {
      console.warn('[WebRTCManager] Standard media constraints failed, attempting fallback:', err);
      // Fallback: request unconstrained video/audio if ideal constraints failed
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (this.peerConnection && this.localStream) {
          this.attachLocalTracksToPeerConnection();
        }
        return this.localStream;
      } catch (fallbackErr) {
        console.error('[WebRTCManager] Media request failed:', fallbackErr);
        throw fallbackErr;
      }
    }
  }

  /**
   * Attach local tracks to the RTCPeerConnection.
   * Ensures tracks are added BEFORE any offer is generated.
   */
  attachLocalTracksToPeerConnection() {
    if (!this.peerConnection || !this.localStream) return;

    const existingSenders = this.peerConnection.getSenders();
    this.localStream.getTracks().forEach((track) => {
      const alreadyAdded = existingSenders.some((s) => s.track && s.track.id === track.id);
      if (!alreadyAdded) {
        try {
          this.peerConnection.addTrack(track, this.localStream);
        } catch (err) {
          console.warn('[WebRTCManager] Error adding track to peer connection:', err);
        }
      }
    });
  }

  /**
   * Initialize Supabase Realtime signaling channel isolated to this interview.
   */
  initSignaling() {
    if (!supabase || !this.interviewId || this.isCleanedUp) return;

    // Use isolated channel name per interview
    this.channel = supabase.channel(`interview_webrtc_${this.interviewId}`, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || payload.senderId === this.userId || this.isCleanedUp) return;

        try {
          switch (payload.type) {
            case 'ready':
              // Peer announced readiness.
              console.log(`[WebRTC Signaling] Received 'ready' from ${payload.senderRole || 'peer'}.`);
              if (this.isInitiator) {
                console.log('[WebRTC Signaling] As interviewer, initiating offer...');
                await this.createPeerConnection();
                await this.sendOffer();
              } else {
                // As candidate, announce ready back so interviewer knows we are present
                this.broadcastSignal({ type: 'ack-ready', role: this.userRole });
              }
              break;

            case 'ack-ready':
              if (this.isInitiator) {
                console.log('[WebRTC Signaling] Received ack-ready from candidate. Generating offer...');
                await this.createPeerConnection();
                await this.sendOffer();
              }
              break;

            case 'offer':
              console.log('[WebRTC Signaling] Received SDP Offer from peer.');
              await this.handleOffer(payload.sdp);
              break;

            case 'answer':
              console.log('[WebRTC Signaling] Received SDP Answer from peer.');
              await this.handleAnswer(payload.sdp);
              break;

            case 'ice-candidate':
              if (payload.candidate) {
                await this.handleCandidate(payload.candidate);
              }
              break;

            case 'media-state':
              if (this.onPeerMediaStateChange && payload.state) {
                this.onPeerMediaStateChange(payload.state);
              }
              break;

            case 'leave':
              console.log('[WebRTC Signaling] Peer left the session.');
              this.handlePeerLeft();
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('[WebRTC Signaling] Error handling payload:', err);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !this.isCleanedUp) {
          console.log(`[WebRTC Signaling] Subscribed as ${this.userRole}. Announcing ready state...`);
          if (this.onSignalingStateChange) this.onSignalingStateChange('subscribed');
          // Announce readiness over signaling channel
          this.broadcastSignal({ type: 'ready', role: this.userRole });
        }
      });
  }

  /**
   * Create RTCPeerConnection and wire up event listeners.
   */
  async createPeerConnection() {
    if (this.peerConnection) return this.peerConnection;

    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    // Monitor connection states
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'disconnected';
      console.log(`[WebRTC] Connection state: ${state}`);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState || 'disconnected';
      console.log(`[WebRTC] ICE state: ${iceState}`);
      if (iceState === 'connected' || iceState === 'completed') {
        if (this.onConnectionStateChange) this.onConnectionStateChange('connected');
      } else if (iceState === 'failed' || iceState === 'disconnected') {
        if (this.onConnectionStateChange) this.onConnectionStateChange(iceState);
      }
    };

    // Handle outgoing ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate) {
        this.broadcastSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle incoming remote media tracks
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);

      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      // Add track to remote stream if not already present
      const alreadyInStream = this.remoteStream.getTracks().some((t) => t.id === event.track.id);
      if (!alreadyInStream) {
        this.remoteStream.addTrack(event.track);
      }

      if (event.streams && event.streams[0]) {
        // If streams array provides complete stream, sync tracks
        event.streams[0].getTracks().forEach((track) => {
          if (!this.remoteStream.getTracks().some((t) => t.id === track.id)) {
            this.remoteStream.addTrack(track);
          }
        });
      }

      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Attach local media tracks BEFORE offer/answer
    this.attachLocalTracksToPeerConnection();

    return this.peerConnection;
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

    // Check for glare collision (Perfect Negotiation pattern)
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

      // Process any queued ICE candidates that arrived before remote description
      await this.drainPendingCandidates();

      // Ensure local tracks are attached before creating answer
      this.attachLocalTracksToPeerConnection();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

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

    try {
      const iceCandidate = new RTCIceCandidate(candidate);

      if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        await this.peerConnection.addIceCandidate(iceCandidate);
      } else {
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
