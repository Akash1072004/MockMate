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

// Backend server-only configuration
const PORT = process.env.PORT || 5000;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Clear startup environment validation
console.log('----------------------------------------------------');
console.log('[MockMate Server] Validating environment configuration...');
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
console.log('----------------------------------------------------');

const app = express();

app.use(cors());
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

const server = app.listen(PORT, () => {
  console.log(`[MockMate Server] Backend running on port ${PORT}`);
  console.log(`[MockMate Server] Health check: http://localhost:${PORT}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[MockMate Server] Port ${PORT} is already in use by an active MockMate process.`);
    console.log(`[MockMate Server] Backend is already running and accessible at http://localhost:${PORT}`);
  } else {
    console.error('[MockMate Server] Fatal server error:', err);
  }
});
