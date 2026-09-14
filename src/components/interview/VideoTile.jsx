import React, { useRef, useEffect, useState, useCallback } from 'react';
import { VideoOff, Mic, MicOff, Volume2, User, Monitor } from 'lucide-react';

/**
 * VideoTile: Reliable WebRTC Video Renderer
 * Handles robust MediaStream binding via ref callbacks, local echo muting,
 * remote audio autoplay unblocking, persistent element lifecycle (never unmounted
 * on camera off to maintain audio playback), and clean Camera Off placeholders.
 */
export default function VideoTile({
  stream,
  isLocal = false,
  isCameraOn = true,
  isMicOn = true,
  isScreenSharing = false,
  participantName = 'Participant',
  role = 'candidate', // 'interviewer' | 'candidate'
  height = '160px',
  waitingMessage = 'Waiting for peer...',
}) {
  const videoElRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Attempt to play the video element safely
  const attemptPlay = useCallback((el) => {
    if (!el) return;
    el.play()
      .then(() => {
        setAutoplayBlocked(false);
      })
      .catch((err) => {
        console.warn('[VideoTile] Video play prevented:', err);
        if (!isLocal && err.name === 'NotAllowedError') {
          setAutoplayBlocked(true);
        }
      });
  }, [isLocal]);

  // Callback ref: Guaranteed to fire the instant the <video> DOM element mounts or remounts
  const setVideoRef = useCallback((el) => {
    videoElRef.current = el;
    if (el) {
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
        attemptPlay(el);
      }
    }
  }, [stream, attemptPlay]);

  // Update stream on the mounted video element whenever the stream reference updates
  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;

    if (stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      attemptPlay(el);
    } else {
      el.srcObject = null;
    }
  }, [stream, attemptPlay]);

  const handleEnableAudio = () => {
    const el = videoElRef.current;
    if (el) {
      el.play()
        .then(() => setAutoplayBlocked(false))
        .catch((err) => console.error('[VideoTile] User play gesture failed:', err));
    }
  };

  const hasVideoStream = Boolean(stream && isCameraOn && stream.getVideoTracks().length > 0);

  return (
    <div
      style={{
        height,
        background: '#0f172a',
        borderRadius: 'var(--radius-md)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      }}
    >
      {/* Video Element: ALWAYS kept mounted in DOM so audio tracks play continuously */}
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted={isLocal} // MUST be muted for local to prevent acoustic feedback/echo
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: hasVideoStream ? 1 : 0,
          transform: isLocal && !isScreenSharing ? 'scaleX(-1)' : 'none', // Mirror local camera preview
          transition: 'opacity 0.2s ease-in-out',
        }}
      />

      {/* Camera Off or Waiting for Stream Placeholder Overlay */}
      {!hasVideoStream && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'var(--text-muted)',
            padding: '1rem',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.4rem',
            }}
          >
            {stream ? (
              <VideoOff size={22} color="#94a3b8" />
            ) : (
              <User size={22} color="#64748b" />
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>
            {participantName}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {stream ? 'Camera Off' : waitingMessage}
          </div>
        </div>
      )}

      {/* Autoplay Audio Blocked Overlay for Remote Streams */}
      {!isLocal && autoplayBlocked && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            zIndex: 10,
            padding: '1rem',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: '#f8fafc', fontWeight: 600 }}>
            Click to enable interview audio
          </span>
          <button
            type="button"
            onClick={handleEnableAudio}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
          >
            <Volume2 size={13} />
            <span>Enable Audio</span>
          </button>
        </div>
      )}

      {/* Role & Name Badge (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          left: 6,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          zIndex: 5,
        }}
      >
        <span
          className={isLocal ? 'badge badge-primary' : 'badge badge-secondary'}
          style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
        >
          {isLocal ? `You (${role})` : `${participantName} (${role})`}
        </span>
      </div>

      {/* Mic & Media Status Badges (Bottom Right) */}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          right: 6,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          zIndex: 5,
        }}
      >
        {isScreenSharing && (
          <span
            className="badge badge-primary"
            style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Monitor size={10} />
            <span>Screen</span>
          </span>
        )}

        {!isMicOn ? (
          <span
            className="badge badge-danger"
            style={{
              fontSize: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              background: 'rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.4)',
            }}
          >
            <MicOff size={10} />
            <span>Muted</span>
          </span>
        ) : (
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
            }}
            title="Microphone active"
          >
            <Mic size={10} />
          </span>
        )}
      </div>
    </div>
  );
}
