import { useState, useEffect, useRef, useCallback } from 'react';
import { WebRTCManager, mapMediaError } from '../services/webrtcService';

export function useWebRTC({ interviewId, userId, userRole = 'candidate', enabled = true }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'disconnected'
  const [signalingState, setSignalingState] = useState('idle');

  const [permissionStatus, setPermissionStatus] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'error'
  const [permissionError, setPermissionError] = useState('');

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [peerMediaState, setPeerMediaState] = useState({
    camera: true,
    mic: true,
    screenSharing: false,
  });

  const managerRef = useRef(null);
  const isInitializingRef = useRef(false);
  const isTeardownDoneRef = useRef(false);
  const localStreamRef = useRef(null);

  /**
   * Centralized cleanup function: stops all hardware media tracks,
   * closes RTCPeerConnection, removes Supabase signaling channel,
   * and prevents reconnect attempts.
   */
  const stopMediaAndConnection = useCallback(() => {
    isTeardownDoneRef.current = true;
    isInitializingRef.current = false;

    // Collect all local streams to ensure complete teardown
    const streamsToStop = [
      localStreamRef.current,
      localStream,
      managerRef.current?.localStream,
      managerRef.current?.screenStream,
    ].filter(Boolean);

    streamsToStop.forEach((stream) => {
      try {
        if (typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track) => {
            try {
              // 3. Disable track before stopping
              track.enabled = false;
              // 1 & 2. Stop track hardware
              track.stop();
            } catch (_) {}
          });
        }
      } catch (_) {}
    });

    // 4 & 5. Remove/close RTCPeerConnection and close Supabase signaling channel
    if (managerRef.current) {
      try {
        managerRef.current.cleanup();
      } catch (_) {}
      managerRef.current = null;
    }

    // 6. Clear localStream
    localStreamRef.current = null;
    setLocalStream(null);

    // 7. Clear remoteStream
    setRemoteStream(null);

    // 8. Clear video elements srcObject across the document
    if (typeof document !== 'undefined') {
      try {
        const videoEls = document.querySelectorAll('video');
        videoEls.forEach((vid) => {
          try {
            if (vid.srcObject) {
              if (typeof vid.srcObject.getTracks === 'function') {
                vid.srcObject.getTracks().forEach((t) => {
                  try {
                    t.enabled = false;
                    t.stop();
                  } catch (_) {}
                });
              }
              vid.srcObject = null;
            }
          } catch (_) {}
        });
      } catch (_) {}
    }

    // 9. Reset camera state
    setIsCameraOn(false);

    // 10. Reset microphone state
    setIsMicOn(false);
    setIsScreenSharing(false);

    // 11. Reset connection state
    setConnectionState('disconnected');
    setSignalingState('idle');
  }, [localStream]);

  const initWebRTC = useCallback(async () => {
    if (!interviewId || !userId || !enabled) return;
    // 12. Prevent reconnect/initialization after completion
    if (isTeardownDoneRef.current) return;
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    // Teardown previous instance if any
    if (managerRef.current) {
      managerRef.current.cleanup();
      managerRef.current = null;
    }

    setConnectionState('connecting');

    // Create WebRTC manager instance with role
    const manager = new WebRTCManager({
      interviewId,
      userId,
      userRole,
      onRemoteStream: (stream) => {
        console.log('[useWebRTC] Received remote stream update:', stream ? stream.getTracks().length : 0);
        setRemoteStream(stream);
        setConnectionState('connected');
      },
      onConnectionStateChange: (state) => {
        setConnectionState(state);
      },
      onSignalingStateChange: (state) => {
        setSignalingState(state);
      },
      onPeerMediaStateChange: (state) => {
        setPeerMediaState((prev) => ({ ...prev, ...state }));
      },
    });

    managerRef.current = manager;

    // Request camera and microphone access
    try {
      const stream = await manager.initLocalMedia({ video: true, audio: true });
      if (stream && !isTeardownDoneRef.current) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsCameraOn(true);
        setIsMicOn(true);
        setPermissionStatus('granted');
        setPermissionError('');
      } else if (stream && isTeardownDoneRef.current) {
        // Guard if completion happened while getUserMedia was resolving
        stream.getTracks().forEach((t) => {
          t.enabled = false;
          t.stop();
        });
      }
    } catch (err) {
      console.error('[useWebRTC] Permission error:', err);
      setPermissionStatus(err.name === 'NotAllowedError' ? 'denied' : 'error');
      setPermissionError(mapMediaError(err));
    }

    if (!isTeardownDoneRef.current) {
      // Connect to isolated Supabase signaling channel
      manager.initSignaling();
    }
    isInitializingRef.current = false;
  }, [interviewId, userId, userRole, enabled]);

  useEffect(() => {
    if (enabled) {
      isTeardownDoneRef.current = false;
      initWebRTC();
    } else {
      stopMediaAndConnection();
    }

    return () => {
      stopMediaAndConnection();
    };
  }, [enabled, initWebRTC, stopMediaAndConnection]);

  const toggleCamera = () => {
    if (!managerRef.current) return;
    const nextState = !isCameraOn;
    managerRef.current.toggleCamera(nextState);
    setIsCameraOn(nextState);
  };

  const toggleMic = () => {
    if (!managerRef.current) return;
    const nextState = !isMicOn;
    managerRef.current.toggleMic(nextState);
    setIsMicOn(nextState);
  };

  const toggleScreenShare = async () => {
    if (!managerRef.current) return;

    if (isScreenSharing) {
      await managerRef.current.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      const stream = await managerRef.current.startScreenShare();
      if (stream) {
        setIsScreenSharing(true);
      }
    }
  };

  const requestMediaPermissions = async () => {
    if (!managerRef.current) {
      isTeardownDoneRef.current = false;
      await initWebRTC();
      return;
    }
    try {
      const stream = await managerRef.current.initLocalMedia({ video: true, audio: true });
      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsCameraOn(true);
        setIsMicOn(true);
        setPermissionStatus('granted');
        setPermissionError('');
      }
    } catch (err) {
      setPermissionStatus(err.name === 'NotAllowedError' ? 'denied' : 'error');
      setPermissionError(mapMediaError(err));
    }
  };

  return {
    localStream,
    remoteStream,
    connectionState,
    signalingState,
    permissionStatus,
    permissionError,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    peerMediaState,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
    stopMediaAndConnection,
    stop: stopMediaAndConnection,
    cleanup: stopMediaAndConnection,
    requestMediaPermissions,
    reconnect: initWebRTC,
  };
}
