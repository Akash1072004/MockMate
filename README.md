# MockMate — AI & Peer-to-Peer Technical Interview Platform

MockMate is a full-stack, real-time technical interview platform that pairs software candidates with adaptive Gemini AI simulations and live peer interviewers. Built with React 19, Express, WebRTC, and Supabase PostgreSQL with production-grade Row Level Security (RLS), atomic database RPCs, and Realtime synchronization.

---

## 🌟 Key Features

### 1. Dual Interview Modes
- **AI-Powered Simulations**:
  - Adaptive technical, DSA, and behavioral mock interviews powered by Google Gemini.
  - Multi-rubric automated debriefs assessing problem solving, code quality, communication, technical accuracy, and complexity analysis.
- **Peer-to-Peer Live Mock Interviews**:
  - Browse live available interviewers in real time with rating history.
  - Bidirectional WebRTC audio/video calling with camera, mic, and screen share controls.
  - Synchronized real-time collaborative code editor with syntax highlighting and multi-language support (Python, C++, Java).

### 2. Live In-Browser Code Execution Engine
- Isolated server-side execution pipeline for Python 3, C++ (GCC), and Java 21.
- Automated validation against test cases with pass/fail metrics, execution time (ms), stdout capture, and runtime error reporting.
- Submissions permanently recorded in Supabase `code_submissions`.

### 3. Comprehensive Database Security & Data Integrity
- **Role Isolation**: Immutable role assignment (`candidate` vs `interviewer`) via database triggers.
- **Atomic Session Handoff**: `accept_interview_request` atomic RPC creates interview sessions, generates unique join codes, and links requests in a single database transaction.
- **Strict Row Level Security (RLS)**: Fine-grained policies across all 7 PostgreSQL tables; candidates cannot forge peer sessions, edit evaluations, or overwrite participant records.
- **Verified Leaderboard**: Real-time rankings computed from completed, scored sessions without exposing private interview notes or codes.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, React Router v7, Vite, Lucide React, Modern Glassmorphism Design System
- **Realtime & Peer Connections**: Supabase Realtime Channels, WebRTC (STUN/ICE)
- **Backend**: Node.js, Express, Google GenAI SDK (`@google/genai`)
- **Database**: Supabase PostgreSQL, Row Level Security, PL/pgSQL Triggers & Security Definer RPCs

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com/) Gemini API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Akash1072004/MockMate.git
   cd MockMate
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the project root (see `.env.example`):
   ```env
   # Frontend (Vite)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-publishable-key

   # Backend Server
   PORT=5000
   SUPABASE_SECRET_KEY=your-supabase-secret-key
   GEMINI_API_KEY=your-gemini-api-key
   ```

4. **Initialize Supabase Database Schema**:
   Copy the contents of `supabase_schema.sql` into your Supabase Dashboard SQL Editor and run it to set up tables, triggers, secure RPCs, and Realtime publications.

5. **Start the Development Environment**:
   Run both frontend and backend concurrently:
   ```bash
   npm run dev:all
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000`

---

## 🔒 Security Architecture

| Security Domain | Implementation |
| :--- | :--- |
| **Request Tampering** | Trigger `enforce_interview_request_security` prevents status forgery and participant manipulation. |
| **Atomic Acceptance** | RPC `accept_interview_request` runs as `SECURITY DEFINER` within a single transaction. |
| **Join Code Isolation** | RPC `join_interview_by_code` enforces participant authorization and status validation. |
| **Score Protection** | Trigger `enforce_interview_update_security` forbids candidate self-scoring or unilateral completion. |
| **Role Guarding** | Trigger `prevent_profile_role_change` blocks user role escalation. |

---

## 📄 License
MIT License. Built for seamless, production-grade technical interview preparation.
