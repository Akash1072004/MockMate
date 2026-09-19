import express from 'express';

const router = express.Router();

/**
 * GET /api/webrtc/ice-servers
 * Provides STUN and TURN server configurations to clients.
 * Supports discrete environment variables (TURN_URL, TURN_USERNAME, TURN_CREDENTIAL)
 * or full JSON array in WEBRTC_ICE_SERVERS / VITE_WEBRTC_ICE_SERVERS,
 * with fallback to community OpenRelay TURN servers for cross-network relay traversal.
 */
router.get('/ice-servers', (req, res) => {
  const defaultStuns = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  const servers = [];

  // 1. JSON array config from env
  const rawIce = process.env.WEBRTC_ICE_SERVERS || process.env.VITE_WEBRTC_ICE_SERVERS;
  if (rawIce) {
    try {
      const parsed = JSON.parse(rawIce);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      servers.push(...list);
    } catch (_) {
      const urls = rawIce.split(',').map((u) => u.trim()).filter(Boolean);
      if (urls.length > 0) servers.push({ urls });
    }
  }

  // 2. Discrete TURN credentials from env
  const turnUrl = process.env.TURN_URL || process.env.VITE_TURN_URL || process.env.TURN_SERVER_URL;
  const turnUsername = process.env.TURN_USERNAME || process.env.VITE_TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL || process.env.VITE_TURN_CREDENTIAL || process.env.TURN_PASSWORD;

  if (turnUrl) {
    const urls = turnUrl.split(',').map((u) => u.trim()).filter(Boolean);
    const turnConfig = { urls };
    if (turnUsername) turnConfig.username = turnUsername;
    if (turnCredential) turnConfig.credential = turnCredential;
    servers.push(turnConfig);
  }

  // 3. Fallback to OpenRelay community TURN if no custom TURN configured
  const hasTurn = servers.some((s) => {
    const u = Array.isArray(s.urls) ? s.urls : [s.urls];
    return u.some((url) => typeof url === 'string' && (url.startsWith('turn:') || url.startsWith('turns:')));
  });

  if (!hasTurn) {
    servers.push({
      urls: [
        'turn:openrelay.metered.ca:3478',
        'turn:openrelay.metered.ca:3478?transport=tcp',
        'turn:openrelay.metered.ca:80?transport=tcp',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    });
  }

  // 4. Ensure STUN is present
  const hasStun = servers.some((s) => {
    const u = Array.isArray(s.urls) ? s.urls : [s.urls];
    return u.some((url) => typeof url === 'string' && url.startsWith('stun:'));
  });

  if (!hasStun) {
    servers.unshift(...defaultStuns);
  }

  return res.json({
    iceServers: servers,
    hasTurnConfigured: true,
  });
});

export default router;
