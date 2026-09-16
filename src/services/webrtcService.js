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

    console.log('[WebRTC] getUserMedia', { video, audio });
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 24, max: 30 } } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
      });

      console.log('[WebRTC] local stream created', this.localStream.getTracks().map((t) => t.kind));

      if (this.peerConnection && this.localStream) {
        this.attachLocalTracksToPeerConnection();
      }

      return this.localStream;
    } catch (err) {
      console.warn('[WebRTC] getUserMedia standard constraints failed, attempting fallback:', err);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('[WebRTC] local stream created (fallback)', this.localStream.getTracks().map((t) => t.kind));
        if (this.peerConnection && this.localStream) {
          this.attachLocalTracksToPeerConnection();
        }
        return this.localStream;
      } catch (fallbackErr) {
        console.error('[WebRTC] getUserMedia failed:', fallbackErr);
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
              if (this.isInitiator && !this.makingOffer && (!this.peerConnection || this.peerConnection.signalingState === 'stable')) {
                console.log('[WebRTC] Initiating offer as interviewer...');
                await this.createPeerConnection();
                await this.sendOffer();
              } else if (!this.isInitiator) {
                this.broadcastSignal({ type: 'ack-ready', role: this.userRole });
              }
              break;

            case 'ack-ready':
              if (this.isInitiator && !this.makingOffer && (!this.peerConnection || this.peerConnection.signalingState === 'stable')) {
                console.log('[WebRTC] Received ack-ready from candidate. Generating offer...');
                await this.createPeerConnection();
                await this.sendOffer();
              }
              break;

            case 'offer':
              console.log('[WebRTC] offer received');
              await this.handleOffer(payload.sdp);
              break;

            case 'answer':
              console.log('[WebRTC] answer received');
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
          console.log('[WebRTC] Subscribed to signaling as ' + this.userRole);
          if (this.onSignalingStateChange) this.onSignalingStateChange('subscribed');
          this.broadcastSignal({ type: 'ready', role: this.userRole });
        }
      });
  }

  /**
   * Create RTCPeerConnection and wire up event listeners.
   */
  async createPeerConnection() {
    if (this.peerConnection) return this.peerConnection;

    console.log('[WebRTC] peer connection created');
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    // Monitor connection states
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'disconnected';
      console.log('[WebRTC] connection state: ' + state);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState || 'disconnected';
      console.log('[WebRTC] ICE connection state: ' + iceState);
      if (iceState === 'connected' || iceState === 'completed') {
        if (this.onConnectionStateChange) this.onConnectionStateChange('connected');
      } else if (iceState === 'failed') {
        if (this.onConnectionStateChange) this.onConnectionStateChange('failed');
        if (this.isInitiator && !this.isCleanedUp) {
          console.log('[WebRTC] ICE failed. Attempting ICE restart...');
          this.restartIce();
        }
      } else if (iceState === 'disconnected') {
        if (this.onConnectionStateChange) this.onConnectionStateChange('disconnected');
      }
    };

    // Handle outgoing ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate) {
        console.log('[WebRTC] ICE candidate sent', event.candidate.candidate.slice(0, 45));
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
      console.log('[WebRTC] remote track received', event.track.kind, event.track.id);

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
        console.log('[WebRTC] remote stream attached', this.remoteStream.getTracks().map((t) => t.kind));
        // Critical: pass a cloned MediaStream reference to trigger React re-render!
        this.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
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
      console.log('[WebRTC] offer created');

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
      console.log('[WebRTC] remote description set');

      await this.drainPendingCandidates();
      this.attachLocalTracksToPeerConnection();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('[WebRTC] answer created');

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
      console.log('[WebRTC] remote description set');
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
    console.log('[WebRTC] ICE candidate received', candidate.candidate.slice(0, 45));

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
      console.log('[WebRTC] ICE restart offer created');
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
