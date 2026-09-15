import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure dotenv is loaded before accessing any environment variables
// 1. Load server-specific .env if it exists
const serverEnvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
}

// 2. Load root .env (merges / fallbacks)
const rootEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

// Backend server configuration
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Clear startup environment validation
console.log('----------------------------------------------------');
console.log('[MockMate Server] Validating environment configuration...');
console.log(`[MockMate Server] Target Host: ${HOST} | Port: ${PORT}`);
if (!SUPABASE_SECRET_KEY) {
  console.warn('[MockMate Server Warning] Missing SUPABASE_SECRET_KEY');
} else {
  console.log('[MockMate Server] SUPABASE_SECRET_KEY: configured');
}

if (!GEMINI_API_KEY) {
  console.warn('[MockMate Server Warning] Missing GEMINI_API_KEY');
} else {
  console.log('[MockMate Server] GEMINI_API_KEY: configured');
}

if (FRONTEND_URL) {
  console.log(`[MockMate Server] FRONTEND_URL: ${FRONTEND_URL}`);
} else {
  console.log('[MockMate Server] FRONTEND_URL: not set (allowing localhost / local origins)');
}
console.log('----------------------------------------------------');

const app = express();

// Production-safe CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://mock-mate-ashy.vercel.app',
];

if (FRONTEND_URL) {
  const envOrigins = FRONTEND_URL.split(',').map((url) => url.trim().replace(/\/$/, ''));
  allowedOrigins.push(...envOrigins);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile, curl, health-check probes, server-to-server)
    if (!origin) return callback(null, true);

    // If wildcard origin was provided in FRONTEND_URL
    if (allowedOrigins.includes('*')) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');
    const isExplicitlyAllowed = allowedOrigins.includes(normalizedOrigin);

    // In local development or if FRONTEND_URL is not set, allow localhost & local loopbacks
    const isLocalDevelopment = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    const isVercelOrigin = /^https:\/\/[a-zA-Z0-9-_]+\.vercel\.app$/.test(normalizedOrigin);

    if (isExplicitlyAllowed || isLocalDevelopment || isVercelOrigin || (!FRONTEND_URL && process.env.NODE_ENV !== 'production')) {
      return callback(null, true);
    }

    console.warn(`[MockMate CORS] Blocked request from unauthorized origin: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

import questionsRouter from './routes/questions.js';
import runRouter from './routes/run.js';
import evaluateRouter from './routes/evaluate.js';
import interviewsRouter from './routes/interviews.js';

app.use('/api/questions', questionsRouter);
app.use('/api/run', runRouter);
app.use('/api/evaluate', evaluateRouter);
app.use('/api/interviews', interviewsRouter);
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'MockMate API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      supabaseConfigured: Boolean(process.env.SUPABASE_SECRET_KEY),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[MockMate Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[MockMate Server] Backend running on http://${HOST}:${PORT}`);
  console.log(`[MockMate Server] Health check: http://${HOST}:${PORT}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[MockMate Server] Port ${PORT} is already in use by an active MockMate process.`);
    console.log(`[MockMate Server] Backend is already running and accessible at http://${HOST}:${PORT}`);
  } else {
    console.error('[MockMate Server] Fatal server error:', err);
  }
});
