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

  const initWebRTC = useCallback(async () => {
    if (!interviewId || !userId || !enabled) return;
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
      if (stream) {
        setLocalStream(stream);
        setPermissionStatus('granted');
        setPermissionError('');
      }
    } catch (err) {
      console.error('[useWebRTC] Permission error:', err);
      setPermissionStatus(err.name === 'NotAllowedError' ? 'denied' : 'error');
      setPermissionError(mapMediaError(err));
    }

    // Connect to isolated Supabase signaling channel
    manager.initSignaling();
    isInitializingRef.current = false;
  }, [interviewId, userId, userRole, enabled]);

  useEffect(() => {
    initWebRTC();

    return () => {
      if (managerRef.current) {
        managerRef.current.cleanup();
        managerRef.current = null;
      }
      setLocalStream(null);
      setRemoteStream(null);
      setConnectionState('idle');
    };
  }, [initWebRTC]);

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
      await initWebRTC();
      return;
    }
    try {
      const stream = await managerRef.current.initLocalMedia({ video: true, audio: true });
      if (stream) {
        setLocalStream(stream);
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
    stop,
    cleanup: stop,
    requestMediaPermissions,
    reconnect: initWebRTC,
  };
}
