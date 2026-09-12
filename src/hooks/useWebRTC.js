import { useState, useEffect, useRef, useCallback } from 'react';
import { WebRTCManager } from '../services/webrtcService';

export function useWebRTC({ interviewId, userId, enabled = true }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'disconnected'
  
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [peerMediaState, setPeerMediaState] = useState({
    camera: true,
    mic: true,
    screenSharing: false,
  });

  const managerRef = useRef(null);

  const initWebRTC = useCallback(async () => {
    if (!interviewId || !userId || !enabled) return;

    // Create WebRTC manager instance
    const manager = new WebRTCManager({
      interviewId,
      userId,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
      },
      onConnectionStateChange: (state) => {
        setConnectionState(state);
      },
      onPeerMediaStateChange: (state) => {
        setPeerMediaState((prev) => ({ ...prev, ...state }));
      },
    });

    managerRef.current = manager;

    // Get local camera & microphone stream
    const stream = await manager.initLocalMedia({ video: true, audio: true });
    setLocalStream(stream);

    // Initialize Supabase signaling channel
    manager.initSignaling();
  }, [interviewId, userId, enabled]);

  useEffect(() => {
    initWebRTC();

    return () => {
      if (managerRef.current) {
        managerRef.current.cleanup();
        managerRef.current = null;
      }
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

  return {
    localStream,
    remoteStream,
    connectionState,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    peerMediaState,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
    reconnect: initWebRTC,
  };
}
