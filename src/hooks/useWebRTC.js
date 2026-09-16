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
  const userRoleRef = useRef(userRole);

  // Keep userRoleRef up-to-date without recreating connection
  useEffect(() => {
    userRoleRef.current = userRole;
    if (managerRef.current) {
      managerRef.current.userRole = userRole;
      managerRef.current.isInitiator = userRole === 'interviewer';
      managerRef.current.isPolite = userRole === 'candidate';
    }
  }, [userRole]);

  /**
   * Centralized cleanup function: stops all hardware media tracks,
   * closes RTCPeerConnection, removes Supabase signaling channel.
   */
  const stopMediaAndConnection = useCallback(() => {
    isTeardownDoneRef.current = true;
    isInitializingRef.current = false;

    // Collect all local streams to ensure complete hardware release
    const streamsToStop = [
      localStreamRef.current,
      managerRef.current?.localStream,
      managerRef.current?.screenStream,
    ].filter(Boolean);

    streamsToStop.forEach((stream) => {
      try {
        if (typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track) => {
            try {
              track.enabled = false;
              track.stop();
            } catch (_) {}
          });
        }
      } catch (_) {}
    });

    if (managerRef.current) {
      try {
        managerRef.current.cleanup();
      } catch (_) {}
      managerRef.current = null;
    }

    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);

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

    setIsCameraOn(false);
    setIsMicOn(false);
    setIsScreenSharing(false);
    setConnectionState('disconnected');
    setSignalingState('idle');
  }, []);

  const initWebRTC = useCallback(async () => {
    if (!interviewId || !userId || !enabled) return;
    if (isTeardownDoneRef.current) return;
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    // Teardown previous instance if any
    if (managerRef.current) {
      managerRef.current.cleanup();
      managerRef.current = null;
    }

    setConnectionState('connecting');

    const currentRole = userRoleRef.current || userRole;
    const manager = new WebRTCManager({
      interviewId,
      userId,
      userRole: currentRole,
      onRemoteStream: (stream) => {
        console.log('[useWebRTC] Received remote stream update:', stream ? stream.getTracks().map(t => t.kind) : null);
        setRemoteStream(stream);
        if (stream && stream.getTracks().length > 0) {
          setConnectionState('connected');
        }
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

    try {
      const stream = await manager.initLocalMedia({ video: true, audio: true });
      if (stream && !isTeardownDoneRef.current) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsCameraOn(stream.getVideoTracks().length > 0);
        setIsMicOn(stream.getAudioTracks().length > 0);
        setPermissionStatus('granted');
        setPermissionError('');
      } else if (stream && isTeardownDoneRef.current) {
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
      manager.initSignaling();
    }
    isInitializingRef.current = false;
  }, [interviewId, userId, enabled]);

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
        setIsCameraOn(stream.getVideoTracks().length > 0);
        setIsMicOn(stream.getAudioTracks().length > 0);
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
