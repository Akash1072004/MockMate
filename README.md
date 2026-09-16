# MockMate — AI & Peer-to-Peer Technical Interview Platform

> A full-stack interview platform combining adaptive AI interviews, live peer-to-peer interviews, real-time collaboration, and automated technical evaluation.

<p align="center">
  <a href="https://mock-mate-ashy.vercel.app/">
    <strong>Live Demo</strong>
  </a>
  &nbsp;&nbsp;•&nbsp;&nbsp;
  <a href="https://github.com/Akash1072004/MockMate">
    <strong>Source Code</strong>
  </a>
</p>

---

## Overview

MockMate is a full-stack, real-time technical interview platform designed to simulate both **AI-driven and human-led interview experiences**.

Candidates can participate in adaptive technical, DSA, and behavioral interviews powered by Google Gemini, or connect with peer interviewers through live WebRTC sessions with collaborative coding.

The platform combines:

- AI-powered interview simulations
- Live peer-to-peer interviews
- Real-time video and audio communication
- Collaborative coding
- Server-side code execution
- Automated interview evaluation
- Interview scheduling
- Resume and profile management
- Performance leaderboards
- Database-level security and authorization

The application is built around a React frontend, Node.js/Express backend, Supabase PostgreSQL, Supabase Realtime, WebRTC, and Google Gemini.

---

## Live Application

**Production:** https://mock-mate-ashy.vercel.app/

The application is deployed with:

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| AI | Google Gemini |

---

# Core Features

## 1. AI-Powered Interview Simulation

MockMate provides adaptive AI interviews for technical, DSA, and behavioral preparation.

### Capabilities

- Technical interview simulation
- DSA interview simulation
- HR/behavioral interviews
- Adaptive follow-up questions
- Resume-aware interview flow
- Structured interview stage progression
- Automated evaluation
- Multi-rubric scoring
- Final interview report

### Evaluation Criteria

| Area | Evaluation |
|---|---|
| Problem Solving | Approach, reasoning, and solution quality |
| Technical Accuracy | Correctness of technical concepts |
| Code Quality | Readability, structure, and implementation |
| Communication | Clarity and explanation |
| Complexity | Time and space complexity analysis |
| Behavioral | Quality and relevance of responses |

The evaluation pipeline uses structured criteria rather than relying on a single unstructured model response.

---

# 2. Live Peer-to-Peer Interviews

MockMate allows candidates to conduct live mock interviews with peer interviewers.

### Interview Flow

```text
Candidate
    │
    ▼
Find Interviewer
    │
    ▼
Send Interview Request
    │
    ▼
Interviewer Accepts
    │
    ▼
Interview Scheduling
    │
    ▼
Scheduled Interview
    │
    ▼
Interview Room
    │
    ├───────────────┐
    ▼               ▼
 WebRTC        Collaborative
Video/Audio         Coding
    │               │
    └───────┬───────┘
            ▼
        Evaluation
            │
            ▼
          Results