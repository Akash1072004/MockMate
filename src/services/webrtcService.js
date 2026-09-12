import { supabase } from '../lib/supabase';

/**
 * WebRTC Service for peer-to-peer audio, video, and screen sharing.
 * Uses public Google STUN servers for NAT traversal and Supabase Realtime
 * broadcast channels for signaling (offer, answer, ICE candidates, media state).
 */

export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  constructor({ interviewId, userId, onRemoteStream, onConnectionStateChange, onPeerMediaStateChange }) {
    this.interviewId = interviewId;
    this.userId = userId;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onPeerMediaStateChange = onPeerMediaStateChange;

    this.peerConnection = null;
    this.channel = null;
    this.localStream = null;
    this.screenStream = null;
    this.pendingCandidates = [];
    this.isInitiator = false;
  }

  // Initialize local media stream
  async initLocalMedia({ video = true, audio = true } = {}) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false,
        audio: audio,
      });
      return this.localStream;
    } catch (err) {
      console.warn('[WebRTCManager] Failed to get user media:', err);
      // Fallback: try audio only if camera is unavailable or denied
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        return this.localStream;
      } catch (audioErr) {
        console.error('[WebRTCManager] Microphone also denied:', audioErr);
        // Create an empty dummy audio stream if both are unavailable so signaling doesn't crash
        this.localStream = new MediaStream();
        return this.localStream;
      }
    }
  }

  // Connect to Supabase Realtime signaling channel
  initSignaling() {
    if (!supabase || !this.interviewId) return;

    this.channel = supabase.channel(`interview_webrtc_${this.interviewId}`, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || payload.senderId === this.userId) return;

        try {
          switch (payload.type) {
            case 'join':
              // A peer announced presence. If we already exist, become initiator and send offer
              console.log('[WebRTC Signaling] Peer joined room. Sending offer...');
              this.isInitiator = true;
              await this.createPeerConnection();
              await this.sendOffer();
              break;

            case 'offer':
              console.log('[WebRTC Signaling] Received SDP Offer from peer.');
              this.isInitiator = false;
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
              if (this.onPeerMediaStateChange) {
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
        if (status === 'SUBSCRIBED') {
          console.log('[WebRTC Signaling] Channel subscribed. Announcing join...');
          this.broadcastSignal({ type: 'join' });
        }
      });
  }

  // Create RTCPeerConnection and attach local media tracks
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
      console.log(`[WebRTC] ICE state: ${this.peerConnection?.iceConnectionState}`);
    };

    // Handle outgoing ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.broadcastSignal({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    // Handle incoming remote media tracks
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        if (this.onRemoteStream) {
          this.onRemoteStream(event.streams[0]);
        }
      }
    };

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    return this.peerConnection;
  }

  // Send SDP Offer
  async sendOffer() {
    if (!this.peerConnection) await this.createPeerConnection();

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(offer);

    this.broadcastSignal({
      type: 'offer',
      sdp: offer,
    });
  }

  // Handle SDP Offer and send SDP Answer
  async handleOffer(sdp) {
    if (!this.peerConnection) await this.createPeerConnection();

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

    // Process any queued candidates
    await this.drainPendingCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.broadcastSignal({
      type: 'answer',
      sdp: answer,
    });
  }

  // Handle SDP Answer
  async handleAnswer(sdp) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.drainPendingCandidates();
  }

  // Handle ICE Candidate
  async handleCandidate(candidate) {
    const iceCandidate = new RTCIceCandidate(candidate);
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      await this.peerConnection.addIceCandidate(iceCandidate);
    } else {
      this.pendingCandidates.push(iceCandidate);
    }
  }

  // Drain queued candidates once remote description is set
  async drainPendingCandidates() {
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (err) {
        console.warn('[WebRTC] Failed to add drained candidate:', err);
      }
    }
  }

  // Toggle Camera
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

  // Toggle Microphone
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

  // Toggle Screen Share
  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = this.screenStream.getVideoTracks()[0];

      // Replace current video sender with screen track
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

    // Revert video sender back to local camera track
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

  // Broadcast media status (mic, camera, screen sharing) to peer
  broadcastMediaState(state) {
    this.broadcastSignal({
      type: 'media-state',
      state,
    });
  }

  // Broadcast signaling message over Supabase channel
  broadcastSignal(data) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        senderId: this.userId,
        ...data,
      },
    });
  }

  handlePeerLeft() {
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange('disconnected');
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.onRemoteStream) {
      this.onRemoteStream(null);
    }
  }

  // Clean teardown
  cleanup() {
    this.broadcastSignal({ type: 'leave' });

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
